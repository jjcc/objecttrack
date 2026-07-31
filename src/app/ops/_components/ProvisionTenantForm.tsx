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

const initialState: OpsActionState = { status: "idle", message: "" };

export function ProvisionTenantForm() {
  const [state, action] = useFormState(provisionTenantAction, initialState);

  return (
    <Paper withBorder p="lg" radius="md" maw={900}>
      <form action={action}>
        <Stack>
          {state.status === "error" && (
            <Alert color="red" title="Unable to provision tenant">
              {state.message}
            </Alert>
          )}
          <TextInput
            name="institutionName"
            label="Institution name"
            required
            maxLength={200}
          />
          <TextInput
            name="ownerEmail"
            label="Initial owner email"
            description="The owner invitation is queued only for this tenant after the transaction commits."
            type="email"
            required
          />
          <Textarea name="description" label="Description" rows={3} maxLength={4000} />
          <Textarea name="address" label="Address" rows={2} maxLength={1000} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput name="contact" label="Contact" maxLength={500} />
            <TextInput name="phone" label="Phone" maxLength={100} />
            <TextInput name="email" label="Institution email" type="email" />
            <TextInput name="website" label="Website" type="url" />
          </SimpleGrid>
          <SubmitButton idleLabel="Create tenant" pendingLabel="Creating tenant…" />
        </Stack>
      </form>
    </Paper>
  );
}
