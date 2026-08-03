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
  Database["public"]["Functions"]["tenant_audit_events"]["Returns"][number];

export function TenantAuditTable({ events }: { events: AuditEvent[] }) {
  const t = useTranslations("Admin.auditTable");
  const format = useFormatter();
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <TableScrollContainer minWidth={1100}>
        <Table striped highlightOnHover>
          <TableThead>
            <TableTr>
              <TableTh>{t("time")}</TableTh><TableTh>{t("action")}</TableTh>
              <TableTh>{t("actor")}</TableTh><TableTh>{t("target")}</TableTh>
              <TableTh>{t("requestId")}</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {events.map((event) => (
              <TableTr key={event.id}>
                <TableTd>{format.dateTime(new Date(event.created_at), "dateTime")}</TableTd>
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
            {events.length === 0 ? (
              <TableTr>
                <TableTd colSpan={5}>
                  <Text ta="center" c="dimmed" py="xl">
                    {t("none")}
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
