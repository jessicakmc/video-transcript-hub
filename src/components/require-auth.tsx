"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side auth guard for /app. Mirrors the RequireAuth wrapper the Vite
 * SPA used; middleware.ts keeps the session cookie fresh on the server side.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"checking" | "authed" | "anonymous">("checking");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setStatus(error || !data.user ? "anonymous" : "authed");
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (status === "anonymous") router.replace("/sign-in");
  }, [status, router]);

  if (status !== "authed") {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }
  return <>{children}</>;
}
