-- On-demand AI summary of a transcript, generated once per session and cached.
-- Requested from the web app (POST /api/jobs/<id>/summary), produced on the EC2
-- worker so OPENAI_API_KEY stays in Secrets Manager and out of Vercel.
ALTER TABLE public.job_sessions
  ADD COLUMN IF NOT EXISTS summary_txt text;

ALTER TABLE public.job_sessions
  ADD COLUMN IF NOT EXISTS summary_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.job_sessions DROP CONSTRAINT IF EXISTS job_sessions_summary_status_check;
ALTER TABLE public.job_sessions ADD CONSTRAINT job_sessions_summary_status_check
  CHECK (summary_status IN ('none', 'pending', 'running', 'done', 'failed'));

-- The distributor polls this every 10s; keep it cheap.
CREATE INDEX IF NOT EXISTS idx_job_sessions_summary_pending
  ON public.job_sessions(summary_status)
  WHERE summary_status = 'pending';
