import { Badge, Paper, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { requirePlatformAccess } from "@/lib/ops/access";

export default async function PlatformAuditPage() {
  const { supabase } = await requirePlatformAccess("platform.audit.read");
  const [metricsResult, auditResult] = await Promise.all([
    supabase.rpc("platform_operational_metrics"),
    supabase.rpc("platform_audit_events", { p_limit: 100 }),
  ]);
  if (metricsResult.error) throw new Error(metricsResult.error.message);
  if (auditResult.error) throw new Error(auditResult.error.message);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Audit & monitoring</Title>
        <Text c="dimmed" size="sm">
          Cross-tenant operational events and failure indicators. AAL2 is required.
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {(metricsResult.data ?? []).map((metric) => (
          <Paper withBorder p="md" radius="md" key={metric.metric}>
            <Text size="xs" c="dimmed">
              {metric.metric.replaceAll("_", " ")}
            </Text>
            <Text fw={700} size="xl">
              {metric.value}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
        <Table.ScrollContainer minWidth={1200}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Tenant</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Actor</Table.Th>
                <Table.Th>Target</Table.Th>
                <Table.Th>Request ID</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(auditResult.data ?? []).map((event) => (
                <Table.Tr key={event.id}>
                  <Table.Td>
                    {new Date(event.created_at).toLocaleString()}
                  </Table.Td>
                  <Table.Td>{event.tenant_id ?? "Platform"}</Table.Td>
                  <Table.Td>
                    <Badge variant="light">{event.action}</Badge>
                  </Table.Td>
                  <Table.Td>{event.actor_email ?? event.actor_id ?? "System"}</Table.Td>
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
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
