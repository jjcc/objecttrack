import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import * as qrcode from "qrcode";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const objectId = Number(id);

  if (isNaN(objectId)) {
    return new NextResponse("Invalid object ID", { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  // Match the public object page tenant visibility rule instead of querying
  // the tenant-owned objects table directly.
  const { data: objects, error } = await supabase.rpc("object_info", {
    p_object_id: objectId,
  });

  if (error || !objects || objects.length === 0) {
    return new NextResponse("Object not found", { status: 404 });
  }

  const payload = new URL(`/object-info/${objectId}`, request.nextUrl.origin).toString();

  const buffer = await qrcode.toBuffer(payload, {
    type: "png",
    width: 512,
    margin: 2,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      // Authenticated tenant members may generate a QR code for a private
      // object, so this response must never enter a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
