"""
M1 worker: polls one job at a time, downloads the video, runs Whisper,
writes TXT back to job_sessions.subtitle_txt_content.

Started by distributor.py (one Popen per pending job). Reads JOB_ID from env.
Reads OPENAI_API_KEY / SUPABASE_URL / SUPABASE_SECRET_KEY from AWS Secrets
Manager — the EC2's IAM instance profile grants `secretsmanager:GetSecretValue`
on exactly those three secret names, so no credentials ever live on disk.
"""
import os
import sys
import math
import traceback
import subprocess
import tempfile
from pathlib import Path

import boto3
from openai import OpenAI
from supabase import create_client


def _get_secret(client, name: str) -> str:
    """Fetch one Secrets Manager secret by name (returns the SecretString)."""
    return client.get_secret_value(SecretId=name)["SecretString"]


def _load_secrets() -> dict[str, str]:
    """Pull the three M1 secrets from AWS Secrets Manager."""
    sm = boto3.client("secretsmanager")
    return {
        "OPENAI_API_KEY": _get_secret(sm, "openai-api-key"),
        "SUPABASE_URL": _get_secret(sm, "supabase-url"),
        "SUPABASE_SECRET_KEY": _get_secret(sm, "supabase-secret-key"),
    }


_secrets = _load_secrets()
db = create_client(_secrets["SUPABASE_URL"], _secrets["SUPABASE_SECRET_KEY"])
openai_client = OpenAI(api_key=_secrets["OPENAI_API_KEY"])

# OpenAI Whisper has a 25 MB file-size limit. 10 minutes of 64 kbps mono mp3 ~= 4.8 MB,
# safely under the limit. Long videos get split into 600-second chunks.
CHUNK_SECONDS = 600


def get_job(job_id: str) -> dict:
    return db.table("jobs").select("*").eq("id", job_id).single().execute().data


def update_job(job_id: str, **fields) -> None:
    db.table("jobs").update({**fields, "updated_at": "now()"}).eq("id", job_id).execute()


def update_session(session_id: str, **fields) -> None:
    db.table("job_sessions").update(fields).eq("id", session_id).execute()


def download_video(url: str, dest_dir: Path) -> Path:
    """yt-dlp for URLs; pass through for local file paths."""
    if url.startswith(("http://", "https://")):
        out_template = str(dest_dir / "video.%(ext)s")
        subprocess.run(["yt-dlp", "-o", out_template, url], check=True)
        return next(dest_dir.glob("video.*"))
    return Path(url).expanduser().resolve()


def to_mp3(video_path: Path, dest_dir: Path) -> Path:
    """Convert any video/audio container to 64 kbps mono 16 kHz mp3 (Whisper-friendly)."""
    mp3 = dest_dir / "audio.mp3"
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(video_path),
            "-vn", "-ac", "1",
            "-ar", "16000", "-ab", "64k",
            "-acodec", "libmp3lame",
            str(mp3),
        ],
        check=True,
        capture_output=True,
    )
    return mp3


def get_duration_seconds(audio_path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(out.stdout.strip())


def split_chunks(mp3_path: Path, dest_dir: Path) -> list[Path]:
    """Split into CHUNK_SECONDS-second chunks (re-encode to keep sizes predictable)."""
    duration = get_duration_seconds(mp3_path)
    n_chunks = max(1, math.ceil(duration / CHUNK_SECONDS))
    chunks = []
    for i in range(n_chunks):
        chunk = dest_dir / f"chunk_{i:03d}.mp3"
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(mp3_path),
                "-ss", str(i * CHUNK_SECONDS),
                "-t", str(CHUNK_SECONDS),
                "-acodec", "libmp3lame",
                "-ab", "64k",
                str(chunk),
            ],
            check=True,
            capture_output=True,
        )
        chunks.append(chunk)
    return chunks


def minutes_from_seconds(seconds: float) -> int:
    """1 credit = 1 minute, rounded UP. A 61-second clip costs 2 credits: never
    round down, or a user can submit just-under-60s clips forever for free."""
    return max(1, math.ceil(seconds / 60))


