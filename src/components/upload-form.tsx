"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { validateVideoUrl } from "@/lib/video-url";

const LANGUAGES = [
  { value: "zh", label: "中文 / Chinese" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語 / Japanese" },
];

/** Mirrors the bucket's file_size_limit so the user hears about it instantly. */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ACCEPT = "audio/*,video/*,.m4a,.mp3,.wav,.aac,.flac,.ogg,.amr,.mp4,.mov,.webm,.3gp";

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

const FIELD =
  "w-full rounded-[10px] border border-ink/15 bg-white/80 px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink/35 focus:border-chrome-deep focus:outline-none focus:ring-2 focus:ring-chrome/30";

type Mode = "url" | "upload";

export default function UploadForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("url");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoSourceUrl, setVideoSourceUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("zh");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Catch the YouTube case here so the user finds out immediately rather
    // than watching a job die in the worker minutes later.
    setInsufficientCredits(false);

    let payloadBody: Record<string, unknown>;

    if (mode === "url") {
      const invalid = validateVideoUrl(videoSourceUrl);
      if (invalid) {
        setError(invalid);
        return;
      }
      payloadBody = { video_source_url: videoSourceUrl, topic: topic || null, language };
    } else {
      if (!file) {
        setError("請先選擇一個檔案 / Choose a file first");
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `檔案太大（${(file.size / 1024 / 1024).toFixed(0)} MB）。上限 50 MB —— ` +
            `長錄音可以先轉成 m4a 或 mp3 再上傳。`,
        );
        return;
      }

      // Straight to Storage, never through /api/jobs: a Vercel route tops out
      // around 4.5 MB of body, which a phone recording clears easily.
      setUploading(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("登入階段已過期，請重新整理 / Session expired — please refresh");
          return;
        }

        const path = `${user.id}/${crypto.randomUUID()}${extensionOf(file.name)}`;
        // exactOptionalPropertyTypes: only pass contentType when we have one,
        // otherwise let Storage sniff it from the object.
        const uploadOptions = file.type
          ? { contentType: file.type, upsert: false }
          : { upsert: false };
        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(path, file, uploadOptions);

        if (uploadError) {
          setError(`上傳失敗 / Upload failed — ${uploadError.message}`);
          return;
        }

        payloadBody = {
          source_type: "upload",
          storage_path: path,
          filename: file.name,
          topic: topic || null,
          language,
        };
      } finally {
        setUploading(false);
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 402) {
        setInsufficientCredits(true);
        return;
      }
      if (!res.ok) {
        throw new Error(payload.error ?? `Request failed (${res.status})`);
      }

      setVideoSourceUrl("");
      setFile(null);
      setTopic("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-[12px] bg-white/70 p-5 ring-1 ring-ink/10"
    >
      <div className="flex gap-1 rounded-[10px] bg-ink/[0.04] p-1">
        {(
          [
            ["url", "貼連結 / Link"],
            ["upload", "上傳檔案 / Upload"],
          ] as [Mode, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={`flex-1 rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === value ? "bg-white text-ink shadow-sm" : "text-ink/55 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={mode === "upload" ? "hidden" : undefined}>
        <label htmlFor="video_source_url" className="mb-1.5 block text-sm font-medium">
          影片網址 / Video URL
        </label>
        <input
          id="video_source_url"
          name="video_source_url"
          type="url"
          required={mode === "url"}
          value={videoSourceUrl}
          onChange={(e) => setVideoSourceUrl(e.target.value)}
          placeholder="https://example.com/talk.mp3"
          className={FIELD}
        />
        <p className="mt-1.5 font-mono text-[11px] text-ink/45">
          直接的 mp4 / mp3 連結（CloudFront、S3、Internet Archive、Wikimedia 等）。
          YouTube 不支援 — 它會封鎖雲端主機的 IP。
        </p>
      </div>

      <div className={mode === "url" ? "hidden" : undefined}>
        <label htmlFor="media_file" className="mb-1.5 block text-sm font-medium">
          音訊或影片檔 / Audio or video file
        </label>
        <input
          id="media_file"
          name="media_file"
          type="file"
          accept={ACCEPT}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
          className="w-full text-sm text-ink/70 file:mr-3 file:rounded-[8px] file:border-0 file:bg-chrome/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-chrome-deep hover:file:bg-chrome/25"
        />
        <p className="mt-1.5 font-mono text-[11px] text-ink/45">
          手機錄音（m4a、amr）、mp3、wav、mp4、mov 都可以，上限 50 MB。
          檔案轉錄完成後會自動刪除，只留下逐字稿與摘要。
        </p>
        {file ? (
          <p className="mt-1.5 text-[11px] text-ink/55">
            已選擇：{file.name}（{(file.size / 1024 / 1024).toFixed(1)} MB）
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="topic" className="mb-1.5 block text-sm font-medium">
          主題 / Topic <span className="text-ink/40">(optional)</span>
        </label>
        <input
          id="topic"
          name="topic"
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Tech podcast — useful context for the model"
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="language" className="mb-1.5 block text-sm font-medium">
          語言 / Language
        </label>
        <select
          id="language"
          name="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className={FIELD}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {insufficientCredits && (
        <p className="rounded-[10px] bg-amber-500/10 px-3 py-2 text-sm text-amber-800" role="alert">
          點數不足 / You don&apos;t have enough credits —{" "}
          <Link href="/credits" className="font-medium underline">
            加購點數 / Buy credits
          </Link>
        </p>
      )}

      {error && (
        <p className="rounded-[10px] bg-red-500/10 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || uploading}
        className="inline-flex items-center justify-center rounded-[10px] btn-chrome px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {uploading ? "上傳中…" : submitting ? "送出中…" : "Transcribe"}
      </button>
    </form>
  );
}
