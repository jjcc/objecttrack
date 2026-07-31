import { NextResponse } from "next/server";
import { AuthorizationError } from "./tenant-context";

export function authorizationErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthorizationError)) return null;

  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status }
  );
}
