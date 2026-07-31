"use client";

import { Badge, Paper, Table, Text } from "@mantine/core";
import type { Database } from "@/types/database";

type AuditEvent =
  Database["public"]["Functions"]["tenant_audit_events"]["Returns"][number];

export function TenantAuditTable({ events }: { events: AuditEvent[] }) {
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <Table.ScrollContainer minWidth={1100}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Action</Table.Th>
              <Table.Th>Actor</Table.Th>
              <Table.Th>Target</Table.Th>
              <Table.Th>Request ID</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {events.map((event) => (
              <Table.Tr key={event.id}>
                <Table.Td>
                  {new Date(event.created_at).toLocaleString()}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{event.action}</Badge>
                </Table.Td>
                <Table.Td>
                  {event.actor_email ?? event.actor_id ?? "System"}
                </Table.Td>
                <Table.Td>
                  {event.target_type}
                  {event.target_id ? ` / ${event.target_id}` : ""}
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="xs">
                    {event.request_id}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
            {events.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed" py="xl">
                    No sensitive actions have been recorded.
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
