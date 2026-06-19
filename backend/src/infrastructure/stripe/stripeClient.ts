import Stripe from 'stripe';

// startup validation in index.ts guarantees STRIPE_SECRET_KEY is set in non-test env.
// The sk_test_placeholder fallback allows Jest to import this module without a real key;
// tests that exercise Stripe functionality must mock this module.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
});
