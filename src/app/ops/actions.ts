"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlatformAccess } from "@/lib/ops/access";
import type { Json } from "@/types/database";
import { getTranslations } from "next-intl/server";

export type OpsActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

const optionalText = z.string().trim().max(500).optional();
const optionalEmail = z.union([z.literal(""), z.string().trim().email()]).optional();
const optionalUrl = z.union([z.literal(""), z.string().trim().url()]).optional();

const provisionTenantSchema = z.object({
  institutionName: z.string().trim().min(1).max(200),
  ownerEmail: z.string().trim().email(),
  description: z.string().trim().max(4000).optional(),
  address: z.string().trim().max(1000).optional(),
  contact: optionalText,
  phone: z.string().trim().max(100).optional(),
  email: optionalEmail,
  website: optionalUrl,
});

const updateTenantSchema = provisionTenantSchema
  .omit({ ownerEmail: true })
  .extend({
    tenantId: z.coerce.number().int().positive(),
    socialMedia: z.string().trim().max(10000).optional(),
  });

const statusSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(1).max(1000),
  confirmation: z.literal("confirmed"),
});

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function provisionTenantAction(
  _previousState: OpsActionState,
  formData: FormData
): Promise<OpsActionState> {
  const t = await getTranslations("Ops.actions");
  const parsed = provisionTenantSchema.safeParse({
    institutionName: formValue(formData, "institutionName"),
    ownerEmail: formValue(formData, "ownerEmail"),
    description: formValue(formData, "description"),
    address: formValue(formData, "address"),
    contact: formValue(formData, "contact"),
    phone: formValue(formData, "phone"),
    email: formValue(formData, "email"),
    website: formValue(formData, "website"),
  });

  if (!parsed.success) {
    return { status: "error", message: t("invalidValues") };
  }

  let tenantId: number;
  try {
    const { supabase } = await requirePlatformAccess("platform.tenants.create");
    const { data, error } = await supabase.rpc("provision_tenant", {
      p_institution_name: parsed.data.institutionName,
      p_owner_email: parsed.data.ownerEmail,
      p_description: parsed.data.description || undefined,
      p_address: parsed.data.address || undefined,
      p_contact: parsed.data.contact || undefined,
      p_phone: parsed.data.phone || undefined,
      p_email: parsed.data.email || undefined,
      p_website: parsed.data.website || undefined,
    });
    if (error) throw new Error(error.message);
    if (typeof data !== "number") throw new Error("missing_tenant_id");
    tenantId = data;
  } catch {
    return { status: "error", message: t("provisionFailed") };
  }

  revalidatePath("/ops");
  redirect(`/ops/tenants/${tenantId}?created=1`);
}

export async function updateTenantAction(
  _previousState: OpsActionState,
  formData: FormData
): Promise<OpsActionState> {
  const t = await getTranslations("Ops.actions");
  const parsed = updateTenantSchema.safeParse({
    tenantId: formValue(formData, "tenantId"),
    institutionName: formValue(formData, "institutionName"),
    description: formValue(formData, "description"),
    address: formValue(formData, "address"),
    contact: formValue(formData, "contact"),
    phone: formValue(formData, "phone"),
    email: formValue(formData, "email"),
    website: formValue(formData, "website"),
    socialMedia: formValue(formData, "socialMedia"),
  });
  if (!parsed.success) {
    return { status: "error", message: t("invalidValues") };
  }

  let socialMedia: Json = {};
  if (parsed.data.socialMedia) {
    try {
      const candidate: unknown = JSON.parse(parsed.data.socialMedia);
      if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
        return { status: "error", message: t("socialMediaObject") };
      }
      socialMedia = candidate as Json;
    } catch {
      return { status: "error", message: t("socialMediaJson") };
    }
  }

  try {
    const { supabase } = await requirePlatformAccess("platform.tenants.update");
    const { error } = await supabase.rpc("update_platform_tenant", {
      p_tenant_id: parsed.data.tenantId,
      p_institution_name: parsed.data.institutionName,
      p_description: parsed.data.description || undefined,
      p_address: parsed.data.address || undefined,
      p_contact: parsed.data.contact || undefined,
      p_phone: parsed.data.phone || undefined,
      p_email: parsed.data.email || undefined,
      p_website: parsed.data.website || undefined,
      p_social_media: socialMedia,
    });
    if (error) throw new Error(error.message);
  } catch {
    return { status: "error", message: t("updateFailed") };
  }

  revalidatePath("/ops");
  revalidatePath(`/ops/tenants/${parsed.data.tenantId}`);
  return { status: "success", message: t("updated") };
}

export async function setTenantStatusAction(
  _previousState: OpsActionState,
  formData: FormData
): Promise<OpsActionState> {
  const t = await getTranslations("Ops.actions");
  const parsed = statusSchema.safeParse({
    tenantId: formValue(formData, "tenantId"),
    status: formValue(formData, "status"),
    reason: formValue(formData, "reason"),
    confirmation: formValue(formData, "confirmation"),
  });
  if (!parsed.success) {
    return { status: "error", message: t("invalidValues") };
  }

  try {
    const { supabase } = await requirePlatformAccess("platform.tenants.suspend");
    const { error } = await supabase.rpc("set_tenant_status", {
      p_tenant_id: parsed.data.tenantId,
      p_status: parsed.data.status,
      p_reason: parsed.data.reason,
    });
    if (error) throw new Error(error.message);
  } catch {
    return { status: "error", message: t("statusFailed") };
  }

  revalidatePath("/ops");
  revalidatePath(`/ops/tenants/${parsed.data.tenantId}`);
  return {
    status: "success",
    message: t(`statuses.${parsed.data.status}`),
  };
}
