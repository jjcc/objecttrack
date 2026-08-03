"use server";

import {cookies} from "next/headers";
import {isAppLocale, localeCookieName} from "./config";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: string): Promise<void> {
  if (!isAppLocale(locale)) {
    throw new Error("Unsupported locale");
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    httpOnly: true,
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}
