import Link from "next/link";
import { redirect } from "next/navigation";
import { Anchor, Container, Group, Text, Title } from "@mantine/core";
import { AuthorizationError } from "@/lib/auth/tenant-context";
import { requirePlatformAccess } from "@/lib/ops/access";

export default async function OperationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let authorized = false;
  let mfaRequired = false;
  try {
    const { supabase } = await requirePlatformAccess("platform.tenants.update");
    const { error: auditError } = await supabase.rpc(
      "record_platform_operator_access",
      { p_path: "/ops" }
    );
    if (auditError) throw new Error(auditError.message);
    authorized = true;
  } catch (error) {
    if (error instanceof AuthorizationError && error.code === "mfa_required") {
      mfaRequired = true;
    }
    if (!(error instanceof AuthorizationError)) throw error;
  }

  if (mfaRequired) redirect("/mfa?next=/ops");
  if (!authorized) redirect("/unauthorized");

  return (
    <>
      <header
        style={{
          borderBottom: "1px solid var(--mantine-color-gray-3)",
          padding: "16px 24px",
        }}
      >
        <Group justify="space-between">
          <div>
            <Title order={3}>Platform Operations</Title>
            <Text size="xs" c="dimmed">
              Internal control plane
            </Text>
          </div>
          <Group>
            <Anchor component={Link} href="/ops">
              Tenants
            </Anchor>
            <Anchor component={Link} href="/ops/audit">
              Audit & monitoring
            </Anchor>
            <Anchor component={Link} href="/dashboard">
              Customer application
            </Anchor>
          </Group>
        </Group>
      </header>
      <Container size="xl" py="xl">
        {children}
      </Container>
    </>
  );
}
