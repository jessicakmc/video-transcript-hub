import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

/**
 * Balance pill for the server-rendered page headers (`/upload`, `/credits`).
 *
 * Server component: it re-reads the balance on every server navigation, which
 * is enough to show a purchase landing without any client polling.
 *
 * The Workbench (`/app`) renders the same pill from its own client-side
 * react-query profile fetch, because that view is a client component and can't
 * mount a server component inside itself.
 */
export default async function CreditsBadge({ showBuyLink = true }: { showBuyLink?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', user.id)
    .single();

  const balance = Number(profile?.credits_balance ?? 0);

  return (
    <span className="flex items-center gap-2">
      <span className="rounded-full bg-chrome-deep/5 px-2.5 py-1 font-mono text-[11px] text-chrome-deep ring-1 ring-chrome-deep/10">
        Credits: {balance}
      </span>
      {showBuyLink ? (
        <Link
          href="/credits"
          className="text-sm text-ink/55 transition-colors hover:text-chrome-deep"
        >
          加購 / Buy more
        </Link>
      ) : null}
    </span>
  );
}
