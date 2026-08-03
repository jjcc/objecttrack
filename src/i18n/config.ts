export const locales = ["en", "zh-CN"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "NEXT_LOCALE";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
