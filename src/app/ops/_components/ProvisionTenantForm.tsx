"use client";

import {
  Alert,
  Paper,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useFormState } from "react-dom";
import {
  provisionTenantAction,
  type OpsActionState,
} from "@/app/ops/actions";
import { SubmitButton } from "./SubmitButton";
import { useTranslations } from "next-intl";

const initialState: OpsActionState = { status: "idle", message: "" };

export function ProvisionTenantForm() {
  const t = useTranslations("Ops.provisionForm");
  const [state, action] = useFormState(provisionTenantAction, initialState);

  return (
    <Paper withBorder p="lg" radius="md" maw={900}>
      <form action={action}>
        <Stack>
          {state.status === "error" && (
            <Alert color="red" title={t("failedTitle")}>
              {state.message}
            </Alert>
          )}
          <TextInput
            name="institutionName"
            label={t("institutionName")}
            required
            maxLength={200}
          />
          <TextInput
            name="ownerEmail"
            label={t("ownerEmail")}
            description={t("ownerEmailDescription")}
            type="email"
            required
          />
          <Textarea name="description" label={t("description")} rows={3} maxLength={4000} />
          <Textarea name="address" label={t("address")} rows={2} maxLength={1000} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="contact" label={t("contact")} maxLength={500} />
            <TextInput name="phone" label={t("phone")} maxLength={100} />
            <TextInput name="email" label={t("institutionEmail")} type="email" />
            <TextInput name="website" label={t("website")} type="url" />
          </SimpleGrid>
          <SubmitButton idleLabel={t("create")} pendingLabel={t("creating")} />
        </Stack>
      </form>
    </Paper>
  );
}
