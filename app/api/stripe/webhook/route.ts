import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Stripe webhook receiver.
 *
 * Rules that matter here:
 *  - read the RAW body (`req.text()`); `req.json()` re-serialises and the
 *    signature check fails with a confusing 400.
 *  - use the Secret-key client: Stripe is the caller, there is no auth cookie,
 *    and the `profiles` update would fail RLS with the cookie-bound client.
 *  - a unique-violation (23505) on `stripe_payment_intent_id` means this
 *    payment was already credited — that is idempotency working, so answer 200
 *    and let Stripe stop retrying. Any other failure returns 5xx so it retries.
 *  - this path is excluded from middleware (see middleware.ts matcher).
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature');
  if (!signature) {
    return new NextResponse('no signature', { status: 400 });
  }

  const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return new NextResponse('webhook not configured', { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('webhook signature verification failed', err);
    return new NextResponse('invalid signature', { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object;
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true, unpaid: true });
  }

  const userId = session.metadata?.['user_id'];
  const productId = session.metadata?.['product_id'];
  const credits = Number(session.metadata?.['credits']);
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!userId || !productId || !credits || !paymentIntentId) {
    console.error('missing required fields', { userId, productId, credits, paymentIntentId });
    return new NextResponse('missing metadata', { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Ledger row first — it is the source of truth, and the unique index on
  // stripe_payment_intent_id is what makes a retried delivery a no-op.
  const { error: insertErr } = await admin.from('credit_transactions').insert({
    user_id: userId,
    amount: credits,
    type: 'purchase',
    description: `Purchased ${credits} credits`,
    stripe_payment_intent_id: paymentIntentId,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('ledger insert failed', insertErr);
    return new NextResponse('db insert failed', { status: 500 });
  }

  // 2. Balance is derived from the ledger. If this write fails the ledger row
  // still exists, so the balance is repairable with a SUM(amount) rebuild.
  const { data: profile, error: readErr } = await admin
    .from('profiles')
    .select('credits_balance')
    .eq('id', userId)
    .single();

  if (readErr) {
    console.error('profile read failed', readErr);
    return new NextResponse('profile read failed', { status: 500 });
  }

  const newBalance = Number(profile?.credits_balance ?? 0) + credits;
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ credits_balance: newBalance })
    .eq('id', userId);

  if (updateErr) {
    console.error('balance update failed', updateErr);
    return new NextResponse('balance update failed', { status: 500 });
  }

  return NextResponse.json({ received: true, credited: credits });
}
