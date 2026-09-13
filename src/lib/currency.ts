/**
 * The two currencies the credit packs are sold in.
 *
 * Each Stripe Price is a single multi-currency object carrying both a USD and a
 * GBP `unit_amount` via `currency_options`, so there is one `stripe_price_id`
 * per tier and the currency is chosen when the Checkout Session is created.
 * `credit_products.price_usd` / `.price_gbp` exist only so the page can render
 * the amount without calling Stripe.
 */
export const CURRENCIES = ['usd', 'gbp'] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Which currency to show someone we have not heard from before.
 *
 * Vercel puts the visitor's country in `x-vercel-ip-country`. Only the UK gets
 * GBP; everyone else, including an unknown country, gets USD. The guess is
 * always overridable — see the toggle on /credits — so being wrong costs a
 * click, not a sale.
 */
export function currencyForCountry(country: string | null | undefined): Currency {
  return country?.toUpperCase() === 'GB' ? 'gbp' : 'usd';
}

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  usd: '$',
  gbp: '£',
};

export const CURRENCY_LABEL: Record<Currency, string> = {
  usd: 'USD',
  gbp: 'GBP',
};

export function formatMoney(amount: number, currency: Currency, fractionDigits = 2): string {
  return `${CURRENCY_SYMBOL[currency]}${amount.toFixed(fractionDigits)}`;
}
