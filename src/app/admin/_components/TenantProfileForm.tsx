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
  const [state, action] = useFormState(
    updateCurrentTenantProfileAction,
    initialState
  );

  return (
    <Paper withBorder p="lg" radius="md" maw={900}>
      <form action={action}>
        <Stack>
          <Title order={3}>Tenant profile and settings</Title>
          {state.status !== "idle" && (
            <Alert
              color={state.status === "error" ? "red" : "green"}
              title={state.status === "error" ? "Update failed" : "Updated"}
            >
              {state.message}
            </Alert>
          )}
          <TextInput
            name="institutionName"
            label="Institution name"
            defaultValue={tenant.institution_name}
            required
            maxLength={200}
          />
          <Textarea
            name="description"
            label="Description"
            defaultValue={tenant.description ?? ""}
            rows={3}
            maxLength={4000}
          />
          <Textarea
            name="address"
            label="Address"
            defaultValue={tenant.address ?? ""}
            rows={2}
            maxLength={1000}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              name="contact"
              label="Contact"
              defaultValue={tenant.contact ?? ""}
              maxLength={500}
            />
            <TextInput
              name="phone"
              label="Phone"
              defaultValue={tenant.phone ?? ""}
              maxLength={100}
            />
            <TextInput
              name="email"
              label="Institution email"
              type="email"
              defaultValue={tenant.email ?? ""}
            />
            <TextInput
              name="website"
              label="Website"
              type="url"
              defaultValue={tenant.website ?? ""}
            />
          </SimpleGrid>
          <Textarea
            name="socialMedia"
            label="Social media"
            description="JSON object"
            defaultValue={JSON.stringify(tenant.social_media ?? {}, null, 2)}
            rows={4}
            maxLength={10000}
          />
          <Checkbox
            name="publicObjectInfo"
            label="Show object information without authentication"
            defaultChecked={tenant.show_object_info_without_authentication}
          />
          <SubmitButton idleLabel="Save changes" pendingLabel="Saving…" />
        </Stack>
      </form>
    </Paper>
  );
}
