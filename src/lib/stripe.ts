import Stripe from 'stripe';

/**
 * Shared server-side Stripe client.
 *
 * The apiVersion is pinned deliberately: Stripe ships breaking changes behind
 * the version pin, so a floating `stripe` minor upgrade can never change API
 * behaviour under us. This value must match what the installed SDK's types
 * expect (stripe 22.6.x → 2026-08-26.dahlia); bump both together.
 *
 * Env vars are read with bracket notation because this project's tsconfig sets
 * noPropertyAccessFromIndexSignature.
 */
const secretKey = process.env['STRIPE_SECRET_KEY'];

if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(secretKey, {
  apiVersion: '2026-08-26.dahlia',
});
