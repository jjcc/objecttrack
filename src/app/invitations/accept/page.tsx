import { AcceptInvitationView } from "@/app/invitations/accept/_components/AcceptInvitationView";
import { hashInvitationToken } from "@/lib/invitations/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token ?? "";
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let status = "invalid";
  let tenantName: string | null = null;
  let maskedEmail: string | null = null;
  let invitedEmail: string | null = null;

  if (token.length >= 20 && token.length <= 500) {
    const { data } = await supabase.rpc("invitation_link_status", {
      p_token_hash: hashInvitationToken(token),
    });
    const invitation = data?.[0];
    if (invitation) {
      status = invitation.status;
      tenantName = invitation.tenant_name;
      maskedEmail = invitation.invited_email_masked;
    }

    if (status === "pending") {
      const { data: registrationData } = await supabase.rpc(
        "invitation_registration_context",
        { p_token_hash: hashInvitationToken(token) }
      );
      invitedEmail = registrationData?.[0]?.invited_email ?? null;
    }
  }

  const signedInEmail = user?.email ?? null;
  const emailMatches =
    !signedInEmail ||
    !invitedEmail ||
    signedInEmail.toLowerCase() === invitedEmail.toLowerCase();

  return (
    <AcceptInvitationView
      token={token}
      status={status}
      tenantName={tenantName}
      maskedEmail={maskedEmail}
      authenticated={Boolean(user)}
      signedInEmail={signedInEmail}
      emailMatches={emailMatches}
    />
  );
}
