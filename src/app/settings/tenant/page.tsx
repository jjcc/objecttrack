import { redirect } from "next/navigation";

export default function LegacyTenantSettingsPage() {
  redirect("/admin/profile");
}
