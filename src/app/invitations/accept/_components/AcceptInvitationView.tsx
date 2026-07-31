"use client";

import Link from "next/link";
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
import {
  acceptInvitationAction,
  type AcceptInvitationState,
} from "@/app/invitations/accept/actions";

const initialState: AcceptInvitationState = { status: "idle", message: "" };

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Accept invitation
    </Button>
  );
}

export function AcceptInvitationView({
  token,
  status,
  tenantName,
  maskedEmail,
  authenticated,
}: {
  token: string;
  status: string;
  tenantName: string | null;
  maskedEmail: string | null;
  authenticated: boolean;
}) {
  const [state, action] = useFormState(acceptInvitationAction, initialState);
  const nextPath =
    "/invitations/accept?token=" + encodeURIComponent(token);
  const loginHref = "/login?next=" + encodeURIComponent(nextPath);
  const registerHref = "/register?next=" + encodeURIComponent(nextPath);

  return (
    <Center mih="100vh" bg="gray.1" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" maw={520} w="100%">
        <Stack>
          <Title order={2}>Tenant invitation</Title>

          {status === "invalid" && (
            <Alert color="red" title="Invalid link">
              This invitation link is invalid.
            </Alert>
          )}
          {status === "expired" && (
            <Alert color="yellow" title="Expired link">
              This invitation has expired. Ask the tenant administrator to
              resend it.
            </Alert>
          )}
          {status === "revoked" && (
            <Alert color="red" title="Revoked invitation">
              This invitation was revoked and can no longer be accepted.
            </Alert>
          )}
          {status === "accepted" && (
            <Alert color="green" title="Already accepted">
              This invitation has already been used.
            </Alert>
          )}

          {status === "pending" && (
            <>
              <Text>
                You were invited to join <strong>{tenantName}</strong>. Sign in
                using {maskedEmail ?? "the invited email address"}.
              </Text>
              {state.status === "error" && (
                <Alert color="red" title="Unable to accept">
                  {state.message}
                </Alert>
              )}
              {authenticated ? (
                <form action={action}>
                  <input type="hidden" name="token" value={token} />
                  <AcceptButton />
                </form>
              ) : (
                <Stack gap="xs">
                  <Button component={Link} href={loginHref}>
                    Sign in to accept
                  </Button>
                  <Anchor component={Link} href={registerHref} ta="center">
                    Register with the invited email
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
