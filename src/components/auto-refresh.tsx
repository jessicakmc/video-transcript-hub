'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Re-fetches the current server component tree on an interval.
 *
 * Used by the server-rendered job list so a job walks
 * pending → downloading → transcribe → done on its own. `router.refresh()`
 * re-runs the page on the server and swaps in the new payload without losing
 * scroll position or client state, so everything the page renders — the job
 * rows *and* the credits badge after the worker deducts — updates together.
 *
 * Polling stops as soon as nothing is in flight (`active` goes false), so an
 * idle page makes no requests.
 */
export default function AutoRefresh({
  active,
  intervalMs = 5000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const id = setInterval(() => {
      // Don't poll a tab nobody is looking at; refresh once it comes back.
      if (document.visibilityState === 'visible') router.refresh();
    }, intervalMs);

    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
