"use client";

import {
  Alert,
  Checkbox,
  Divider,
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

export function TenantOperationsForm({
  tenant,
}: {
  tenant: PlatformTenantDetails;
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
  const nextStatus = tenant.status === "active" ? "suspended" : "active";
  const statusVerb = t(`verbs.${nextStatus}`);

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <form action={updateAction}>
          <Stack>
            <Title order={3}>{t("profileTitle")}</Title>
            {updateState.status !== "idle" && (
              <Alert
                color={updateState.status === "error" ? "red" : "green"}
                title={updateState.status === "error" ? t("updateFailed") : t("updated")}
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
