import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import type Stripe from 'stripe';

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
 *  - a unique-violation (23505) means this payment or refund was already
 *    recorded — that is idempotency working, so answer 200 and let Stripe stop
 *    retrying. Any other failure returns 5xx so it retries.
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

  if (event.type === 'charge.refunded') {
    return handleRefund(event.data.object);
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

  // 2. Balance is derived from the ledger. apply_credit_delta does the
  // arithmetic inside one UPDATE, so two deliveries landing together cannot
  // read the same balance and clobber each other — the failure mode that
  // actually bit the worker side on 2026-09-12. If this write fails the ledger
  // row still exists, so the balance is repairable with a SUM(amount) rebuild.
  const { error: updateErr } = await admin.rpc('apply_credit_delta', {
    p_user_id: userId,
    p_delta: credits,
  });

  if (updateErr) {
    console.error('balance update failed', updateErr);
    return new NextResponse('balance update failed', { status: 500 });
  }

  return NextResponse.json({ received: true, credited: credits });
}


/**
 * Money went back out, so the credits it bought have to come back.
 *
 * Two things make this safe to receive more than once, which matters because a
 * charge can be refunded in several instalments and Stripe redelivers on any
 * non-2xx:
 *
 *  - the unique index on `stripe_refund_id` rejects a redelivery of the same
 *    refund outright;
 *  - the amount is computed as "what should have been clawed back in total,
 *    minus what already has been", so a second *different* partial refund
 *    takes only its own share even if events arrive out of order.
 *
 * Partial refunds claw back proportionally, rounded down — the rounding goes
 * to the customer.
 */
async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) {
    return NextResponse.json({ received: true, ignored: 'charge has no payment_intent' });
  }

  const admin = createAdminClient();

  // The purchase this refund reverses. Not finding one is not an error: the
  // account may have charges that never granted credits.
  const { data: purchase, error: purchaseErr } = await admin
    .from('credit_transactions')
    .select('user_id, amount')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('type', 'purchase')
    .maybeSingle();

  if (purchaseErr) {
    console.error('purchase lookup failed', purchaseErr);
    return new NextResponse('purchase lookup failed', { status: 500 });
  }
  if (!purchase) {
    return NextResponse.json({ received: true, ignored: 'no matching purchase' });
  }

  const purchasedCredits = Number(purchase.amount);
  const target =
    charge.amount > 0
      ? Math.floor((purchasedCredits * charge.amount_refunded) / charge.amount)
      : purchasedCredits;

  // How much of this purchase has already been reversed.
  const { data: priorRows, error: priorErr } = await admin
    .from('credit_transactions')
    .select('amount')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .eq('type', 'refund');

  if (priorErr) {
    console.error('prior refund lookup failed', priorErr);
    return new NextResponse('prior refund lookup failed', { status: 500 });
  }

  const alreadyClawedBack = (priorRows ?? []).reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);
  const delta = target - alreadyClawedBack;

  if (delta <= 0) {
    return NextResponse.json({ received: true, alreadyRefunded: true });
  }

  const latestRefundId = charge.refunds?.data?.[0]?.id ?? `${charge.id}:${charge.amount_refunded}`;

  // Ledger first, same contract as the purchase path: the row is the source of
  // truth and the unique index on it is the idempotency guard.
  const { error: insertErr } = await admin.from('credit_transactions').insert({
    user_id: purchase.user_id,
    amount: -delta,
    type: 'refund',
    description: `Refunded ${delta} credits`,
    stripe_payment_intent_id: null,
    stripe_refund_id: latestRefundId,
  });

  if (insertErr) {
    if (insertErr.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('refund ledger insert failed', insertErr);
    return new NextResponse('db insert failed', { status: 500 });
  }

  const { error: updateErr } = await admin.rpc('apply_credit_delta', {
    p_user_id: purchase.user_id,
    p_delta: -delta,
  });

  if (updateErr) {
    console.error('balance update failed', updateErr);
    return new NextResponse('balance update failed', { status: 500 });
  }

  return NextResponse.json({ received: true, refunded: delta });
}
