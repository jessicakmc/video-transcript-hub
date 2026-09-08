"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { validateVideoUrl } from "@/lib/video-url";

const LANGUAGES = [
  { value: "zh", label: "中文 / Chinese" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語 / Japanese" },
];

const FIELD =
  "w-full rounded-[10px] border border-ink/15 bg-white/80 px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink/35 focus:border-chrome-deep focus:outline-none focus:ring-2 focus:ring-chrome/30";

export default function UploadForm() {
  const router = useRouter();
  const [videoSourceUrl, setVideoSourceUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("zh");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Catch the YouTube case here so the user finds out immediately rather
    // than watching a job die in the worker minutes later.
    const invalid = validateVideoUrl(videoSourceUrl);
    if (invalid) {
      setError(invalid);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_source_url: videoSourceUrl,
          topic: topic || null,
          language,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? `Request failed (${res.status})`);
      }

      setVideoSourceUrl("");
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
      <div>
        <label htmlFor="video_source_url" className="mb-1.5 block text-sm font-medium">
          影片網址 / Video URL
        </label>
        <input
          id="video_source_url"
          name="video_source_url"
          type="url"
          required
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

      {error && (
        <p className="rounded-[10px] bg-red-500/10 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-[10px] btn-chrome px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {submitting ? "送出中…" : "Transcribe"}
      </button>
    </form>
  );
}
