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
import { useFormatter, useTranslations } from "next-intl";

type AuditEvent =
  Database["public"]["Functions"]["platform_audit_events"]["Returns"][number];

export function PlatformAuditTable({ events }: { events: AuditEvent[] }) {
  const t = useTranslations("Ops.auditTable");
  const format = useFormatter();
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <TableScrollContainer minWidth={1200}>
        <Table striped highlightOnHover>
          <TableThead>
            <TableTr>
              <TableTh>{t("time")}</TableTh>
              <TableTh>{t("tenant")}</TableTh>
              <TableTh>{t("action")}</TableTh>
              <TableTh>{t("actor")}</TableTh>
              <TableTh>{t("target")}</TableTh>
              <TableTh>{t("requestId")}</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {events.map((event) => (
              <TableTr key={event.id}>
                <TableTd>{format.dateTime(new Date(event.created_at), "dateTime")}</TableTd>
                <TableTd>{event.tenant_id ?? t("platform")}</TableTd>
                <TableTd>
                  <Badge variant="light">{event.action}</Badge>
                </TableTd>
                <TableTd>
                  {event.actor_email ?? event.actor_id ?? t("system")}
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
