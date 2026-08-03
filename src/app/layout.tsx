import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "mantine-datatable/styles.css";

import {ColorSchemeScript} from "@mantine/core";
import {Analytics} from "@vercel/analytics/next";
import type {Metadata} from "next";
import {NextIntlClientProvider} from "next-intl";
import {getLocale, getTranslations} from "next-intl/server";
import {Suspense} from "react";
import {AppProviders} from "./providers";
import {PublicLocaleSwitcher} from "@/components/i18n/PublicLocaleSwitcher";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");

  return {
    title: t("title"),
    description: t("description")
  };
}

export default async function RootLayout({children}: {children: React.ReactNode}) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <NextIntlClientProvider>
          <AppProviders>
            <Suspense>
              <PublicLocaleSwitcher />
              {children}
            </Suspense>
          </AppProviders>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
