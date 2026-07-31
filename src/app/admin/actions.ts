"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/types/database";
import { requireTenantAdminAccess } from "@/lib/tenant-admin/access";

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

const roleSchema = z.object({
  userId: z.string().uuid(),
  tenantRole: z.enum(["member", "admin", "owner"]),
});

const removalSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.literal("confirmed"),
});

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function actionError(error: unknown): TenantAdminActionState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "The operation failed.",
  };
}

function firstValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the submitted values.";
}

export async function updateCurrentTenantProfileAction(
  _previousState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
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
    return { status: "error", message: firstValidationMessage(parsed.error) };
  }

  let socialMedia: Json = {};
  if (parsed.data.socialMedia) {
    try {
      const candidate: unknown = JSON.parse(parsed.data.socialMedia);
      if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
        return { status: "error", message: "Social media must be a JSON object." };
      }
      socialMedia = candidate as Json;
    } catch {
      return { status: "error", message: "Social media must be valid JSON." };
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
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/profile");
  return { status: "success", message: "Tenant profile and settings updated." };
}

export async function updateTenantMemberRoleAction(
  _previousState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  const parsed = roleSchema.safeParse({
    userId: formValue(formData, "userId"),
    tenantRole: formValue(formData, "tenantRole"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstValidationMessage(parsed.error) };
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
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/members");
  return { status: "success", message: "Member role updated." };
}

export async function removeTenantMemberAction(
  _previousState: TenantAdminActionState,
  formData: FormData
): Promise<TenantAdminActionState> {
  const parsed = removalSchema.safeParse({
    userId: formValue(formData, "userId"),
    confirmation: formValue(formData, "confirmation"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstValidationMessage(parsed.error) };
  }

  try {
    const { supabase } = await requireTenantAdminAccess(
      "tenant.users.roles.update"
    );
    const { error } = await supabase.rpc("remove_tenant_member", {
      p_user_id: parsed.data.userId,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/admin/members");
  return { status: "success", message: "Tenant membership removed." };
}
