import "server-only";

type InvitationEmail = {
  to: string;
  tenantName: string;
  intendedRole: string;
  invitationUrl: string;
  expiresAt: string;
};

export type InvitationEmailResult =
  | { ok: true }
  | { ok: false; error: string };

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendTenantInvitationEmail(
  invitation: InvitationEmail
): Promise<InvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITATION_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Email delivery is not configured. Set RESEND_API_KEY and INVITATION_FROM_EMAIL.",
    };
  }

  const tenantName = escapeHtml(invitation.tenantName);
  const role = escapeHtml(invitation.intendedRole);
  const invitationUrl = escapeHtml(invitation.invitationUrl);
  const expiresAt = escapeHtml(
    new Date(invitation.expiresAt).toLocaleString("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    })
  );

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [invitation.to],
        subject: "Invitation to join " + invitation.tenantName,
        html: [
          "<p>You have been invited to join <strong>" + tenantName + "</strong>",
          " as a <strong>" + role + "</strong>.</p>",
          '<p><a href="' + invitationUrl + '">Accept invitation</a></p>',
          "<p>This single-use link expires at " + expiresAt + " UTC.</p>",
        ].join(""),
        text: [
          "You have been invited to join " +
            invitation.tenantName +
            " as " +
            invitation.intendedRole +
            ".",
          "Accept invitation: " + invitation.invitationUrl,
          "This single-use link expires at " + invitation.expiresAt + ".",
        ].join("\n\n"),
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: "Email provider returned HTTP " + response.status + ".",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Email provider request failed." };
  }
}
