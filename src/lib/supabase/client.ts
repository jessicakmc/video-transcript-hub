import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/integrations/supabase/types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

/**
 * Publishable keys (sb_publishable_*) are opaque strings, not bearer JWTs, so
 * they must not travel in the Authorization header. Supabase-js still sets one
 * by default, so strip it and send the key as `apikey` instead.
 */
export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function readPublicSupabaseEnv() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const publishableKey = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

  if (!url || !publishableKey) {
    const missing = [
      ...(!url ? ['NEXT_PUBLIC_SUPABASE_URL'] : []),
      ...(!publishableKey ? ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(', ')}. ` +
        `Set them in .env for local development and in the Vercel project settings for deployments.`,
    );
  }

  return { url, publishableKey };
}

/** Browser-side Supabase client. Reads/writes the session from cookies. */
export function createClient() {
  const { url, publishableKey } = readPublicSupabaseEnv();

  return createBrowserClient<Database>(url, publishableKey, {
    global: { fetch: createSupabaseFetch(publishableKey) },
  });
}
