"""
Summarizer: turns one finished transcript into a short readable summary.

Spawned by distributor.py (one Popen per session whose summary_status is
'pending'). Reads SESSION_ID from env.

Runs here rather than in the Next.js app on purpose: OPENAI_API_KEY lives in
AWS Secrets Manager and is read by the EC2 instance profile, so the key never
has to be copied into Vercel.
"""
import os
import sys
import traceback

import boto3
from openai import OpenAI
from supabase import create_client

# One knob if the model is ever retired or you want a cheaper/better one.
SUMMARY_MODEL = "gpt-4o-mini"

# Whisper output for a long video can be huge; the summary doesn't get better
# past a point, and truncating keeps the cost and latency predictable.
MAX_TRANSCRIPT_CHARS = 48_000

SYSTEM_PROMPT = (
    "You summarise video transcripts. Write the summary in the same language as "
    "the transcript. Produce: one sentence saying what the video is about, then "
    "3-6 bullet points covering the main ideas in the order they appear, then a "
    "one-line takeaway. Use plain text with '- ' for bullets — no markdown "
    "headings, no preamble such as 'Here is the summary'. Never invent facts "
    "that are not in the transcript."
)


def _load_secrets() -> dict[str, str]:
    sm = boto3.client("secretsmanager")
    return {
        "OPENAI_API_KEY": sm.get_secret_value(SecretId="openai-api-key")["SecretString"],
        "SUPABASE_URL": sm.get_secret_value(SecretId="supabase-url")["SecretString"],
        "SUPABASE_SECRET_KEY": sm.get_secret_value(SecretId="supabase-secret-key")["SecretString"],
    }


_secrets = _load_secrets()
db = create_client(_secrets["SUPABASE_URL"], _secrets["SUPABASE_SECRET_KEY"])
openai_client = OpenAI(api_key=_secrets["OPENAI_API_KEY"])


def set_status(session_id: str, status: str, summary: str | None = None) -> None:
    fields: dict[str, object] = {"summary_status": status}
    if summary is not None:
        fields["summary_txt"] = summary
    db.table("job_sessions").update(fields).eq("id", session_id).execute()


def run(session_id: str) -> None:
    # Claim first, exactly like worker.py does with 'downloading': if anything
    # below crashes, the row is 'running' and the distributor won't respawn us.
    set_status(session_id, "running")

    row = (
        db.table("job_sessions")
        .select("subtitle_txt_content")
        .eq("id", session_id)
        .single()
        .execute()
        .data
    )
    transcript = (row or {}).get("subtitle_txt_content") or ""
    if not transcript.strip():
        raise RuntimeError("session has no transcript to summarise")

    clipped = transcript[:MAX_TRANSCRIPT_CHARS]
    print(
        f"[{session_id}] summarising {len(clipped)} of {len(transcript)} chars",
        flush=True,
    )

    completion = openai_client.chat.completions.create(
        model=SUMMARY_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": clipped},
        ],
    )
    summary = (completion.choices[0].message.content or "").strip()
    if not summary:
        raise RuntimeError("model returned an empty summary")

    set_status(session_id, "done", summary)
    print(f"[{session_id}] summary done — {len(summary)} chars", flush=True)


def main() -> None:
    session_id = os.environ["SESSION_ID"]
    try:
        run(session_id)
    except Exception:
        print(f"[{session_id}] SUMMARY FAILED", flush=True)
        traceback.print_exc()
        try:
            set_status(session_id, "failed")
        except Exception:
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
