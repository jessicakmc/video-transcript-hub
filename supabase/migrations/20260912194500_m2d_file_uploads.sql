-- Direct file uploads: the browser puts the file straight into Storage (never
-- through Vercel, whose serverless body limit is ~4.5 MB), then submits a job
-- that points at the stored object. The worker downloads it with the Secret
-- key and deletes it once the job reaches a terminal state.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  false,
  52428800,
  ARRAY[
    'audio/mpeg','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/x-wav',
    'audio/webm','audio/ogg','audio/flac','audio/3gpp','audio/amr',
    'video/mp4','video/quicktime','video/x-m4v','video/webm','video/3gpp'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

DO $$ BEGIN
  CREATE POLICY "Users can upload into their own folder" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read their own uploads" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own uploads" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'url';

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_source_type_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_source_type_check
  CHECK (source_type IN ('url', 'upload'));

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS storage_path text;
