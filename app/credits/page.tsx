import Link from 'next/link';
import { redirect } from 'next/navigation';

import CreditTiers, { type CreditTier } from '@/components/credit-tiers';
import CreditsBadge from '@/components/credits-badge';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: '點數 / Credits — Video Speed Reader' };

// Reads the session cookie, so this page can never be statically prerendered.
export const dynamic = 'force-dynamic';

const TYPE_STYLES: Record<string, string> = {
  purchase: 'text-emerald-700',
  signup_bonus: 'text-amber-700',
  deduction: 'text-ink/55',
  admin_grant: 'text-sky-700',
};

const TYPE_LABELS: Record<string, string> = {
  purchase: '購買 / Purchase',
  signup_bonus: '註冊禮 / Signup bonus',
  deduction: '扣點 / Deduction',
  admin_grant: '管理員發放 / Grant',
};

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}

export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const [{ data: profile }, { data: products }, { data: transactions }] = await Promise.all([
    supabase.from('profiles').select('credits_balance').eq('id', user.id).single(),
    supabase
      .from('credit_products')
      .select('id, name, credits, price_usd, stripe_price_id')
      .eq('active', true)
      .order('price_usd'),
    supabase
      .from('credit_transactions')
      .select('id, amount, type, description, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const balance = Number(profile?.credits_balance ?? 0);
  const rows = products ?? [];

  // Baseline for the bonus badge is the smallest pack — the worst $/credit.
  const baseline = rows.reduce<number | null>((worst, p) => {
    const ratio = Number(p.price_usd) / Number(p.credits);
    return worst === null || ratio > worst ? ratio : worst;
  }, null);

  const tiers: CreditTier[] = rows.map((p) => {
    const usdPerCredit = Number(p.price_usd) / Number(p.credits);
    return {
      id: p.id,
      name: p.name,
      credits: Number(p.credits),
      price_usd: Number(p.price_usd),
      usd_per_credit: usdPerCredit,
      bonus_pct: baseline ? Math.round((1 - usdPerCredit / baseline) * 100) : 0,
    };
  });

  const history = transactions ?? [];

  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      <div className="flex h-16 items-center justify-between border-b border-ink/10 bg-white/40 px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-b from-chrome to-chrome-deep font-display text-sm font-semibold text-primary-foreground"
          >
            V
          </Link>
          <h1 className="font-display text-base font-semibold tracking-tight">
            點數 / Credits
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <CreditsBadge showBuyLink={false} />
          <Link href="/app" className="text-sm text-ink/55 transition-colors hover:text-chrome-deep">
            回工作台 / Workbench
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <section className="rounded-[12px] bg-white/70 p-6 ring-1 ring-ink/10">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink/45">
            目前餘額 / Balance
          </p>
          <p className="mt-2 font-display text-4xl font-semibold tracking-tight">
            {balance}
            <span className="ml-2 text-base font-normal text-ink/55">credits</span>
          </p>
          <p className="mt-2 text-sm text-ink/55">1 credit = 1 minute of video</p>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 font-display text-sm font-semibold tracking-tight">
            加購點數 / Buy credits
          </h2>
          {tiers.length === 0 ? (
            <div className="rounded-[12px] bg-white/70 p-8 text-center ring-1 ring-ink/10">
              <p className="text-sm text-ink/55">No credit packs are available right now.</p>
            </div>
          ) : (
            <CreditTiers tiers={tiers} />
          )}
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold tracking-tight">
              交易紀錄 / History
            </h2>
            <span className="font-mono text-[11px] text-ink/45">{history.length} items</span>
          </div>

          {history.length === 0 ? (
            <div className="rounded-[12px] bg-white/70 p-8 text-center ring-1 ring-ink/10">
              <p className="text-sm text-ink/55">No transactions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[12px] bg-white/70 ring-1 ring-ink/10">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-wide text-ink/45">
                    <th className="px-4 py-3 font-normal">When</th>
                    <th className="px-4 py-3 font-normal">Type</th>
                    <th className="px-4 py-3 font-normal">Description</th>
                    <th className="px-4 py-3 text-right font-normal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => (
                    <tr key={tx.id} className="border-b border-ink/5 last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-ink/55">
                        {formatDate(tx.created_at)}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 ${TYPE_STYLES[tx.type] ?? 'text-ink/55'}`}
                      >
                        {TYPE_LABELS[tx.type] ?? tx.type}
                      </td>
                      <td className="px-4 py-3 text-ink/70">{tx.description ?? '—'}</td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-mono ${TYPE_STYLES[tx.type] ?? 'text-ink/55'}`}
                      >
                        {Number(tx.amount) > 0 ? `+${tx.amount}` : tx.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
