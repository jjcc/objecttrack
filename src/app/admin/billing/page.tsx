import { Alert, Card, Group, Progress, Stack, Text, Title } from "@mantine/core";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { isBillingEnabled } from "@/lib/billing/flags";
import { getTranslations } from "next-intl/server";

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
  const { data, error } = await supabase.rpc("current_tenant_plan");
  if (error) throw new Error(error.message);

  const plan = (data ?? [])[0] as TenantPlan | undefined;

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

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("description")}
        </Text>
      </div>

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

      {isBillingEnabled() ? (
        <Alert color="blue">{t("changePlanAvailable")}</Alert>
      ) : (
        <Alert color="gray">{t("changePlanUnavailable")}</Alert>
      )}
    </Stack>
  );
}
