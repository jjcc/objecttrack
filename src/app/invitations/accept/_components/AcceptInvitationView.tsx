"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Anchor,
  Button,
  Center,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import {
  acceptInvitationAction,
  type AcceptInvitationState,
} from "@/app/invitations/accept/actions";
import { getSupabaseClient } from "@/lib/supabase/client";

const initialState: AcceptInvitationState = { status: "idle", code: "" };

function AcceptButton() {
  const t = useTranslations("Invitations.accept");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {t("accept")}
    </Button>
  );
}

export function AcceptInvitationView({
  token,
  status,
  tenantName,
  maskedEmail,
  authenticated,
  signedInEmail,
  emailMatches,
}: {
  token: string;
  status: string;
  tenantName: string | null;
  maskedEmail: string | null;
  authenticated: boolean;
  signedInEmail: string | null;
  emailMatches: boolean;
}) {
  const t = useTranslations("Invitations.accept");
  const router = useRouter();
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [state, action] = useFormState(acceptInvitationAction, initialState);
  const nextPath =
    "/invitations/accept?token=" + encodeURIComponent(token);
  const loginHref = "/login?next=" + encodeURIComponent(nextPath);
  const registerHref = "/register?next=" + encodeURIComponent(nextPath);

  async function switchAccount() {
    setIsSwitchingAccount(true);
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.refresh();
    setIsSwitchingAccount(false);
  }

  return (
    <Center mih="100vh" bg="gray.1" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" maw={520} w="100%">
        <Stack>
          <Title order={2}>{t("title")}</Title>

          {status === "invalid" && (
            <Alert color="red" title={t("invalidTitle")}>
              {t("invalid")}
            </Alert>
          )}
          {status === "expired" && (
            <Alert color="yellow" title={t("expiredTitle")}>
              {t("expired")}
            </Alert>
          )}
          {status === "revoked" && (
            <Alert color="red" title={t("revokedTitle")}>
              {t("revoked")}
            </Alert>
          )}
          {status === "accepted" && (
            <Alert color="green" title={t("acceptedTitle")}>
              {t("alreadyAccepted")}
            </Alert>
          )}

          {status === "pending" && (
            <>
              <Text>{t.rich("description", { tenant: () => <strong>{tenantName}</strong>, email: maskedEmail ?? t("invitedEmail") })}</Text>
              {state.status === "error" && (
                <Alert color="red" title={t("unableTitle")}>
                  {state.code ? t(`errors.${state.code}`) : t("errors.failed")}
                </Alert>
              )}
              {authenticated ? (
                emailMatches ? (
                  <form action={action}>
                    <input type="hidden" name="token" value={token} />
                    <AcceptButton />
                  </form>
                ) : (
                  <Stack gap="xs">
                    <Alert color="yellow" title={t("wrongAccountTitle")}>
                      {t("wrongAccount", {
                        email: signedInEmail ?? t("unknownEmail"),
                      })}
                    </Alert>
                    <Button
                      type="button"
                      variant="outline"
                      loading={isSwitchingAccount}
                      onClick={switchAccount}
                    >
                      {t("switchAccount")}
                    </Button>
                  </Stack>
                )
              ) : (
                <Stack gap="xs">
                  <Button component={Link} href={loginHref}>
                    {t("signIn")}
                  </Button>
                  <Anchor component={Link} href={registerHref} ta="center">
                    {t("register")}
                  </Anchor>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
