import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { isBillingEnabled } from "@/lib/billing/flags";
import {
  getBillingRpcSecret,
  getStripeClient,
  getWebhookSigningSecret,
} from "@/lib/billing/stripe";
import { logSecurityEvent } from "@/lib/observability/security";
import type { Database } from "@/types/database";

// Stripe signature verification needs the raw body and Node crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED_EVENTS = new Set<string>([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

type SubscriptionLike = Stripe.Subscription & {
  current_period_end?: number | null;
};

function toIsoOrNull(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number") return null;
  return new Date(seconds * 1000).toISOString();
}

export async function POST(request: NextRequest) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    // Verify before parsing. An unsigned or tampered payload never reaches the
    // database.
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      getWebhookSigningSecret()
    );
  } catch {
    logSecurityEvent({
      event: "authorization_denied",
      area: "billing_webhook",
      permission: "tenant.billing.manage",
      reason: "invalid_signature",
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Acknowledge anything we do not act on, so Stripe stops retrying it.
  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, handled: false });
  }

  const subscription = event.data.object as SubscriptionLike;
  const tenantId = Number(subscription.metadata?.tenant_id);

  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    // Nothing actionable, but do not ask Stripe to retry forever.
    logSecurityEvent({
      event: "authorization_denied",
      area: "billing_webhook",
      permission: "tenant.billing.manage",
      reason: "missing_tenant_metadata",
    });
    return NextResponse.json({ received: true, handled: false });
  }

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!
  );

  const { data, error } = await supabase.rpc("apply_stripe_subscription_event", {
    p_secret: getBillingRpcSecret(),
    p_event: {
      event_id: event.id,
      event_type: event.type,
      tenant_id: tenantId,
      subscription_status: subscription.status,
      stripe_price_id: priceId,
      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : (subscription.customer?.id ?? null),
      stripe_subscription_id: subscription.id,
      current_period_end: toIsoOrNull(subscription.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    },
  });

  if (error) {
    // Returning 500 asks Stripe to retry, which is correct for a transient
    // database failure. Replay protection makes the retry safe.
    logSecurityEvent({
      event: "authorization_denied",
      area: "billing_webhook",
      permission: "tenant.billing.manage",
      reason: "rpc_failed",
    });
    return NextResponse.json({ error: "apply_failed" }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : null;
  return NextResponse.json({
    received: true,
    handled: true,
    applied: result?.applied ?? false,
  });
}
