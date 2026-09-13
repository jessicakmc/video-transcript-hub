"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/integrations/supabase/client";

/**
 * The sign-out control, shared by every signed-in surface.
 *
 * Before this component the only sign-out in the app lived in the Workbench
 * sidebar, which is `hidden md:flex` — so below 768px there was no way to sign
 * out anywhere, and `/upload` and `/credits` had none at any width.
 *
 * Two failure modes the old handler had, both of which made the click look
 * like it did nothing:
 *
 * 1. `supabase.auth.signOut()` rejects when the session is already gone
 *    (`AuthSessionMissingError`) or the network call fails. The old handler
 *    awaited it with no catch, so the redirect underneath never ran. Here the
 *    navigation happens either way.
 * 2. The App Router caches RSC payloads per route, so a server component
 *    rendered while signed in could still be served from that cache after
 *    signing out. `router.refresh()` discards it.
 */
export default function SignOutButton({
  className,
  onBeforeSignOut,
}: {
  className?: string;
  /** Runs before the session is torn down — e.g. clearing a react-query cache. */
  onBeforeSignOut?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);

    try {
      await onBeforeSignOut?.();
    } catch {
      // Cache cleanup is best-effort; never let it block the sign-out.
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // Server-side revoke failed or there was no session left. Drop the local
      // session so this browser is signed out regardless.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Nothing further to do — the redirect below is what the user needs.
      }
    }

    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className={
        className ??
        "text-sm text-ink/55 transition-colors hover:text-chrome-deep disabled:opacity-60"
      }
    >
      {busy ? "登出中… / Signing out…" : "登出 / Sign out"}
    </button>
  );
}
