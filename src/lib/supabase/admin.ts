import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';

import type { Database } from '@/integrations/supabase/types';
import { createSupabaseFetch } from './client';

/**
 * Server-only Supabase client using the Secret key (`sb_secret_*`).
 *
 * This key BYPASSES ROW LEVEL SECURITY — it can read and write every user's
 * rows. Never import this from a Client Component, and never expose the key
 * through a NEXT_PUBLIC_* variable. Every query made with it must re-impose
 * the per-user filter explicitly (e.g. `.eq('user_id', user.id)`).
 */
export function createAdminClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const secretKey = process.env['SUPABASE_SECRET_KEY'];

  if (!url || !secretKey) {
    const missing = [
      ...(!url ? ['NEXT_PUBLIC_SUPABASE_URL'] : []),
      ...(!secretKey ? ['SUPABASE_SECRET_KEY'] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(', ')}.`);
  }

  return createSupabaseJsClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createSupabaseFetch(secretKey) },
  });
}
