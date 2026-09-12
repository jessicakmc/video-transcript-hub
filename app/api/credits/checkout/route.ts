import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Creates a Stripe Checkout Session for one credit pack and returns its URL.
 *
 * The credits-per-pack mapping lives in `credit_products` (Supabase), never in
 * Stripe price metadata — so re-tiering is a SQL change, not a Stripe change.
 */
export async function POST(req: Request) {
  // 1. Authenticate the caller via the cookie session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { product_id?: string };
  if (!body.product_id) {
    return NextResponse.json({ error: 'product_id required' }, { status: 400 });
  }

  // 2. Look up the pack. Admin client so the lookup can't be shaped by RLS,
  // but the row is still constrained to active products with a real price.
  const admin = createAdminClient();
  const { data: product, error: productErr } = await admin
    .from('credit_products')
    .select('id, name, credits, stripe_price_id, active')
    .eq('id', body.product_id)
    .single();

  if (productErr || !product) {
    return NextResponse.json({ error: 'product not found' }, { status: 400 });
  }
  if (!product.active || !product.stripe_price_id) {
    return NextResponse.json({ error: 'product unavailable' }, { status: 400 });
  }

  // 3. Build absolute URLs from the caller's Origin so this route keeps working
  // when M3 puts a custom domain in front of the same deployment.
  const origin =
    req.headers.get('origin') ?? process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: product.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/credits?purchase=success`,
      cancel_url: `${origin}/credits?purchase=cancelled`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        product_id: product.id,
        credits: String(product.credits),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'stripe returned no checkout url' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('checkout session create failed', err);
    return NextResponse.json({ error: 'could not start checkout' }, { status: 500 });
  }
}
