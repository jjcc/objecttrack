"use client";

import { MantineProvider, ColorSchemeScript, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Refine } from "@refinedev/core";
import { Analytics } from "@vercel/analytics/next";
import routerProvider from "@refinedev/nextjs-router";
import { Suspense, useMemo } from "react";

const theme = createTheme({
  primaryColor: "blue",
});
import { createDataProvider } from "@/lib/refine/dataProvider";
import { authProvider } from "@/lib/refine/authProvider";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import "mantine-datatable/styles.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dataProvider = useMemo(() => createDataProvider(), []);

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
            <Refine
              dataProvider={dataProvider}
              authProvider={authProvider}
              routerProvider={routerProvider}
              resources={[
                {
                  name: "objects",
                  list: "/objects",
                  create: "/objects/create",
                  edit: "/objects/:id/edit",
                  show: "/objects/:id",
                  meta: { label: "Objects" },
                },
                {
                  name: "user_profiles",
                  list: "/users",
                  create: "/users/create",
                  edit: "/users/:id/edit",
                  show: "/users/:id",
                  meta: { label: "Users" },
                },
                {
                  name: "events",
                  list: "/events",
                  create: "/events/create",
                  meta: {
                    label: "Events",
                    canDelete: false,
                  },
                },
                {
                  name: "groups",
                  list: "/groups",
                  create: "/groups/create",
                  edit: "/groups/:id/edit",
                  meta: { label: "Groups" },
                },
                {
                  name: "categories",
                  list: "/settings",
                  meta: { label: "Categories", hide: true },
                },
                {
                  name: "event_types",
                  meta: { label: "Event Types", hide: true },
                },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
              }}
            >
              {children}
            </Refine>
          </Suspense>
        </MantineProvider>
        <Analytics />
      </body>
    </html>
  );
}
