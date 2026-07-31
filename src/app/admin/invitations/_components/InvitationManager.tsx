"use client";

import {
  Alert,
  Badge,
  Button,
  Group,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useFormState, useFormStatus } from "react-dom";
import {
  createTenantInvitationAction,
  resendTenantInvitationAction,
  revokeTenantInvitationAction,
  type InvitationActionState,
} from "@/app/admin/invitations/actions";

const initialState: InvitationActionState = { status: "idle", message: "" };

export type TenantInvitation = {
  id: string;
  invited_email: string;
  intended_role: string;
  status: string;
  delivery_status: string;
  created_at: string;
  expires_at: string;
  last_sent_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
};

function ActionButton({
  children,
  color,
  variant,
}: {
  children: React.ReactNode;
  color?: string;
  variant?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="xs"
      loading={pending}
      color={color}
      variant={variant}
    >
      {children}
    </Button>
  );
}

function InvitationRow({ invitation }: { invitation: TenantInvitation }) {
  const [resendState, resendAction] = useFormState(
    resendTenantInvitationAction,
    initialState
  );
  const [revokeState, revokeAction] = useFormState(
    revokeTenantInvitationAction,
    initialState
  );
  const pending = invitation.status === "pending";
  const feedback =
    resendState.status !== "idle" ? resendState : revokeState;

  return (
    <Table.Tr>
      <Table.Td>
        <Text fw={600}>{invitation.invited_email}</Text>
        <Text size="xs" c="dimmed">
          Created {new Date(invitation.created_at).toLocaleString()}
        </Text>
        {feedback.status !== "idle" && (
          <Alert
            mt="xs"
            py="xs"
            color={
              feedback.status === "error"
                ? "red"
                : feedback.status === "warning"
                  ? "yellow"
                  : "green"
            }
          >
            {feedback.message}
          </Alert>
        )}
      </Table.Td>
      <Table.Td>{invitation.intended_role}</Table.Td>
      <Table.Td>
        <Badge
          color={
            invitation.status === "pending"
              ? "blue"
              : invitation.status === "accepted"
                ? "green"
                : "gray"
          }
        >
          {invitation.status}
        </Badge>
        <Text size="xs" c="dimmed" mt="xs">
          Delivery: {invitation.delivery_status}
        </Text>
      </Table.Td>
      <Table.Td>{new Date(invitation.expires_at).toLocaleString()}</Table.Td>
      <Table.Td>
        {pending ? (
          <Group gap="xs">
            <form action={resendAction}>
              <input type="hidden" name="invitationId" value={invitation.id} />
              <ActionButton variant="light">Resend</ActionButton>
            </form>
            <form action={revokeAction}>
              <input type="hidden" name="invitationId" value={invitation.id} />
              <ActionButton color="red" variant="light">
                Revoke
              </ActionButton>
            </form>
          </Group>
        ) : (
          <Text size="xs" c="dimmed" mt="xs">
            No pending actions
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

export function InvitationManager({
  invitations,
  actorRole,
}: {
  invitations: TenantInvitation[];
  actorRole: "admin" | "owner";
}) {
  const [createState, createAction] = useFormState(
    createTenantInvitationAction,
    initialState
  );
  const roles =
    actorRole === "owner"
      ? ["member", "admin", "owner"]
      : ["member", "admin"];

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <form action={createAction}>
          <Stack>
            <Title order={3}>Create invitation</Title>
            {createState.status !== "idle" && (
              <Alert
                color={
                  createState.status === "error"
                    ? "red"
                    : createState.status === "warning"
                      ? "yellow"
                      : "green"
                }
              >
                {createState.message}
              </Alert>
            )}
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                name="email"
                type="email"
                label="Invited email"
                required
              />
              <NativeSelect
                name="intendedRole"
                label="Tenant role"
                data={roles}
                defaultValue="member"
              />
              <TextInput
                name="expiresInDays"
                type="number"
                label="Expires in days"
                min={1}
                max={30}
                defaultValue={7}
                required
              />
            </SimpleGrid>
            <ActionButton>Send invitation</ActionButton>
          </Stack>
        </form>
      </Paper>

      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={1000}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Recipient</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Expires</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {invitations.map((invitation) => (
                <InvitationRow key={invitation.id} invitation={invitation} />
              ))}
              {invitations.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="xl">
                      No invitations yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
