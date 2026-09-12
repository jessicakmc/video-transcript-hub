'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type SummaryStatus = 'none' | 'pending' | 'running' | 'done' | 'failed';

type Payload = { status?: SummaryStatus; summary?: string | null; error?: string };

/**
 * The Summary column: a Summarize button before there is one, a progress label
 * while the worker is generating it, and a View link that opens the finished
 * summary in a modal. Nothing to download — it's meant to be read in place.
 *
 * The row's server-rendered `status` is the source of truth; the page's
 * AutoRefresh brings the next one in while a summary is in flight.
 */
export default function SummaryCell({
  jobId,
  jobDone,
  status,
}: {
  jobId: string;
  jobDone: boolean;
  status: SummaryStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!jobDone) return <span className="text-ink/35">—</span>;

  async function requestSummary() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/summary`, { method: 'POST' });
      const payload = (await res.json().catch(() => ({}))) as Payload;
      if (!res.ok) {
        setError(payload.error ?? `Request failed (${res.status})`);
        return;
      }
      // Either it queued, or a summary already existed — refresh either way so
      // the cell re-renders from the server's view of the row.
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy(false);
    }
  }

  async function openSummary() {
    setOpen(true);
    if (summary !== null) return;
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/summary`);
      const payload = (await res.json().catch(() => ({}))) as Payload;
      if (!res.ok || !payload.summary) {
        setError(payload.error ?? 'Could not load the summary');
        return;
      }
      setSummary(payload.summary);
    } catch {
      setError('Network error — please try again');
    }
  }

  return (
    <>
      {status === 'done' ? (
        <button
          type="button"
          onClick={openSummary}
          className="inline-flex items-center gap-1.5 font-medium text-chrome-deep transition-colors hover:underline"
        >
          <span aria-hidden="true">▤</span> 檢視 / View
        </button>
      ) : status === 'pending' || status === 'running' ? (
        <span className="inline-block rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-700">
          摘要生成中…
        </span>
      ) : (
        <button
          type="button"
          onClick={requestSummary}
          disabled={busy}
          className="inline-flex items-center gap-1.5 font-medium text-chrome-deep transition-colors hover:underline disabled:opacity-50"
        >
          <span aria-hidden="true">✦</span>{' '}
          {busy ? '送出中…' : status === 'failed' ? '重試 / Retry' : '摘要 / Summarize'}
        </button>
      )}

      {error && !open ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Transcript summary"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-[14px] bg-paper p-6 shadow-xl ring-1 ring-ink/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-display text-base font-semibold tracking-tight">
                逐字稿摘要 / Summary
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded-lg px-2 py-1 text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {error ? (
              <p className="rounded-[10px] bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : summary === null ? (
              <p className="text-sm text-ink/55">載入中…</p>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{summary}</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
