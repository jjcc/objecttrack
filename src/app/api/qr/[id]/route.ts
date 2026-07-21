import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import * as qrcode from "qrcode";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const objectId = Number(id);

  if (isNaN(objectId)) {
    return new NextResponse("Invalid object ID", { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: objects, error } = await supabase
    .from("objects")
    .select("id")
    .eq("id", objectId);

  if (error || !objects || objects.length === 0) {
    return new NextResponse("Object not found", { status: 404 });
  }

  const payload = `https://objecttrack.vercel.app/objects/${objectId}`;

  const buffer = await qrcode.toBuffer(payload, {
    type: "png",
    width: 512,
    margin: 2,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
