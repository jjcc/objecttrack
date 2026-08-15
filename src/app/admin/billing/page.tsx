import {
  Alert,
  Button,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { isBillingEnabled } from "@/lib/billing/flags";
import { BILLING_INTERVALS } from "@/lib/billing/stripe";
import { openBillingPortal, startCheckout } from "@/app/admin/billing/actions";
import {
  PlanComparison,
  type CatalogPlan,
} from "@/app/admin/billing/_components/PlanComparison";
import { getTranslations } from "next-intl/server";

const PAID_PLANS = ["hobby", "business"] as const;

type TenantPlan = {
  plan_code: string;
  plan_edition: string;
  max_users: number | null;
  max_objects: number | null;
  active_users: number;
  object_count: number;
};

const KNOWN_PLANS = ["free", "hobby", "business"] as const;
type KnownPlan = (typeof KNOWN_PLANS)[number];

// Plan codes are application-owned enums: stored untranslated, translated only
// at render. An unrecognised code falls back to the raw value rather than
// throwing, so adding a plan in the database never breaks this page.
function isKnownPlan(code: string): code is KnownPlan {
  return (KNOWN_PLANS as readonly string[]).includes(code);
}

function usagePercent(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

export default async function TenantBillingPage() {
  const t = await getTranslations("Admin.billing");
  const { supabase } = await requireTenantAdminAccess("tenant.billing.manage");
  const [planResult, statusResult, catalogResult] = await Promise.all([
    supabase.rpc("current_tenant_plan"),
    supabase.rpc("current_tenant_billing_status"),
    supabase.rpc("billing_plan_catalog"),
  ]);
  if (planResult.error) throw new Error(planResult.error.message);
  if (statusResult.error) throw new Error(statusResult.error.message);
  if (catalogResult.error) throw new Error(catalogResult.error.message);

  const catalog = (catalogResult.data ?? []) as CatalogPlan[];

  const plan = (planResult.data ?? [])[0] as TenantPlan | undefined;
  const billingStatus = (statusResult.data ?? [])[0] as
    | {
        subscription_status: string | null;
        grace_until: string | null;
        cancel_at_period_end: boolean;
        current_period_end: string | null;
      }
    | undefined;

  if (!plan) {
    return (
      <Stack gap="lg">
        <Title order={2}>{t("title")}</Title>
        <Alert color="gray">{t("unavailable")}</Alert>
      </Stack>
    );
  }

  const planName = isKnownPlan(plan.plan_code)
    ? t(`plans.${plan.plan_code}`)
    : plan.plan_code;

  const objectPercent = usagePercent(plan.object_count, plan.max_objects);
  const userPercent = usagePercent(plan.active_users, plan.max_users);

  // Over quota means at or above the ceiling. Existing records stay readable
  // and editable; only creation is blocked. See decision 3 of the billing plan.
  const overQuota =
    (plan.max_objects !== null && plan.object_count >= plan.max_objects) ||
    (plan.max_users !== null && plan.active_users >= plan.max_users);

  const graceDaysLeft =
    billingStatus?.subscription_status === "past_due" &&
    billingStatus.grace_until
      ? Math.max(
          0,
          Math.ceil(
            (new Date(billingStatus.grace_until).getTime() - Date.now()) /
              86_400_000
          )
        )
      : null;

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>

      {graceDaysLeft !== null && (
        <Alert color="orange" title={t("paymentFailedTitle")}>
          {t("paymentFailed", { days: graceDaysLeft })}
        </Alert>
      )}

      {overQuota && (
        <Alert color="yellow" title={t("overQuotaTitle")}>
          {t("overQuota")}
        </Alert>
      )}

      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Group justify="space-between" align="baseline">
            <Text fw={600}>{t("currentPlan")}</Text>
            <Text fw={600}>{planName}</Text>
          </Group>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm">{t("objects")}</Text>
              <Text size="sm" c="dimmed">
                {plan.max_objects === null
                  ? t("usageUnlimited", { used: plan.object_count })
                  : t("usageOfLimit", {
                      used: plan.object_count,
                      limit: plan.max_objects,
                    })}
              </Text>
            </Group>
            {objectPercent !== null && (
              <Progress
                value={objectPercent}
                color={objectPercent >= 100 ? "red" : undefined}
                aria-label={t("objects")}
              />
            )}
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm">{t("members")}</Text>
              <Text size="sm" c="dimmed">
                {plan.max_users === null
                  ? t("usageUnlimited", { used: plan.active_users })
                  : t("usageOfLimit", {
                      used: plan.active_users,
                      limit: plan.max_users,
                    })}
              </Text>
            </Group>
            {userPercent !== null && (
              <Progress
                value={userPercent}
                color={userPercent >= 100 ? "red" : undefined}
                aria-label={t("members")}
              />
            )}
          </Stack>
        </Stack>
      </Card>

      {catalog.length > 0 && <PlanComparison plans={catalog} />}

      {!isBillingEnabled() ? (
        <Alert color="gray">{t("changePlanUnavailable")}</Alert>
      ) : (
        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <Text fw={600}>{t("changePlan")}</Text>
            <Group gap="sm" wrap="wrap">
              {PAID_PLANS.filter((code) => code !== plan.plan_code).flatMap(
                (code) =>
                  BILLING_INTERVALS.map((interval) => (
                    <form action={startCheckout} key={`${code}-${interval}`}>
                      <input type="hidden" name="planCode" value={code} />
                      <input
                        type="hidden"
                        name="billingInterval"
                        value={interval}
                      />
                      <Button type="submit" variant="light">
                        {t("upgradeTo", {
                          plan: t(`plans.${code}`),
                          interval: t(`intervals.${interval}`),
                        })}
                      </Button>
                    </form>
                  ))
              )}
            </Group>
            <form action={openBillingPortal}>
              <Button type="submit" variant="subtle">
                {t("manageBilling")}
              </Button>
            </form>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
