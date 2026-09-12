-- How many credits this job needs, in minutes of video, as measured by the
-- worker. Written when the worker gates a job at insufficient_credits so the
-- UI can say "you are N short" instead of just "not enough".
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS required_credits numeric;
