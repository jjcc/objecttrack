"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { isBillingEnabled } from "@/lib/billing/flags";
import { getStripeClient } from "@/lib/billing/stripe";

const checkoutSchema = z.object({
  planCode: z.enum(["hobby", "business"]),
  billingInterval: z.enum(["month", "year"]),
});

function appUrl(path: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}${path}`;
}

/**
 * Starts a Stripe Checkout session for the caller's own workspace.
 *
 * The workspace is derived from the caller's access context inside the
 * database, never from the form. The price is resolved from the plan catalog,
 * so a tampered form cannot buy a plan at another plan's price.
 */
export async function startCheckout(formData: FormData): Promise<void> {
  if (!isBillingEnabled()) {
    throw new Error("Billing is not enabled");
  }

  const { supabase } = await requireTenantAdminAccess("tenant.billing.manage");

  const parsed = checkoutSchema.safeParse({
    planCode: formData.get("planCode"),
    billingInterval: formData.get("billingInterval"),
  });
  if (!parsed.success) {
    throw new Error("Invalid plan selection");
  }

  const { data, error } = await supabase.rpc("billing_checkout_context", {
    p_plan_code: parsed.data.planCode,
    p_billing_interval: parsed.data.billingInterval,
  });
  if (error) throw new Error(error.message);

  const context = (data ?? [])[0];
  if (!context?.stripe_price_id) {
    throw new Error("No price is configured for that plan");
  }

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: context.stripe_price_id, quantity: 1 }],
    customer: context.stripe_customer_id ?? undefined,
    client_reference_id: String(context.workspace_id),
    // The webhook reads the workspace from here. It is set server-side from the
    // caller's own context, so it cannot be forged by the browser.
    subscription_data: {
      metadata: {
        tenant_id: String(context.workspace_id),
        plan_code: parsed.data.planCode,
      },
    },
    success_url: appUrl("/admin/billing?checkout=success"),
    cancel_url: appUrl("/admin/billing?checkout=cancelled"),
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  redirect(session.url);
}

/**
 * Opens the Stripe Customer Portal so an Owner can change or cancel a plan,
 * update a card, or download invoices without us building any of that.
 */
export async function openBillingPortal(): Promise<void> {
  if (!isBillingEnabled()) {
    throw new Error("Billing is not enabled");
  }

  const { supabase } = await requireTenantAdminAccess("tenant.billing.manage");

  const { data, error } = await supabase.rpc("billing_checkout_context", {
    p_plan_code: undefined,
    p_billing_interval: undefined,
  });
  if (error) throw new Error(error.message);

  const context = (data ?? [])[0];
  if (!context?.stripe_customer_id) {
    throw new Error("This workspace has no billing account yet");
  }

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: context.stripe_customer_id,
    return_url: appUrl("/admin/billing"),
  });

  redirect(session.url);
}
