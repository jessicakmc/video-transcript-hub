"""M4 distributor: the Lambda that replaces distributor.py's polling loop.

EventBridge fires this every minute. It runs the same two passes the EC2
distributor did, but launches a Fargate task per unit of work instead of a
local subprocess:

  1. jobs.status='pending'                  -> worker.py     (JOB_ID)
  2. job_sessions.summary_status='pending'  -> summarizer.py (SESSION_ID)

Both passes are fire-and-forget: RunTask returns as soon as ECS accepts the
task, and the container reports its own progress to Supabase.

Idempotency lives in the database, not in memory. A task is launched only
where the matching *_task_arn column is NULL, and the ARN is written straight
after RunTask. That closes the hole distributor.py documented at M1: a worker
that died before flipping status='downloading' used to get respawned on the
next poll, and at a 1-minute tick a Fargate task cannot flip anything fast
enough to protect itself.

Deployed from a zip via `call_aws lambda`, NOT by CodeBuild — it lives in the
repo so the running code is reproducible, not because the build reads it.
"""
import os

import boto3
from supabase import create_client

ECS_CLUSTER = os.environ["ECS_CLUSTER"]
TASK_DEFINITION = os.environ["TASK_DEFINITION"]
SUBNETS = [s.strip() for s in os.environ["SUBNETS"].split(",") if s.strip()]
CONTAINER_NAME = os.environ.get("CONTAINER_NAME", "worker")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

db = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
ecs = boto3.client("ecs")

# Forwarded to every task. The worker task role is deliberately minimal — it
# has no secretsmanager:GetSecretValue — so the creds arrive this way and
# _load_secrets() picks them up from the environment.
BASE_ENV = [
    {"name": "SUPABASE_URL", "value": SUPABASE_URL},
    {"name": "SUPABASE_SECRET_KEY", "value": SUPABASE_SECRET_KEY},
    {"name": "OPENAI_API_KEY", "value": OPENAI_API_KEY},
]


def _run_task(env_extra: list[dict], command: list[str] | None = None) -> str | None:
    """Launch one Fargate task. Returns its ARN, or None if ECS refused it.

    assignPublicIp=ENABLED puts the task on a public subnet with a routable
    address so it reaches YouTube/OpenAI/Supabase without a NAT gateway.
    """
    override = {"name": CONTAINER_NAME, "environment": BASE_ENV + env_extra}
    if command:
        override["command"] = command

    resp = ecs.run_task(
        cluster=ECS_CLUSTER,
        taskDefinition=TASK_DEFINITION,
        launchType="FARGATE",
        count=1,
        networkConfiguration={
            "awsvpcConfiguration": {"subnets": SUBNETS, "assignPublicIp": "ENABLED"}
        },
        overrides={"containerOverrides": [override]},
    )

    failures = resp.get("failures") or []
    if failures:
        # Capacity errors and the like: leave the ARN NULL so the next tick
        # retries this job rather than losing it.
        print(f"RunTask refused: {failures}", flush=True)
        return None
    return resp["tasks"][0]["taskArn"]


def _ensure_session(job_id: str) -> str:
    """Return the job's current session id, creating the row if needed.

    The link-back update is the easy-to-miss half. POST /api/jobs creates both
    rows and sets jobs.current_session_id, but a job inserted directly (any
    manual test row) has no link — and worker.py dies on its first
    update_session() when current_session_id is NULL.
    """
    job = (
        db.table("jobs")
        .select("current_session_id")
        .eq("id", job_id)
        .single()
        .execute()
        .data
    )
    if job and job.get("current_session_id"):
        return job["current_session_id"]

    row = (
        db.table("job_sessions")
        .insert({"job_id": job_id, "session_number": 1})
        .execute()
        .data[0]
    )
    db.table("jobs").update({"current_session_id": row["id"]}).eq("id", job_id).execute()
    return row["id"]


def spawn_jobs() -> int:
    """Pass 1 — one worker task per pending job that has no task yet."""
    rows = db.table("jobs").select("id").eq("status", "pending").execute().data
    spawned = 0

    for row in rows:
        job_id = row["id"]
        session_id = _ensure_session(job_id)

        session = (
            db.table("job_sessions")
            .select("fargate_task_arn")
            .eq("id", session_id)
            .single()
            .execute()
            .data
        )
        if session and session.get("fargate_task_arn"):
            continue  # already launched on an earlier tick

        arn = _run_task([{"name": "JOB_ID", "value": job_id}])
        if not arn:
            continue

        db.table("job_sessions").update({"fargate_task_arn": arn}).eq(
            "id", session_id
        ).execute()
        print(f"spawned worker for job {job_id}: {arn}", flush=True)
        spawned += 1

    return spawned


def spawn_summaries() -> int:
    """Pass 2 — one summariser task per requested summary, same contract."""
    rows = (
        db.table("job_sessions")
        .select("id")
        .eq("summary_status", "pending")
        .is_("summary_task_arn", "null")
        .execute()
        .data
    )
    spawned = 0

    for row in rows:
        session_id = row["id"]
        arn = _run_task(
            [{"name": "SESSION_ID", "value": session_id}],
            command=["python", "summarizer.py"],
        )
        if not arn:
            continue

        db.table("job_sessions").update({"summary_task_arn": arn}).eq(
            "id", session_id
        ).execute()
        print(f"spawned summariser for session {session_id}: {arn}", flush=True)
        spawned += 1

    return spawned


def handler(event, context):
    """EventBridge entry point. One pass failing must not skip the other."""
    result = {"jobs": 0, "summaries": 0, "errors": []}

    for key, fn in (("jobs", spawn_jobs), ("summaries", spawn_summaries)):
        try:
            result[key] = fn()
        except Exception as exc:  # noqa: BLE001 — a bad row must not kill the tick
            print(f"{key} pass failed: {exc!r}", flush=True)
            result["errors"].append(f"{key}: {exc!r}")

    print(f"tick: {result}", flush=True)
    return result
