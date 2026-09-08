/**
 * YouTube blocks datacenter IP ranges with "Sign in to confirm you're not a
 * bot", so a YouTube link submitted here dies in the worker's download step no
 * matter what the code does — the block is on where the request comes from,
 * not on how it is made. Reject it up front rather than letting the job fail
 * minutes later. See claude/m1-progress.md for the options that would change
 * this (authenticated cookies, or a residential proxy).
 */
const YOUTUBE_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
];

export const YOUTUBE_REJECTION =
  "YouTube 網址目前不支援 — YouTube 會封鎖雲端主機的 IP，轉錄一定會失敗。請改用直接的 mp4 / mp3 連結。";

export function isYouTubeUrl(raw: string): boolean {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    return YOUTUBE_HOSTS.includes(host);
  } catch {
    return false;
  }
}

/** Returns an error message when the URL can't be accepted, else null. */
export function validateVideoUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "請填影片網址。";

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "網址格式不正確，請貼完整的連結（含 https://）。";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "只支援 http / https 連結。";
  }
  if (isYouTubeUrl(value)) return YOUTUBE_REJECTION;
  return null;
}
