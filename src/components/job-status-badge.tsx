export type JobStatus = "pending" | "downloading" | "transcribe" | "done";

const LABEL: Record<JobStatus, string> = {
  pending: "佇列中 Pending",
  downloading: "下載中 Downloading",
  transcribe: "轉錄中 Transcribing",
  done: "完成 Done",
};

// gray for pending/downloading, blue for transcribe, green for done
const TONE: Record<JobStatus, string> = {
  pending: "bg-ink/[0.06] text-ink/55",
  downloading: "bg-ink/[0.06] text-ink/55",
  transcribe: "bg-sky-500/15 text-sky-700",
  done: "bg-emerald-500/15 text-emerald-700",
};

export default function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${TONE[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}

/** Download link for a finished job; a muted dash before it is ready. */
export function TranscriptCell({ id, status }: { id: string; status: JobStatus }) {
  if (status !== "done") return <span className="text-ink/35">—</span>;
  return (
    <a
      href={`/api/jobs/${id}/transcript`}
      download={`transcript-${id.slice(0, 8)}.txt`}
      className="inline-flex items-center gap-1.5 font-medium text-chrome-deep transition-colors hover:underline"
    >
      <span aria-hidden="true">↓</span> .txt
    </a>
  );
}
