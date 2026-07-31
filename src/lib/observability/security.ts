import "server-only";

type SecurityEvent = {
  event: "authorization_denied" | "mfa_required";
  area: "tenant_admin" | "platform_ops";
  permission: string;
  actorId?: string;
  reason: string;
};

export function logSecurityEvent(event: SecurityEvent): void {
  console.warn(
    JSON.stringify({
      level: "warning",
      category: "security",
      timestamp: new Date().toISOString(),
      ...event,
    })
  );
}
