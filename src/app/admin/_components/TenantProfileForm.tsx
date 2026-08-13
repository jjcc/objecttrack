"use client";

import {
  Alert,
  Badge,
  Checkbox,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useFormState } from "react-dom";
import { useTranslations } from "next-intl";
import {
  updateCurrentTenantProfileAction,
  updateCurrentTenantWorkspaceAction,
  type TenantAdminActionState,
} from "@/app/admin/actions";
import { SubmitButton } from "@/app/ops/_components/SubmitButton";

const initialState: TenantAdminActionState = { status: "idle", message: "" };

export type TenantAdminProfile = {
  id: number;
  institution_name: string;
  description: string | null;
  address: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  social_media: unknown;
  show_object_info_without_authentication: boolean;
  edition: "simple" | "full";
  workspace_kind: "family" | "business" | "club" | "collector" | "other";
  member_visibility: "private" | "shared";
  max_users: number | null;
  max_objects: number | null;
  custom_categories: boolean;
  groups: boolean;
  advanced_transfers: boolean;
  reports: boolean;
  audit_ui: boolean;
};

type TenantUsage = {
  active_users: number;
  pending_invitations: number;
  max_users: number | null;
  object_count: number;
  max_objects: number | null;
};

export function TenantProfileForm({
  tenant,
  usage,
}: {
  tenant: TenantAdminProfile;
  usage: TenantUsage;
}) {
  const t = useTranslations("Admin.profileForm");
  const [state, action] = useFormState(
    updateCurrentTenantProfileAction,
    initialState
  );
  const [workspaceState, workspaceAction] = useFormState(
    updateCurrentTenantWorkspaceAction,
    initialState
  );
  const unlimited = t("unlimited");
  const features = [
    ["customCategories", tenant.custom_categories],
    ["groups", tenant.groups],
    ["advancedTransfers", tenant.advanced_transfers],
    ["reports", tenant.reports],
    ["audit", tenant.audit_ui],
  ] as const;

  return (
    <Stack gap="lg" maw={900}>
      <Paper withBorder p="lg" radius="md">
        <Stack>
          <Group justify="space-between">
            <Title order={3}>{t("productTitle")}</Title>
            <Badge size="lg" color={tenant.edition === "full" ? "blue" : "gray"}>
              {t(`editions.${tenant.edition}`)}
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div>
              <Text size="xs" c="dimmed">
                {t("memberUsage")}
              </Text>
              <Text fw={600}>
                {usage.active_users + usage.pending_invitations} /{" "}
                {usage.max_users ?? unlimited}
              </Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                {t("objectUsage")}
              </Text>
              <Text fw={600}>
                {usage.object_count} / {usage.max_objects ?? unlimited}
              </Text>
            </div>
          </SimpleGrid>
          <Text fw={600} size="sm">
            {t("featuresTitle")}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {features.map(([name, available]) => (
              <Group key={name} justify="space-between" wrap="nowrap">
                <Text size="sm">{t(`features.${name}`)}</Text>
                <Badge color={available ? "green" : "gray"} variant="light">
                  {t(available ? "included" : "fullOnly")}
                </Badge>
              </Group>
            ))}
          </SimpleGrid>
          {tenant.edition === "simple" && (
            <Text size="sm" c="dimmed">
              {t("simpleExplanation")}
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <form action={workspaceAction}>
          <Stack>
            <Title order={3}>{t("workspaceTitle")}</Title>
            <Text size="sm" c="dimmed">
              {t("workspaceDescription")}
            </Text>
            {workspaceState.status !== "idle" && (
              <Alert
                color={workspaceState.status === "error" ? "red" : "green"}
                title={
                  workspaceState.status === "error"
                    ? t("updateFailed")
                    : t("updated")
                }
              >
                {workspaceState.message}
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                name="workspaceKind"
                label={t("workspaceKind")}
                defaultValue={tenant.workspace_kind}
                data={(
                  ["family", "business", "club", "collector", "other"] as const
                ).map((value) => ({
                  value,
                  label: t(`workspaceKinds.${value}`),
                }))}
                allowDeselect={false}
              />
              <Select
                name="memberVisibility"
                label={t("memberVisibility")}
                description={t("visibilityDescription")}
                defaultValue={tenant.member_visibility}
                data={(["private", "shared"] as const).map((value) => ({
                  value,
                  label: t(`visibilities.${value}`),
                }))}
                allowDeselect={false}
              />
            </SimpleGrid>
            <SubmitButton
              idleLabel={t("saveWorkspace")}
              pendingLabel={t("saving")}
            />
          </Stack>
        </form>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <form action={action}>
          <Stack>
            <Title order={3}>{t("title")}</Title>
            {state.status !== "idle" && (
              <Alert
                color={state.status === "error" ? "red" : "green"}
                title={
                  state.status === "error" ? t("updateFailed") : t("updated")
                }
              >
                {state.message}
              </Alert>
            )}
            <TextInput
              name="institutionName"
              label={t("institutionName")}
              defaultValue={tenant.institution_name}
              required
              maxLength={200}
            />
            <Textarea
              name="description"
              label={t("description")}
              defaultValue={tenant.description ?? ""}
              rows={3}
              maxLength={4000}
            />
            <Textarea
              name="address"
              label={t("address")}
              defaultValue={tenant.address ?? ""}
              rows={2}
              maxLength={1000}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                name="contact"
                label={t("contact")}
                defaultValue={tenant.contact ?? ""}
                maxLength={500}
              />
              <TextInput
                name="phone"
                label={t("phone")}
                defaultValue={tenant.phone ?? ""}
                maxLength={100}
              />
              <TextInput
                name="email"
                label={t("email")}
                type="email"
                defaultValue={tenant.email ?? ""}
              />
              <TextInput
                name="website"
                label={t("website")}
                type="url"
                defaultValue={tenant.website ?? ""}
              />
            </SimpleGrid>
            <Textarea
              name="socialMedia"
              label={t("socialMedia")}
              description={t("jsonObject")}
              defaultValue={JSON.stringify(tenant.social_media ?? {}, null, 2)}
              rows={4}
              maxLength={10000}
            />
            <Checkbox
              name="publicObjectInfo"
              label={t("publicInfo")}
              defaultChecked={tenant.show_object_info_without_authentication}
            />
            <SubmitButton idleLabel={t("save")} pendingLabel={t("saving")} />
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
