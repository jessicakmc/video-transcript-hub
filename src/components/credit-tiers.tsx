'use client';

import { useState } from 'react';

import { type Currency, formatMoney } from '@/lib/currency';

export type CreditTier = {
  id: string;
  name: string;
  credits: number;
  /** Amount in the currency being displayed, not always USD. */
  price: number;
  per_credit: number;
  bonus_pct: number;
};

/**
 * The three buy buttons. Client component because it needs click handlers and
 * an in-flight lock — without the lock a double-click opens two Checkout
 * Sessions and the user can pay twice.
 */
export default function CreditTiers({
  tiers,
  currency,
}: {
  tiers: CreditTier[];
  currency: Currency;
}) {
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(productId: string) {
    if (purchasingId) return;
    setPurchasingId(productId);
    setError(null);

    try {
      const res = await fetch('/api/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The currency travels with the request: the server must not re-guess
        // it from the IP, or the price shown and the price charged could differ.
        body: JSON.stringify({ product_id: productId, currency }),
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!res.ok || !payload.url) {
        setError(payload.error ?? 'Checkout failed');
        setPurchasingId(null);
        return;
      }

      window.location.href = payload.url;
    } catch {
      setError('Network error — please try again');
      setPurchasingId(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="flex flex-col rounded-[12px] bg-white/70 p-5 ring-1 ring-ink/10"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-sm font-semibold tracking-tight">{tier.name}</h3>
              {tier.bonus_pct > 0 ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-700">
                  +{tier.bonus_pct}%
                </span>
              ) : null}
            </div>

            <p className="mt-3 font-display text-2xl font-semibold tracking-tight">
              {formatMoney(tier.price, currency)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink/45">
              {formatMoney(tier.per_credit, currency, 3)} / credit
            </p>

            <button
              type="button"
              onClick={() => buy(tier.id)}
              disabled={purchasingId !== null}
              className="mt-5 rounded-[10px] bg-gradient-to-b from-chrome to-chrome-deep px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {purchasingId === tier.id ? '前往 Stripe…' : '購買 / Buy'}
            </button>
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-[10px] bg-red-500/10 px-4 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
