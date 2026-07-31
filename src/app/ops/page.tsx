import Link from "next/link";
import {
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { requirePlatformAccess } from "@/lib/ops/access";
import { OperationsTenantsTable } from "./_components/OperationsTenantsTable";

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

      <OperationsTenantsTable
        tenants={tenants ?? []}
        hasError={Boolean(error)}
      />
    </Stack>
  );
}
