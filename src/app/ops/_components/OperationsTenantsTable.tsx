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
import { useFormatter, useTranslations } from "next-intl";

type Tenant =
  Database["public"]["Functions"]["platform_tenants"]["Returns"][number];

export function OperationsTenantsTable({
  tenants,
  hasError,
}: {
  tenants: Tenant[];
  hasError: boolean;
}) {
  const t = useTranslations("Ops.tenantTable");
  const format = useFormatter();
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <TableScrollContainer minWidth={850}>
        <Table striped highlightOnHover>
          <TableThead>
            <TableTr>
              <TableTh>{t("institution")}</TableTh>
              <TableTh>{t("status")}</TableTh>
              <TableTh>{t("ownerInvitation")}</TableTh>
              <TableTh>{t("defaults")}</TableTh>
              <TableTh>{t("created")}</TableTh>
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
                    {tenant.email ?? t("noInstitutionEmail")}
                  </Text>
                </TableTd>
                <TableTd>
                  <Badge color={tenant.status === "active" ? "green" : "red"}>
                    {t(
                      tenant.status === "active"
                        ? "statuses.active"
                        : "statuses.suspended"
                    )}
                  </Badge>
                </TableTd>
                <TableTd>
                  {tenant.initial_owner_email ?? t("legacyTenant")}
                </TableTd>
                <TableTd>v{tenant.defaults_version}</TableTd>
                <TableTd>
                  {format.dateTime(new Date(tenant.created_at), "short")}
                </TableTd>
              </TableTr>
            ))}
            {!hasError && tenants.length === 0 ? (
              <TableTr>
                <TableTd colSpan={5}>
                  <Text ta="center" c="dimmed" py="xl">
                    {t("empty")}
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
