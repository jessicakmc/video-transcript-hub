-- M4: idempotency for the stateless Lambda distributor.
--
-- The EC2 distributor kept "already spawned" in memory. The Lambda cannot, so
-- the claim lives in the database: a task is launched only where the matching
-- ARN column is NULL, and the ARN is written immediately after ecs:RunTask.
ALTER TABLE job_sessions ADD COLUMN IF NOT EXISTS fargate_task_arn TEXT;
CREATE INDEX IF NOT EXISTS idx_job_sessions_unspawned
  ON job_sessions (id) WHERE fargate_task_arn IS NULL;

-- Same protection for the summary pass (distributor.py has polled
-- summary_status='pending' since M2). At a 1-minute tick, claim-first inside
-- summarizer.py is no longer enough: a Fargate task takes longer to start than
-- the gap between ticks, so without this column the next tick would spawn a
-- second summariser for the same session.
ALTER TABLE job_sessions ADD COLUMN IF NOT EXISTS summary_task_arn TEXT;
CREATE INDEX IF NOT EXISTS idx_job_sessions_unspawned_summary
  ON job_sessions (id) WHERE summary_status = 'pending' AND summary_task_arn IS NULL;
