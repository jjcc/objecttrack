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
import { useFormatter, useTranslations } from "next-intl";
import {
  createTenantInvitationAction,
  resendTenantInvitationAction,
  revokeTenantInvitationAction,
  type InvitationActionState,
} from "@/app/admin/invitations/actions";
import type { TenantRole } from "@/lib/auth/permissions";

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
  const t = useTranslations("Admin.invitationManager");
  const format = useFormatter();
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
          {t("createdAt", { date: format.dateTime(new Date(invitation.created_at), "dateTime") })}
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
      <Table.Td>{invitation.intended_role === "viewer" || invitation.intended_role === "member" || invitation.intended_role === "admin" || invitation.intended_role === "owner" ? t(`roles.${invitation.intended_role}`) : invitation.intended_role}</Table.Td>
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
          {invitation.status === "pending" || invitation.status === "accepted" || invitation.status === "revoked" || invitation.status === "expired" ? t(`statuses.${invitation.status}`) : invitation.status}
        </Badge>
        <Text size="xs" c="dimmed" mt="xs">
          {t("delivery")}: {invitation.delivery_status === "pending" || invitation.delivery_status === "sent" || invitation.delivery_status === "failed" ? t(`deliveryStatuses.${invitation.delivery_status}`) : invitation.delivery_status}
        </Text>
      </Table.Td>
      <Table.Td>{format.dateTime(new Date(invitation.expires_at), "dateTime")}</Table.Td>
      <Table.Td>
        {pending ? (
          <Group gap="xs">
            <form action={resendAction}>
              <input type="hidden" name="invitationId" value={invitation.id} />
              <ActionButton variant="light">{t("resend")}</ActionButton>
            </form>
            <form action={revokeAction}>
              <input type="hidden" name="invitationId" value={invitation.id} />
              <ActionButton color="red" variant="light">
                {t("revoke")}
              </ActionButton>
            </form>
          </Group>
        ) : (
          <Text size="xs" c="dimmed" mt="xs">
            {t("noPendingActions")}
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

export function InvitationManager({
  invitations,
  allowedRoles,
}: {
  invitations: TenantInvitation[];
  allowedRoles: TenantRole[];
}) {
  const t = useTranslations("Admin.invitationManager");
  const [createState, createAction] = useFormState(
    createTenantInvitationAction,
    initialState
  );
  const roles = allowedRoles.map((role) => ({ value: role, label: t(`roles.${role}`) }));

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <form action={createAction}>
          <Stack>
            <Title order={3}>{t("createTitle")}</Title>
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
                label={t("email")}
                required
              />
              <NativeSelect
                name="intendedRole"
                label={t("tenantRole")}
                data={roles}
                defaultValue="member"
              />
              <TextInput
                name="expiresInDays"
                type="number"
                label={t("expiresInDays")}
                min={1}
                max={30}
                defaultValue={7}
                required
              />
            </SimpleGrid>
            <ActionButton>{t("send")}</ActionButton>
          </Stack>
        </form>
      </Paper>

      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={1000}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("recipient")}</Table.Th><Table.Th>{t("role")}</Table.Th>
                <Table.Th>{t("status")}</Table.Th><Table.Th>{t("expires")}</Table.Th>
                <Table.Th>{t("actions")}</Table.Th>
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
                      {t("none")}
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
