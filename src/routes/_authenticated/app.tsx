import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "工作台 — Video Speed Reader" },
      { name: "description", content: "Upload videos and manage your transcripts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppShell,
});

type Profile = {
  display_name: string | null;
  usage_minutes: number;
  monthly_quota_minutes: number;
};

type Transcript = {
  id: string;
  title: string;
  file_name: string | null;
  duration_seconds: number | null;
  status: "queued" | "processing" | "ready";
  progress: number;
};

function formatDuration(seconds: number | null) {
  if (seconds == null) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StatusBadge({ t }: { t: Transcript }) {
  if (t.status === "ready") {
    return (
      <span className="shrink-0 rounded-full bg-chrome/20 px-2.5 py-1 text-[11px] font-medium text-chrome-deep">
        完成 Ready
      </span>
    );
  }
  if (t.status === "processing") {
    return (
      <span className="shrink-0 rounded-full bg-chrome-deep px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
        {t.progress}%
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[11px] font-medium text-ink/55">
      佇列中 Queued
    </span>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
        .select("display_name, usage_minutes, monthly_quota_minutes")
        .eq("id", user!.id)
        .maybeSingle();
      return data as Profile | null;
    },
  });

  const { data: transcripts } = useQuery({
    queryKey: ["transcripts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("transcripts")
        .select("id, title, file_name, duration_seconds, status, progress")
        .order("created_at", { ascending: false });
      return (data ?? []) as Transcript[];
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { error } = await supabase.from("transcripts").insert({
          user_id: user.id,
          title: file.name.replace(/\.[^.]+$/, ""),
          file_name: file.name,
          status: "queued",
          progress: 0,
        });
        if (error) throw error;
      }
      toast.success("已加入佇列", { description: `${files.length} 個檔案等待轉錄。` });
      queryClient.invalidateQueries({ queryKey: ["transcripts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上傳失敗");
    } finally {
      setUploading(false);
    }
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
          <a href="#upload" className="flex items-center gap-2.5 rounded-lg bg-chrome/15 px-3 py-2 text-chrome-deep">
            <span className="size-4 shrink-0 rounded bg-chrome-deep/30" /> 上傳 / Upload
          </a>
          <a href="#transcripts" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-ink/65 transition-colors hover:bg-chrome/10">
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
          <h1 className="font-display text-base font-semibold tracking-tight">上傳影片 / Upload video</h1>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] text-ink/50 sm:block">
              {profile?.display_name ?? user?.email}
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-b from-chrome to-chrome-deep text-xs font-medium text-primary-foreground ring-1 ring-black/5">
              {initials}
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          {/* Dropzone */}
          <div className="p-6" id="upload">
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
              className="grid w-full place-items-center rounded-[14px] border-2 border-dashed border-chrome/50 bg-chrome/5 p-10 text-center transition-colors hover:bg-chrome/10 disabled:opacity-60"
            >
              <span className="grid size-14 place-items-center rounded-full bg-gradient-to-b from-white to-chrome/10 ring-1 ring-chrome/40">
                <span className="font-display text-2xl font-semibold text-chrome-deep">↑</span>
              </span>
              <span className="mt-4 font-display text-base font-semibold">
                {uploading ? "加入中…" : "拖入影片或點擊上傳"}
              </span>
              <span className="mt-1 text-sm text-ink/55">Drop a video or click to browse</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="video/*,audio/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="mt-4 flex items-center justify-between rounded-lg bg-white/60 px-4 py-3 ring-1 ring-ink/10">
              <span className="text-sm font-medium">平均時間 / Avg. time</span>
              <span className="font-mono text-sm text-chrome-deep">02:47</span>
            </div>
          </div>

          {/* Transcript list */}
          <div className="border-t border-ink/10 p-6 pt-0 lg:border-t-0 lg:border-l lg:pt-6" id="transcripts">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold tracking-tight">逐字稿 / Transcripts</h2>
              <span className="font-mono text-[11px] text-ink/45">{transcripts?.length ?? 0} items</span>
            </div>
            <div className="space-y-2">
              {transcripts?.length ? (
                transcripts.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-[12px] bg-white/70 p-4 ring-1 ring-ink/10 ${
                      t.status === "processing" ? "border-l-4 border-chrome-deep" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-medium">{t.title}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink/45">
                          {t.file_name ?? "video"} · {formatDuration(t.duration_seconds)}
                        </p>
                      </div>
                      <StatusBadge t={t} />
                    </div>
                    {t.status === "processing" && (
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink/10">
                        <span
                          className="block h-full rounded-full bg-chrome-deep"
                          style={{ width: `${t.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-[12px] bg-white/70 p-8 text-center ring-1 ring-ink/10">
                  <p className="font-display text-sm font-medium">還沒有逐字稿</p>
                  <p className="mt-1 text-sm text-ink/55">
                    Upload your first video — transcripts appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
