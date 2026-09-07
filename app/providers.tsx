"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/** Keeps React Query in sync with Supabase auth changes (was in App.tsx). */
function AuthSync({ queryClient }: { queryClient: QueryClient }) {
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") queryClient.clear();
      else queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);
  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync queryClient={queryClient} />
      {children}
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
