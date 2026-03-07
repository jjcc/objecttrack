"use client";

import React, { Suspense } from "react";
import { Refine } from "@refinedev/core";
import { DevtoolsProvider } from "@providers/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { useNotificationProvider } from "@refinedev/mantine";
import { Notifications } from "@mantine/notifications";
import routerProvider from "@refinedev/nextjs-router";

import { AppIcon } from "@components/app-icon";
import { authProviderClient } from "@providers/auth-provider/auth-provider.client";
import { dataProvider } from "@providers/data-provider";
import { ColorModeContextProvider } from "@contexts/color-mode";
import { Header } from "@components/header";

export function Providers({
  children,
  defaultMode,
}: {
  children: React.ReactNode;
  defaultMode: string;
}) {
  return (
    <Suspense>
      <RefineKbarProvider>
        <ColorModeContextProvider defaultMode={defaultMode}>
          <Notifications />
          <DevtoolsProvider>
            <Refine
              routerProvider={routerProvider}
              authProvider={authProviderClient}
              dataProvider={dataProvider}
              notificationProvider={useNotificationProvider}
              resources={[
                {
                  name: "categories",
                  list: "/Category",
                  create: "/Category/create",
                  edit: "/Category/edit/:id",
                  show: "/Category/show/:id",
                  meta: {
                    canDelete: true,
                    label: "Category",
                  },
                },
                {
                  name: "event_types",
                  list: "/EventType",
                  create: "/EventType/create",
                  edit: "/EventType/edit/:id",
                  show: "/EventType/show/:id",
                  meta: {
                    canDelete: true,
                    label: "Event Type",
                  },
                },
                {
                  name: "groups",
                  list: "/Group",
                  create: "/Group/create",
                  edit: "/Group/edit/:id",
                  show: "/Group/show/:id",
                  meta: {
                    canDelete: true,
                    label: "Group",
                  },
                },
                {
                  name: "objects",
                  list: "/Object",
                  create: "/Object/create",
                  edit: "/Object/edit/:id",
                  show: "/Object/show/:id",
                  meta: {
                    canDelete: true,
                    label: "Object",
                  },
                },
                {
                  name: "Barcode",
                  list: "/Barcode",
                  meta: {
                    canDelete: true,
                  },
                },
                {
                  name: "events",
                  list: "/Event",
                  create: "/Event/create",
                  edit: "/Event/edit/:id",
                  show: "/Event/show/:id",
                  meta: {
                    canDelete: true,
                    label: "Event",
                  },
                },
                {
                  name: "user_profiles",
                  list: "/User",
                  create: "/User/create",
                  edit: "/User/edit/:id",
                  show: "/User/show/:id",
                  meta: {
                    canDelete: true,
                    label: "User",
                  },
                },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                useNewQueryKeys: true,
                projectId: "zGRw11-BzVqrU-CuJQmq",
                title: { text: "ObjectTrack", icon: <AppIcon /> },
              }}
            >
              {children}
              <RefineKbar />
            </Refine>
          </DevtoolsProvider>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </Suspense>
  );
}
