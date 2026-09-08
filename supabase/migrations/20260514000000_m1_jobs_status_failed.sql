-- Allow jobs to record that they failed, instead of sitting at whatever
-- status they died in forever. No error_message column: M1 keeps the schema
-- minimal (the checklist's negative check forbids it) and the traceback stays
-- in /var/log/m1-distributor.log on the worker.

do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.jobs'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%';
  if c is not null then
    execute format('alter table public.jobs drop constraint %I', c);
  end if;
end $$;

alter table public.jobs
  add constraint jobs_status_check
  check (status in ('pending', 'downloading', 'transcribe', 'done', 'failed'));
