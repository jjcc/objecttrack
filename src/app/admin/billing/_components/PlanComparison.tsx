import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { getTranslations } from "next-intl/server";

export type CatalogPlan = {
  plan_code: string;
  plan_edition: string;
  max_users: number | null;
  max_objects: number | null;
  custom_categories: boolean;
  groups: boolean;
  advanced_transfers: boolean;
  reports: boolean;
  audit_ui: boolean;
  sort_order: number;
  is_current: boolean;
  has_monthly: boolean;
  has_annual: boolean;
};

const KNOWN_PLANS = ["free", "hobby", "business"] as const;
type KnownPlan = (typeof KNOWN_PLANS)[number];

function isKnownPlan(code: string): code is KnownPlan {
  return (KNOWN_PLANS as readonly string[]).includes(code);
}

const FEATURES = [
  "custom_categories",
  "groups",
  "advanced_transfers",
  "reports",
  "audit_ui",
] as const;

/**
 * Side-by-side plan comparison. Rendered as cards rather than a wide table so
 * it stays readable on a phone, where a five-row feature matrix would other-
 * wise force horizontal scrolling.
 */
export async function PlanComparison({ plans }: { plans: CatalogPlan[] }) {
  const t = await getTranslations("Admin.billing");

  return (
    <Stack gap="sm">
      <Text fw={600}>{t("comparePlans")}</Text>
      <Group align="stretch" gap="md" wrap="wrap">
        {plans.map((plan) => {
          const name = isKnownPlan(plan.plan_code)
            ? t(`plans.${plan.plan_code}`)
            : plan.plan_code;
          const included = FEATURES.filter((feature) => plan[feature]);

          return (
            <Card
              key={plan.plan_code}
              withBorder
              radius="md"
              padding="md"
              style={{ flex: "1 1 220px", minWidth: 220 }}
            >
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Text fw={600}>{name}</Text>
                  {plan.is_current && (
                    <Badge variant="light">{t("currentBadge")}</Badge>
                  )}
                </Group>

                <Text size="sm" c="dimmed">
                  {plan.max_objects === null
                    ? t("limitObjectsUnlimited")
                    : t("limitObjects", { count: plan.max_objects })}
                </Text>
                <Text size="sm" c="dimmed">
                  {plan.max_users === null
                    ? t("limitMembersUnlimited")
                    : t("limitMembers", { count: plan.max_users })}
                </Text>

                {included.length > 0 ? (
                  <Stack gap={2}>
                    {included.map((feature) => (
                      <Text size="sm" key={feature}>
                        {t(`features.${feature}`)}
                      </Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t("featuresNone")}
                  </Text>
                )}
              </Stack>
            </Card>
          );
        })}
      </Group>
    </Stack>
  );
}
