"use client";

import "dayjs/locale/zh-cn";

import {createTheme, MantineProvider} from "@mantine/core";
import {DatesProvider} from "@mantine/dates";
import {Notifications} from "@mantine/notifications";
import {useLocale} from "next-intl";
import {AuthGate} from "@/components/auth/AuthGate";

const theme = createTheme({
  primaryColor: "blue"
});

export function AppProviders({children}: {children: React.ReactNode}) {
  const locale = useLocale();

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{locale: locale === "zh-CN" ? "zh-cn" : "en"}}>
        <Notifications position="top-right" />
        <AuthGate>{children}</AuthGate>
      </DatesProvider>
    </MantineProvider>
  );
}
