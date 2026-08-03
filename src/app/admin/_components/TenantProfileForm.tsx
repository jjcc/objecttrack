"use client";

import {
  Alert,
  Checkbox,
  Paper,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useFormState } from "react-dom";
import { useTranslations } from "next-intl";
import {
  updateCurrentTenantProfileAction,
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
};

export function TenantProfileForm({
  tenant,
}: {
  tenant: TenantAdminProfile;
}) {
  const t = useTranslations("Admin.profileForm");
  const [state, action] = useFormState(
    updateCurrentTenantProfileAction,
    initialState
  );

  return (
    <Paper withBorder p="lg" radius="md" maw={900}>
      <form action={action}>
        <Stack>
          <Title order={3}>{t("title")}</Title>
          {state.status !== "idle" && (
            <Alert
              color={state.status === "error" ? "red" : "green"}
              title={state.status === "error" ? t("updateFailed") : t("updated")}
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
  );
}
