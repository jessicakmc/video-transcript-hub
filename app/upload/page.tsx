import Link from "next/link";
import { redirect } from "next/navigation";

import JobStatusBadge, {
  TranscriptCell,
  type JobStatus,
} from "@/components/job-status-badge";
import UploadForm from "@/components/upload-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "上傳 / Upload — Video Speed Reader" };

// Reads the session cookie, so this page can never be statically prerendered.
export const dynamic = "force-dynamic";

type JobRow = {
  id: string;
  created_at: string;
  video_source_url: string;
  status: JobStatus;
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function truncate(value: string, max = 50): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data } = await supabase
    .from("jobs")
    .select("id, created_at, video_source_url, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const jobs = (data ?? []) as JobRow[];

  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      <div className="flex h-16 items-center justify-between border-b border-ink/10 bg-white/40 px-6">
        <div className="flex items-center gap-3">
          <Link href="/app" className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-b from-chrome to-chrome-deep font-display text-sm font-semibold text-primary-foreground">
            V
          </Link>
          <h1 className="font-display text-base font-semibold tracking-tight">
            上傳影片 / Transcribe a video
          </h1>
        </div>
        <Link href="/app" className="text-sm text-ink/55 transition-colors hover:text-chrome-deep">
          回工作台 / Workbench
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold tracking-tight">
              我的工作 / Your jobs
            </h2>
            <span className="font-mono text-[11px] text-ink/45">{jobs.length} items</span>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-[12px] bg-white/70 p-8 text-center ring-1 ring-ink/10">
              <p className="font-display text-sm font-medium">還沒有逐字稿</p>
              <p className="mt-1 text-sm text-ink/55">
                No transcriptions yet. Submit your first video below.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[12px] bg-white/70 ring-1 ring-ink/10">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-wide text-ink/45">
                    <th className="px-4 py-3 font-normal">Created</th>
                    <th className="px-4 py-3 font-normal">URL</th>
                    <th className="px-4 py-3 font-normal">Status</th>
                    <th className="px-4 py-3 font-normal">Transcript</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-ink/5 last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-ink/55">
                        {relativeTime(job.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] text-ink/70">
                          {truncate(job.video_source_url)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-3">
                        <TranscriptCell id={job.id} status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-4 font-display text-sm font-semibold tracking-tight">
            送出新影片 / New transcription
          </h2>
          <UploadForm />
        </section>
      </div>
    </div>
  );
}
