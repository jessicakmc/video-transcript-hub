import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session cookie on every request so server components
 * and route handlers always see a valid session.
 *
 * Next.js 16 deprecates the `middleware.ts` filename in favour of `proxy.ts`,
 * but `middleware.ts` still works; we migrate in a later milestone.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const publishableKey = process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) {
          new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        }
        if (headers.get('Authorization') === `Bearer ${publishableKey}`) {
          headers.delete('Authorization');
        }
        headers.set('apikey', publishableKey);
        return fetch(input, { ...init, headers });
      },
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: this call is what refreshes the token. Do not remove it.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // `api/stripe/webhook` is excluded on purpose: Stripe is a machine caller with
  // no auth cookie, and letting `auth.getUser()` touch that request breaks
  // signature verification (400) or redirects the delivery (307).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
