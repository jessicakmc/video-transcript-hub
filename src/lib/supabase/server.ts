import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/integrations/supabase/types';
import { createSupabaseFetch, readPublicSupabaseEnv } from './client';

/**
 * Server-side Supabase client for server components and route handlers.
 *
 * `cookies()` returns a Promise in Next.js 15+, so every caller must await
 * this function (which awaits `cookies()` internally).
 */
export async function createClient() {
  const { url, publishableKey } = readPublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    global: { fetch: createSupabaseFetch(publishableKey) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component, where cookies are read-only.
          // middleware.ts refreshes the session cookie instead.
        }
      },
    },
  });
}
