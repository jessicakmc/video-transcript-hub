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

# Primary model, and the fallback used if the primary is unavailable on this
# key (wrong name, not enabled, retired). gpt-4o-mini was the original choice;
# it is fast and cheap but flattens a long rambling recording into generic
# bullets, which is exactly what this summariser is trying to stop doing.
SUMMARY_MODEL = "gpt-4o"
SUMMARY_MODEL_FALLBACK = "gpt-4o-mini"

# Structured summaries are longer than the old 3-6 bullets. This is a ceiling,
# not a target — the prompt tells the model to scale with the source.
MAX_SUMMARY_TOKENS = 4000

# Whisper output for a long video can be huge; the summary doesn't get better
# past a point, and truncating keeps the cost and latency predictable.
MAX_TRANSCRIPT_CHARS = 60_000

SYSTEM_PROMPT = """\
You reorganise a raw speech-to-text transcript into a structured, skimmable set
of notes. The source is unedited: it rambles, repeats itself, backtracks and
contains transcription errors. Your job is to impose structure on it without
adding anything that was not said.

Write in the SAME LANGUAGE as the transcript.

Produce, in this order:

1. One opening line naming what this recording is — the kind of conversation,
   who is speaking to whom if that is clear, and what it is broadly about.

2. A section headed 整體主軸 (or "Main threads" in English) with 3-5 bullets
   giving the few things the recording is really about. Someone who reads only
   this section should already know what happened.

3. The body: split the content into thematic sections and number their headings
   一、二、三… (English: 1. 2. 3.). Choose the sections from what is actually in
   the recording — do not force a fixed template onto it. Give each section a
   short descriptive heading, then bullets under it. Use a second indented
   level for detail that belongs to a bullet above it. Where the speaker gives
   concrete specifics — dates, numbers, names, amounts, places, quoted phrases
   — keep them exactly as stated rather than generalising them away.

4. A closing section headed 最核心的重點 (English: "The core points") that
   compresses everything into 5-8 numbered lines. This is the part a reader
   comes back to later, so make each line stand on its own.

Rules:

- Be faithful. Never add facts, conclusions, advice or judgements that are not
  in the transcript. If the speaker is uncertain or contradicts themselves, say
  so plainly rather than resolving it for them.
- Merge repetition. A point made five times becomes one bullet, optionally
  noting that the speaker kept returning to it.
- Where the transcript is garbled and the intended meaning is recoverable from
  context, use the sensible reading and flag it briefly (e.g. "逐字稿此處明顯
  轉錄錯誤"). Where it is not recoverable, leave it out.
- Scale the length to the source. A five-minute clip gets a short set of notes;
  a one-hour recording gets a thorough one. Do not pad to fill the structure,
  and do not compress a long recording into a handful of lines.
- Do not evaluate whether what is said is true, wise or correct. Organise it.

Format as PLAIN TEXT, because it is displayed without a markdown renderer:

- Section headings on their own line: 一、整體主軸
- First-level bullets start with "- "
- Second-level bullets are indented two spaces and start with "· "
- Numbered lines in the closing section start with "1. ", "2. " …
- Never use #, *, ** or any other markdown syntax
- No preamble such as "Here is the summary" and no sign-off

"""


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


def _summarise(transcript: str) -> str:
    """Ask the model for the structured notes, falling back one model down.

    The fallback exists because the only way this step can fail on a healthy
    transcript is the model name: if `SUMMARY_MODEL` is not enabled on the key
    the API raises, and a summary that never arrives is worse than one written
    by the cheaper model.
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": transcript},
    ]
    for model in (SUMMARY_MODEL, SUMMARY_MODEL_FALLBACK):
        try:
            completion = openai_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.3,
                max_tokens=MAX_SUMMARY_TOKENS,
            )
        except Exception as exc:  # noqa: BLE001 - any API-side refusal of the model
            if model == SUMMARY_MODEL_FALLBACK:
                raise
            print(f"model {model} unavailable ({exc}); retrying with {SUMMARY_MODEL_FALLBACK}", flush=True)
            continue
        text = (completion.choices[0].message.content or "").strip()
        if text:
            return text
        if model == SUMMARY_MODEL_FALLBACK:
            break
        print(f"model {model} returned nothing; retrying with {SUMMARY_MODEL_FALLBACK}", flush=True)
    raise RuntimeError("model returned an empty summary")


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

    summary = _summarise(clipped)
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
