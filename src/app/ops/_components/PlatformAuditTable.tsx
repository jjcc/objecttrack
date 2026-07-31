"use client";

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

type AuditEvent =
  Database["public"]["Functions"]["platform_audit_events"]["Returns"][number];

export function PlatformAuditTable({ events }: { events: AuditEvent[] }) {
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <TableScrollContainer minWidth={1200}>
        <Table striped highlightOnHover>
          <TableThead>
            <TableTr>
              <TableTh>Time</TableTh>
              <TableTh>Tenant</TableTh>
              <TableTh>Action</TableTh>
              <TableTh>Actor</TableTh>
              <TableTh>Target</TableTh>
              <TableTh>Request ID</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {events.map((event) => (
              <TableTr key={event.id}>
                <TableTd>{new Date(event.created_at).toLocaleString()}</TableTd>
                <TableTd>{event.tenant_id ?? "Platform"}</TableTd>
                <TableTd>
                  <Badge variant="light">{event.action}</Badge>
                </TableTd>
                <TableTd>
                  {event.actor_email ?? event.actor_id ?? "System"}
                </TableTd>
                <TableTd>
                  {event.target_type}
                  {event.target_id ? ` / ${event.target_id}` : ""}
                </TableTd>
                <TableTd>
                  <Text ff="monospace" size="xs">
                    {event.request_id}
                  </Text>
                </TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      </TableScrollContainer>
    </Paper>
  );
}