def probe_duration_minutes_cheap(video_url: str) -> int | None:
    """Duration WITHOUT downloading, for sources that publish a manifest
    (YouTube, Vimeo, archive.org with metadata). Returns None when the source
    doesn't expose one — yt-dlp prints the literal string 'NA' for direct
    CloudFront/S3 mp4s, and float('NA') would crash the worker. None means
    "ask ffprobe after the download instead"."""
    if not video_url.startswith(("http://", "https://")):
        return None
    try:
        out = subprocess.run(
            ["yt-dlp", "--print", "duration", "--no-warnings", video_url],
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        ).stdout.strip()
    except (subprocess.SubprocessError, OSError):
        return None
    if not out or out.upper() == "NA":
        return None
    try:
        return minutes_from_seconds(float(out.splitlines()[0]))
    except ValueError:
        return None


def get_balance(user_id: str) -> float:
    row = (
        db.table("profiles")
        .select("credits_balance")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )
    return float(row["credits_balance"])


def mark_insufficient(job: dict, minutes: int, balance: float) -> None:
    """Park the job without calling Whisper — that is where the real money is.
    The zero-amount ledger row is the audit trail for why it stopped."""
    update_job(job["id"], status="insufficient_credits")
    db.table("credit_transactions").insert(
        {
            "user_id": job["user_id"],
            "amount": 0,
            "type": "deduction",
            "description": f"Insufficient credits: video is {minutes} min, you have {int(balance)}",
            "job_id": job["id"],
        }
    ).execute()
    print(
        f"[{job['id']}] insufficient credits — {minutes} min needed, {int(balance)} available",
        flush=True,
    )


def deduct_credits(job: dict, minutes: int) -> None:
    """Ledger row first (source of truth), then the derived balance.

    Read-then-write is deliberate for v1: the M1 distributor spawns one worker
    per job sequentially, so the TOCTOU window can't realistically open."""
    db.table("credit_transactions").insert(
        {
            "user_id": job["user_id"],
            "amount": -minutes,
            "type": "deduction",
            "description": f"Transcribed {minutes} min video",
            "job_id": job["id"],
        }
    ).execute()
    new_balance = max(0.0, get_balance(job["user_id"]) - minutes)
    db.table("profiles").update({"credits_balance": new_balance}).eq(
        "id", job["user_id"]
    ).execute()
    print(f"[{job['id']}] deducted {minutes} credit(s), balance now {new_balance}", flush=True)


def transcribe_chunk(chunk_path: Path, language: str) -> str:
    with open(chunk_path, "rb") as f:
        return openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="text",
            language=language,
        )


def run(job_id: str) -> None:
    job = get_job(job_id)
    session_id = job["current_session_id"]

    # Claim the job before any external work. If the probe or the download
    # crashes, the job sits in 'downloading' and the distributor's pending-job
    # poll won't re-spawn this worker in a loop.
    update_job(job_id, status="downloading")

    balance = get_balance(job["user_id"])
    minutes = probe_duration_minutes_cheap(job["video_source_url"])

    # Cheap gate: the manifest gave us the duration, so we can refuse before
    # spending a single byte of download.
    if minutes is not None and minutes > balance:
        mark_insufficient(job, minutes, balance)
        return

    print(f"[{job_id}] downloading {job['video_source_url']}", flush=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        video = download_video(job["video_source_url"], tmp_path)
        mp3 = to_mp3(video, tmp_path)

        # Precise gate: no manifest duration, so pay for one download and let
        # ffprobe answer. Whisper — the expensive part — still never runs.
        if minutes is None:
            minutes = minutes_from_seconds(get_duration_seconds(mp3))
            if minutes > balance:
                mark_insufficient(job, minutes, balance)
                return

        update_job(job_id, status="transcribe")
        chunks = split_chunks(mp3, tmp_path)
        print(f"[{job_id}] transcribing {len(chunks)} chunk(s)", flush=True)

        full_text = "\n\n".join(
            transcribe_chunk(c, job["language"]) for c in chunks
        )

        update_session(session_id, subtitle_txt_content=full_text)
        deduct_credits(job, minutes)
        update_job(job_id, status="done")

    print(f"[{job_id}] done — {len(full_text)} chars", flush=True)


def main() -> None:
    """Wrap run() so a crash lands the job in 'failed' rather than leaving it
    stuck at whatever status it died in. The traceback stays in this process's
    stdout, which systemd appends to /var/log/m1-distributor.log."""
    job_id = os.environ["JOB_ID"]
    try:
        run(job_id)
    except Exception:
        print(f"[{job_id}] FAILED", flush=True)
        traceback.print_exc()
        try:
            update_job(job_id, status="failed")
        except Exception:
            # Losing the status write is not worth masking the original error.
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
