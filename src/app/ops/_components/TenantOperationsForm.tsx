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
  const [updateState, updateAction] = useFormState(
    updateTenantAction,
    initialState
  );
  const [statusState, statusAction] = useFormState(
    setTenantStatusAction,
    initialState
  );
  const nextStatus = tenant.status === "active" ? "suspended" : "active";
  const statusVerb = nextStatus === "suspended" ? "Suspend" : "Activate";

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <form action={updateAction}>
          <Stack>
            <Title order={3}>Tenant profile</Title>
            {updateState.status !== "idle" && (
              <Alert
                color={updateState.status === "error" ? "red" : "green"}
                title={updateState.status === "error" ? "Update failed" : "Updated"}
              >
                {updateState.message}
              </Alert>
            )}
            <input type="hidden" name="tenantId" value={tenant.id} />
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
            <SubmitButton idleLabel="Save tenant" pendingLabel="Saving…" />
          </Stack>
        </form>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <form action={statusAction}>
          <Stack>
            <Title order={3}>{statusVerb} tenant</Title>
            <Text size="sm" c="dimmed">
              This changes the platform-controlled tenant status. A reason and
              explicit confirmation are required.
            </Text>
            {statusState.status !== "idle" && (
              <Alert
                color={statusState.status === "error" ? "red" : "green"}
                title={
                  statusState.status === "error"
                    ? "Status change failed"
                    : "Status changed"
                }
              >
                {statusState.message}
              </Alert>
            )}
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="status" value={nextStatus} />
            <Textarea
              name="reason"
              label="Reason"
              required
              rows={3}
              maxLength={1000}
            />
            <Checkbox
              name="confirmation"
              value="confirmed"
              label={`I confirm that I want to ${statusVerb.toLowerCase()} this tenant.`}
              required
            />
            <Divider />
            <SubmitButton
              idleLabel={`${statusVerb} tenant`}
              pendingLabel={`${statusVerb}ing…`}
              color={nextStatus === "suspended" ? "red" : "green"}
            />
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
