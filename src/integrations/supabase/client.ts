import { createClient } from '@/lib/supabase/client';

type BrowserClient = ReturnType<typeof createClient>;

let _supabase: BrowserClient | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
//
// The instance is created lazily on first property access so that importing
// this module from a server component never touches browser-only APIs.
export const supabase = new Proxy({} as BrowserClient, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
