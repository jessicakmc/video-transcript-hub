"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDocumentHead } from "@/lib/use-document-head";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import JobStatusBadge, {
  TranscriptCell,
  type JobStatus,
} from "@/components/job-status-badge";

const HEAD = {
    meta: [
      { title: "工作台 — Video Speed Reader" },
      { name: "description", content: "Submit a video URL and manage your transcripts." },
      { name: "robots", content: "noindex" },
    ],
};

type Profile = {
  display_name: string | null;
  usage_minutes: number;
  monthly_quota_minutes: number;
  credits_balance: number;
};

type Job = {
  id: string;
  created_at: string;
  video_source_url: string;
  topic: string | null;
  status: JobStatus;
};

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AppShell() {
  useDocumentHead(HEAD);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, usage_minutes, monthly_quota_minutes, credits_balance")
        .eq("id", user!.id)
        .maybeSingle();
      return data as Profile | null;
    },
  });

  // Real M1 jobs. Anything still in flight is re-polled every 5s so the badge
  // walks pending -> downloading -> transcribe -> done without a manual refresh.
  const { data: jobs } = useQuery({
    queryKey: ["jobs", user?.id],
    enabled: Boolean(user?.id),
    refetchInterval: (query) => {
      const rows = (query.state.data ?? []) as Job[];
      return rows.some((j) => j.status !== "done") ? 5000 : false;
    },
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, created_at, video_source_url, topic, status")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Job[];
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.replace("/sign-in");
  }

  const usagePct = profile
    ? Math.min(100, Math.round((profile.usage_minutes / Math.max(1, profile.monthly_quota_minutes)) * 100))
    : 0;
  const initials = (profile?.display_name ?? user?.email ?? "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-paper font-sans text-ink antialiased">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink/10 bg-white/40 md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-ink/10 px-5">
          <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-b from-chrome to-chrome-deep font-display text-sm font-semibold text-primary-foreground">
            V
          </span>
          <span className="font-display text-sm font-semibold tracking-tight">Spooler</span>
        </div>
        <nav className="space-y-1 p-3 text-sm font-medium">
          <Link href="/upload" className="flex items-center gap-2.5 rounded-lg bg-chrome/15 px-3 py-2 text-chrome-deep">
            <span className="size-4 shrink-0 rounded bg-chrome-deep/30" /> 送出影片 / Transcribe
          </Link>
          <a href="#jobs" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-ink/65 transition-colors hover:bg-chrome/10">
            <span className="size-4 shrink-0 rounded bg-ink/15" /> 逐字稿 / Transcripts
          </a>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-ink/65 transition-colors hover:bg-chrome/10"
          >
            <span className="size-4 shrink-0 rounded bg-ink/15" /> 登出 / Sign out
          </button>
        </nav>
        <div className="mt-auto p-3">
          <div className="rounded-lg bg-chrome-deep/5 p-3 ring-1 ring-chrome-deep/10">
            <div className="flex items-center justify-between font-mono text-[11px] text-chrome-deep/60">
              <span>Usage</span>
              <span>
                {profile?.usage_minutes ?? 0} / {profile?.monthly_quota_minutes ?? 30} min
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/5">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-chrome to-chrome-deep"
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1">
        <div className="flex h-16 items-center justify-between border-b border-ink/10 bg-white/40 px-6">
          <h1 className="font-display text-base font-semibold tracking-tight">工作台 / Workbench</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/credits"
              className="rounded-full bg-chrome-deep/5 px-2.5 py-1 font-mono text-[11px] text-chrome-deep ring-1 ring-chrome-deep/10 transition-colors hover:bg-chrome-deep/10"
              title="加購點數 / Buy credits"
            >
              Credits: {profile?.credits_balance ?? 0}
            </Link>
            <span className="hidden font-mono text-[11px] text-ink/50 sm:block">
              {profile?.display_name ?? user?.email}
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-b from-chrome to-chrome-deep text-xs font-medium text-primary-foreground ring-1 ring-black/5">
              {initials}
            </span>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-6">
          {/* Primary CTA — the one and only way to start a transcription. */}
          <Link
            href="/upload"
            className="group grid w-full place-items-center rounded-[14px] border-2 border-dashed border-chrome/50 bg-chrome/5 p-10 text-center transition-colors hover:bg-chrome/10"
          >
            <span className="grid size-14 place-items-center rounded-full bg-gradient-to-b from-white to-chrome/10 ring-1 ring-chrome/40">
              <span className="font-display text-2xl font-semibold text-chrome-deep">↗</span>
            </span>
            <span className="mt-4 font-display text-base font-semibold">
              貼上影片連結，開始轉錄
            </span>
            <span className="mt-1 text-sm text-ink/55">
              Paste a video URL and Whisper returns a transcript in a few minutes.
            </span>
          </Link>

          <section className="mt-8" id="jobs">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold tracking-tight">
                逐字稿 / Transcripts
              </h2>
              <span className="font-mono text-[11px] text-ink/45">{jobs?.length ?? 0} items</span>
            </div>

            {jobs?.length ? (
              <div className="overflow-x-auto rounded-[12px] bg-white/70 ring-1 ring-ink/10">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-wide text-ink/45">
                      <th className="px-4 py-3 font-normal">Created</th>
                      <th className="px-4 py-3 font-normal">Source</th>
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
                        <td className="min-w-0 px-4 py-3">
                          {job.topic && (
                            <p className="truncate font-display text-sm font-medium">{job.topic}</p>
                          )}
                          <p className="truncate font-mono text-[11px] text-ink/50">
                            {job.video_source_url}
                          </p>
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
            ) : (
              <div className="rounded-[12px] bg-white/70 p-8 text-center ring-1 ring-ink/10">
                <p className="font-display text-sm font-medium">還沒有逐字稿</p>
                <p className="mt-1 text-sm text-ink/55">
                  No transcriptions yet. Paste a video URL above to start your first one.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
