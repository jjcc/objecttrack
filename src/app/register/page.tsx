import {
  Alert,
  Anchor,
  Center,
  Paper,
  Stack,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/app/register/_components/RegisterForm";
import { hashInvitationToken } from "@/lib/invitations/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeNextPath(value?: string): string | null {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

function invitationToken(nextPath: string | null): string | null {
  if (!nextPath) return null;

  const url = new URL(nextPath, "https://objecttrack.local");
  if (url.pathname !== "/invitations/accept") return null;

  const token = url.searchParams.get("token");
  return token && token.length >= 20 && token.length <= 500 ? token : null;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const t = await getTranslations("Auth.register");
  const nextPath = safeNextPath(searchParams?.next);
  const token = invitationToken(nextPath);
  let invitation: {
    invitedEmail: string;
    tenantName: string;
  } | null = null;

  if (token) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.rpc("invitation_registration_context", {
      p_token_hash: hashInvitationToken(token),
    });
    const context = data?.[0];

    if (
      context?.status === "pending" &&
      context.invited_email &&
      context.tenant_name
    ) {
      invitation = {
        invitedEmail: context.invited_email,
        tenantName: context.tenant_name,
      };
    }
  }

  if (!invitation || !nextPath) {
    return (
      <Center h="100vh" bg="gray.1" px="md">
        <Paper shadow="md" p={30} radius="md" w={420}>
          <Stack>
            <Title order={2}>{t("invitationRequiredTitle")}</Title>
            <Alert color="yellow">{t("invitationRequired")}</Alert>
            <Anchor component={Link} href="/login" ta="center">
              {t("backToLogin")}
            </Anchor>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return (
    <RegisterForm
      invitedEmail={invitation.invitedEmail}
      tenantName={invitation.tenantName}
      nextPath={nextPath}
    />
  );
}
