"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/types/database";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";
import { getTranslations } from "next-intl/server";

export type TenantAdminActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

const optionalEmail = z.union([z.literal(""), z.string().trim().email()]);
const optionalUrl = z.union([z.literal(""), z.string().trim().url()]);

const profileSchema = z.object({
  institutionName: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000),
  address: z.string().trim().max(1000),
  contact: z.string().trim().max(500),
  phone: z.string().trim().max(100),
  email: optionalEmail,
  website: optionalUrl,
  socialMedia: z.string().trim().max(10000),
  publicObjectInfo: z.boolean(),
});

const workspaceSchema = z.object({
  workspaceKind: z.enum(["family", "business", "club", "other"]),
  memberVisibility: z.enum(["private", "shared"]),
});

const roleSchema = z.object({
  userId: z.string().uuid(),
  tenantRole: z.enum(["viewer", "member", "admin", "owner"]),
});

const removalSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.literal("confirmed"),
});

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateCurrentTenantProfileAction(
  _previousState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  const t = await getTranslations("Admin.actions");
  const parsed = profileSchema.safeParse({
    institutionName: formValue(formData, "institutionName"),
    description: formValue(formData, "description"),
    address: formValue(formData, "address"),
    contact: formValue(formData, "contact"),
    phone: formValue(formData, "phone"),
    email: formValue(formData, "email"),
    website: formValue(formData, "website"),
    socialMedia: formValue(formData, "socialMedia"),
    publicObjectInfo: formData.get("publicObjectInfo") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: t("invalidValues") };
  }

  let socialMedia: Json = {};
  if (parsed.data.socialMedia) {
    try {
      const candidate: unknown = JSON.parse(parsed.data.socialMedia);
      if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
        return { status: "error", message: t("socialObject") };
      }
      socialMedia = candidate as Json;
    } catch {
      return { status: "error", message: t("socialJson") };
    }
  }

  try {
    const { supabase } = await requireTenantAdminAccess(
      "tenant.settings.update"
    );
    const { error } = await supabase.rpc("update_current_tenant_profile", {
      p_institution_name: parsed.data.institutionName,
      p_description: parsed.data.description || undefined,
      p_address: parsed.data.address || undefined,
      p_contact: parsed.data.contact || undefined,
      p_phone: parsed.data.phone || undefined,
      p_email: parsed.data.email || undefined,
      p_website: parsed.data.website || undefined,
      p_social_media: socialMedia,
      p_show_object_info_without_authentication: parsed.data.publicObjectInfo,
    });
    if (error) throw new Error(error.message);
  } catch {
    return { status: "error", message: t("failed") };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/profile");
  return { status: "success", message: t("profileUpdated") };
}

export async function updateCurrentTenantWorkspaceAction(
  _previousState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  const t = await getTranslations("Admin.actions");
  const parsed = workspaceSchema.safeParse({
    workspaceKind: formValue(formData, "workspaceKind"),
    memberVisibility: formValue(formData, "memberVisibility"),
  });
  if (!parsed.success) {
    return { status: "error", message: t("invalidValues") };
  }

  try {
    const { supabase } = await requireTenantAdminAccess(
      "tenant.settings.update"
    );
    const { error } = await supabase.rpc("update_current_tenant_workspace", {
      p_workspace_kind: parsed.data.workspaceKind,
      p_member_visibility: parsed.data.memberVisibility,
    });
    if (error) throw new Error(error.message);
  } catch {
    return { status: "error", message: t("failed") };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/profile");
  return { status: "success", message: t("workspaceUpdated") };
}

export async function updateTenantMemberRoleAction(
  _previousState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  const t = await getTranslations("Admin.actions");
  const parsed = roleSchema.safeParse({
    userId: formValue(formData, "userId"),
    tenantRole: formValue(formData, "tenantRole"),
  });
  if (!parsed.success) {
    return { status: "error", message: t("invalidValues") };
  }

  try {
    const { supabase } = await requireTenantAdminAccess(
      "tenant.users.roles.update"
    );
    const { error } = await supabase.rpc("update_tenant_member_role", {
      p_user_id: parsed.data.userId,
      p_tenant_role: parsed.data.tenantRole,
    });
    if (error) throw new Error(error.message);
  } catch {
    return { status: "error", message: t("failed") };
  }

  revalidatePath("/admin/members");
  return { status: "success", message: t("roleUpdated") };
}

export async function removeTenantMemberAction(
  _previousState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  const t = await getTranslations("Admin.actions");
  const parsed = removalSchema.safeParse({
    userId: formValue(formData, "userId"),
    confirmation: formValue(formData, "confirmation"),
  });
  if (!parsed.success) {
    return { status: "error", message: t("invalidValues") };
  }

  try {
    const { supabase } = await requireTenantAdminAccess(
      "tenant.users.roles.update"
    );
    const { error } = await supabase.rpc("remove_tenant_member", {
      p_user_id: parsed.data.userId,
    });
    if (error) throw new Error(error.message);
  } catch {
    return { status: "error", message: t("failed") };
  }

  revalidatePath("/admin/members");
  return { status: "success", message: t("memberRemoved") };
}
