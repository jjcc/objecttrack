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
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function OperationsTenantsPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const t = await getTranslations("Ops.tenants");
  const query = searchParams?.q?.trim() ?? "";
  const { supabase } = await requirePlatformAccess("platform.tenants.update");
  const { data: tenants, error } = await supabase.rpc("platform_tenants", {
    p_search: query || undefined,
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("description")}
          </Text>
        </div>
        <Button component={Link} href="/ops/tenants/new">
          {t("create")}
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md">
        <form method="get">
          <Group align="end">
            <TextInput
              name="q"
              label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              defaultValue={query}
              style={{ flex: 1 }}
            />
            <Button type="submit" variant="light">
              {t("search")}
            </Button>
          </Group>
        </form>
      </Paper>

      {error && (
        <Alert color="red" title={t("loadFailedTitle")}>
          {t("loadFailed")}
        </Alert>
      )}

      <OperationsTenantsTable
        tenants={tenants ?? []}
        hasError={Boolean(error)}
      />
    </Stack>
  );
}
