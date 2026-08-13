"use client";

import {
  Alert,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  Paper,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import {
  removeTenantMemberAction,
  updateTenantMemberRoleAction,
  type TenantAdminActionState,
} from "@/app/admin/actions";
import type { TenantRole } from "@/lib/auth/permissions";

const initialState: TenantAdminActionState = { status: "idle", message: "" };

export type TenantMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title: string | null;
  tenant_role: string;
  created_at: string;
};

function PendingButton({
  children,
  color,
  disabled,
}: {
  children: React.ReactNode;
  color?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="xs" loading={pending} color={color} disabled={disabled}>
      {children}
    </Button>
  );
}

function MemberRow({
  member,
  actorRole,
  actorId,
  allowedRoles,
}: {
  member: TenantMember;
  actorRole: "admin" | "owner";
  actorId: string;
  allowedRoles: TenantRole[];
}) {
  const t = useTranslations("Admin.membersTable");
  const [roleState, roleAction] = useFormState(
    updateTenantMemberRoleAction,
    initialState
  );
  const [removeState, removeAction] = useFormState(
    removeTenantMemberAction,
    initialState
  );
  const roleValues = allowedRoles.includes(member.tenant_role as TenantRole)
    ? allowedRoles
    : [...allowedRoles, member.tenant_role as TenantRole];
  const roles = roleValues.map((role) => ({ value: role, label: t(`roles.${role}`) }));
  const isSelf = member.id === actorId;
  const ownerProtected = actorRole !== "owner" && member.tenant_role === "owner";

  return (
    <Table.Tr>
      <Table.Td>
        <Text fw={600}>
          {[member.first_name, member.last_name].filter(Boolean).join(" ") ||
            member.email ||
            member.id}
        </Text>
        <Text size="xs" c="dimmed">
          {member.email ?? member.id}
        </Text>
        {(roleState.status === "error" || removeState.status === "error") && (
          <Alert color="red" mt="xs" py="xs">
            {roleState.status === "error"
              ? roleState.message
              : removeState.message}
          </Alert>
        )}
        {(roleState.status === "success" || removeState.status === "success") && (
          <Text size="xs" c="green" mt="xs">
            {roleState.status === "success"
              ? roleState.message
              : removeState.message}
          </Text>
        )}
      </Table.Td>
      <Table.Td>{member.title ?? "—"}</Table.Td>
      <Table.Td>
        <form action={roleAction}>
          <input type="hidden" name="userId" value={member.id} />
          <Group gap="xs" wrap="nowrap">
            <NativeSelect
              name="tenantRole"
              defaultValue={member.tenant_role}
              data={roles}
              size="xs"
              disabled={
                isSelf ||
                ownerProtected
              }
            />
            <PendingButton>{t("save")}</PendingButton>
          </Group>
        </form>
      </Table.Td>
      <Table.Td>
        <form action={removeAction}>
          <Stack gap="xs">
            <input type="hidden" name="userId" value={member.id} />
            <Checkbox
              name="confirmation"
              value="confirmed"
              label={t("confirm")}
              size="xs"
              disabled={isSelf || ownerProtected}
              required
            />
            <PendingButton color="red" disabled={isSelf || ownerProtected}>
              {t("remove")}
            </PendingButton>
          </Stack>
        </form>
      </Table.Td>
    </Table.Tr>
  );
}

export function TenantMembersTable({
  members,
  actorRole,
  actorId,
  allowedRoles,
}: {
  members: TenantMember[];
  actorRole: "admin" | "owner";
  actorId: string;
  allowedRoles: TenantRole[];
}) {
  const t = useTranslations("Admin.membersTable");
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <Table.ScrollContainer minWidth={850}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("member")}</Table.Th><Table.Th>{t("title")}</Table.Th>
              <Table.Th>{t("tenantRole")}</Table.Th><Table.Th>{t("removeMembership")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                actorRole={actorRole}
                actorId={actorId}
                allowedRoles={allowedRoles}
              />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
