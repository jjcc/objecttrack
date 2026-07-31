"use client";

import Link from "next/link";
import {
  Badge,
  Paper,
  Table,
  TableScrollContainer,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from "@mantine/core";
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
      <TableScrollContainer minWidth={850}>
        <Table striped highlightOnHover>
          <TableThead>
            <TableTr>
              <TableTh>Institution</TableTh>
              <TableTh>Status</TableTh>
              <TableTh>Owner invitation</TableTh>
              <TableTh>Defaults</TableTh>
              <TableTh>Created</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {tenants.map((tenant) => (
              <TableTr key={tenant.id}>
                <TableTd>
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
                </TableTd>
                <TableTd>
                  <Badge color={tenant.status === "active" ? "green" : "red"}>
                    {tenant.status}
                  </Badge>
                </TableTd>
                <TableTd>
                  {tenant.initial_owner_email ?? "Legacy tenant"}
                </TableTd>
                <TableTd>v{tenant.defaults_version}</TableTd>
                <TableTd>
                  {new Date(tenant.created_at).toLocaleDateString()}
                </TableTd>
              </TableTr>
            ))}
            {!hasError && tenants.length === 0 ? (
              <TableTr>
                <TableTd colSpan={5}>
                  <Text ta="center" c="dimmed" py="xl">
                    No tenants found.
                  </Text>
                </TableTd>
              </TableTr>
            ) : null}
          </TableTbody>
        </Table>
      </TableScrollContainer>
    </Paper>
  );
}
