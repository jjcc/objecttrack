"use client";

import { NavLink, Stack, ScrollArea } from "@mantine/core";
import {
  IconDashboard,
  IconBox,
  IconUsers,
  IconTransfer,
  IconCategory,
  IconSettings,
} from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, href: "/dashboard" },
  { label: "Objects", icon: IconBox, href: "/objects" },
  { label: "Users", icon: IconUsers, href: "/users" },
  { label: "Groups", icon: IconCategory, href: "/groups" },
  { label: "Transfers", icon: IconTransfer, href: "/transfers" },
  { label: "Events", icon: IconCategory, href: "/events" },
  { label: "Settings", icon: IconSettings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <ScrollArea>
      <Stack gap={0} mt="md">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            label={item.label}
            leftSection={<item.icon size={20} stroke={1.5} />}
            active={pathname.startsWith(item.href)}
            onClick={() => router.push(item.href)}
            variant="light"
          />
        ))}
      </Stack>
    </ScrollArea>
  );
}
