import { Anchor, Breadcrumbs, Stack, Title, Paper, Text } from "@mantine/core";
import { AppShell } from "@/components/layout/AppShell";

export default function ScanPage() {
  return (
    <AppShell>
      <Stack gap="lg">
        <Breadcrumbs>
          <Anchor href="/dashboard">Dashboard</Anchor>
          <Anchor href="/scan">Scan</Anchor>
        </Breadcrumbs>

        <Title order={2}>Scan QR Code</Title>

        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="md">
            <Text size="lg" ta="center">
              Use mobile browser to open an object&apos;s QR image, or use the device
              camera to scan the API link.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    </AppShell>
  );
}
