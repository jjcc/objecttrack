import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { requirePlatformAccess } from "@/lib/ops/access";

export const dynamic = "force-dynamic";

export default async function OperationsTenantsPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const query = searchParams?.q?.trim() ?? "";
  const { supabase } = await requirePlatformAccess("platform.tenants.update");
  const { data: tenants, error } = await supabase.rpc("platform_tenants", {
    p_search: query || undefined,
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>Tenants</Title>
          <Text c="dimmed" size="sm">
            Search, inspect, provision, and control tenant status.
          </Text>
        </div>
        <Button component={Link} href="/ops/tenants/new">
          Create tenant
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md">
        <form method="get">
          <Group align="end">
            <TextInput
              name="q"
              label="Search tenants"
              placeholder="Institution or email"
              defaultValue={query}
              style={{ flex: 1 }}
            />
            <Button type="submit" variant="light">
              Search
            </Button>
          </Group>
        </form>
      </Paper>

      {error && (
        <Alert color="red" title="Unable to load tenants">
          {error.message}
        </Alert>
      )}

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
              {(tenants ?? []).map((tenant) => (
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
                  <Table.Td>{tenant.initial_owner_email ?? "Legacy tenant"}</Table.Td>
                  <Table.Td>v{tenant.defaults_version}</Table.Td>
                  <Table.Td>
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </Table.Td>
                </Table.Tr>
              ))}
              {!error && (tenants?.length ?? 0) === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="xl">
                      No tenants found.
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
