"use client";

import {
  Alert,
  Badge,
  Checkbox,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useFormState } from "react-dom";
import {
  setTenantStatusAction,
  upgradeTenantToFullAction,
  updateTenantAction,
  type OpsActionState,
} from "@/app/ops/actions";
import { SubmitButton } from "./SubmitButton";
import { useTranslations } from "next-intl";

const initialState: OpsActionState = { status: "idle", message: "" };

export type PlatformTenantDetails = {
  id: number;
  institution_name: string;
  description: string | null;
  address: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  social_media: unknown;
  status: "active" | "suspended";
  status_reason: string | null;
  suspended_at: string | null;
  defaults_version: number;
  initial_owner_email: string | null;
  initial_owner_status: string | null;
};

export type PlatformTenantProductContext = {
  edition: "simple" | "full";
  workspace_kind: "family" | "business" | "club" | "collector" | "other";
  member_visibility: "private" | "shared";
  active_users: number;
  pending_invitations: number;
  max_users: number | null;
  object_count: number;
  max_objects: number | null;
};

export function TenantOperationsForm({
  tenant,
  product,
}: {
  tenant: PlatformTenantDetails;
  product: PlatformTenantProductContext;
}) {
  const t = useTranslations("Ops.tenantForm");
  const [updateState, updateAction] = useFormState(
    updateTenantAction,
    initialState
  );
  const [statusState, statusAction] = useFormState(
    setTenantStatusAction,
    initialState
  );
  const [upgradeState, upgradeAction] = useFormState(
    upgradeTenantToFullAction,
    initialState
  );
  const nextStatus = tenant.status === "active" ? "suspended" : "active";
  const statusVerb = t(`verbs.${nextStatus}`);

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <Stack>
          <Group justify="space-between">
            <Title order={3}>{t("editionTitle")}</Title>
            <Badge
              size="lg"
              color={product.edition === "full" ? "blue" : "gray"}
            >
              {t(`editions.${product.edition}`)}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("editionSummary", {
              kind: t(`workspaceKinds.${product.workspace_kind}`),
              visibility: t(`visibilities.${product.member_visibility}`),
            })}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Text size="sm">
              {t("memberUsage", {
                used: product.active_users + product.pending_invitations,
                limit: product.max_users ?? t("unlimited"),
              })}
            </Text>
            <Text size="sm">
              {t("objectUsage", {
                used: product.object_count,
                limit: product.max_objects ?? t("unlimited"),
              })}
            </Text>
          </SimpleGrid>
          {product.edition === "simple" ? (
            <form action={upgradeAction}>
              <Stack>
                {upgradeState.status !== "idle" && (
                  <Alert
                    color={upgradeState.status === "error" ? "red" : "green"}
                  >
                    {upgradeState.message}
                  </Alert>
                )}
                <Text size="sm">{t("upgradeDescription")}</Text>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <Checkbox
                  name="confirmation"
                  value="confirmed"
                  label={t("upgradeConfirmation")}
                  required
                />
                <SubmitButton
                  idleLabel={t("upgrade")}
                  pendingLabel={t("upgrading")}
                />
              </Stack>
            </form>
          ) : (
            <Text size="sm" c="dimmed">
              {t("fullDescription")}
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <form action={updateAction}>
          <Stack>
            <Title order={3}>{t("profileTitle")}</Title>
            {updateState.status !== "idle" && (
              <Alert
                color={updateState.status === "error" ? "red" : "green"}
                title={
                  updateState.status === "error"
                    ? t("updateFailed")
                    : t("updated")
                }
              >
                {updateState.message}
              </Alert>
            )}
            <input type="hidden" name="tenantId" value={tenant.id} />
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
                label={t("institutionEmail")}
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
            <SubmitButton idleLabel={t("save")} pendingLabel={t("saving")} />
          </Stack>
        </form>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <form action={statusAction}>
          <Stack>
            <Title order={3}>{t("statusTitle", { action: statusVerb })}</Title>
            <Text size="sm" c="dimmed">
              {t("statusDescription")}
            </Text>
            {statusState.status !== "idle" && (
              <Alert
                color={statusState.status === "error" ? "red" : "green"}
                title={
                  statusState.status === "error"
                    ? t("statusFailed")
                    : t("statusChanged")
                }
              >
                {statusState.message}
              </Alert>
            )}
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="status" value={nextStatus} />
            <Textarea
              name="reason"
              label={t("reason")}
              required
              rows={3}
              maxLength={1000}
            />
            <Checkbox
              name="confirmation"
              value="confirmed"
              label={t("confirmation", { action: statusVerb.toLocaleLowerCase() })}
              required
            />
            <Divider />
            <SubmitButton
              idleLabel={t(`statusSubmit.${nextStatus}`)}
              pendingLabel={t(`statusPending.${nextStatus}`)}
              color={nextStatus === "suspended" ? "red" : "green"}
            />
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
