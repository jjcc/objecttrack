import "server-only";

/**
 * Master switch for subscription commerce.
 *
 * Fail-closed, matching SELF_SERVICE_REGISTRATION_ENABLED: absent or anything
 * other than "true" means disabled.
 *
 * This gates *commerce* only — checkout, plan selection, and the billing
 * portal. It must never gate capability: a workspace already on a paid plan
 * keeps every entitlement that plan carries while the flag is off, because
 * entitlements resolve from the stored plan in the database and never consult
 * this flag.
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}
