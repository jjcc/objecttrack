import {cookies} from "next/headers";
import {getRequestConfig} from "next-intl/server";
import {localeCookieName, resolveLocale, type AppLocale} from "./config";

const messageLoaders: Record<AppLocale, () => Promise<{default: typeof import("../../messages/en.json")}>> = {
  en: () => import("../../messages/en.json"),
  "zh-CN": () => import("../../messages/zh-CN.json")
};

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);
  const messages = (await messageLoaders[locale]()).default;

  return {
    locale,
    messages,
    formats: {
      dateTime: {
        short: {year: "numeric", month: "short", day: "numeric"},
        dateTime: {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      }
    }
  };
});
