"use client";

import { MantineProvider, ColorSchemeScript, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import { AuthGate } from "@/components/auth/AuthGate";

const theme = createTheme({
  primaryColor: "blue",
});

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "mantine-datatable/styles.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        <title>Object Tracking Admin</title>
      </head>
      <body>
        <MantineProvider
          theme={theme}
          defaultColorScheme="light"
        >
          <Notifications position="top-right" />
          <Suspense>
            <AuthGate>{children}</AuthGate>
          </Suspense>
        </MantineProvider>
        <Analytics />
      </body>
    </html>
  );
}
