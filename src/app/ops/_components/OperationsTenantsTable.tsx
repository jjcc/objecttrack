"use client";

import Link from "next/link";
import { Badge, Paper, Table, Text } from "@mantine/core";
import type { Database } from "@/types/database";

type Tenant =
  Database["public"]["Functions"]["platform_tenants"]["Returns"][number];

export function OperationsTenantsTable({
  tenants,
  hasError,
}: {
  tenants: Tenant[];
  hasError: boolean;
}) {
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <Table.ScrollContainer minWidth={850}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Institution</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Owner invitation</Table.Th>
              <Table.Th>Defaults</Table.Th>
              <Table.Th>Created</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tenants.map((tenant) => (
              <Table.Tr key={tenant.id}>
                <Table.Td>
                  <Text
                    component={Link}
                    href={`/ops/tenants/${tenant.id}`}
                    fw={600}
                  >
                    {tenant.institution_name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {tenant.email ?? "No institution email"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={tenant.status === "active" ? "green" : "red"}>
                    {tenant.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {tenant.initial_owner_email ?? "Legacy tenant"}
                </Table.Td>
                <Table.Td>v{tenant.defaults_version}</Table.Td>
                <Table.Td>
                  {new Date(tenant.created_at).toLocaleDateString()}
                </Table.Td>
              </Table.Tr>
            ))}
            {!hasError && tenants.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed" py="xl">
                    No tenants found.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
