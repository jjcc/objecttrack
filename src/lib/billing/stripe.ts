import "server-only";

import Stripe from "stripe";

/**
 * Server-side Stripe client.
 *
 * Deliberately lazy: the key is read on first use rather than at module load,
 * so importing this file in an environment without billing configured does not
 * throw at build time.
 */
let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  client = new Stripe(key);
  return client;
}

export function getWebhookSigningSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return secret;
}

/**
 * Shared secret proving to the database that a caller has already verified a
 * Stripe signature. Keeps SUPABASE_SERVICE_ROLE_KEY out of application code.
 */
export function getBillingRpcSecret(): string {
  const secret = process.env.BILLING_WEBHOOK_RPC_SECRET;
  if (!secret) {
    throw new Error("BILLING_WEBHOOK_RPC_SECRET is not configured");
  }
  return secret;
}

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}
