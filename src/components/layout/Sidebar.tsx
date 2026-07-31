"use client";

import { NavLink, Stack, ScrollArea } from "@mantine/core";
import {
  IconBox,
  IconCategory,
  IconDashboard,
  IconSettings,
  IconShieldLock,
  IconTransfer,
  IconUsers,
} from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, href: "/dashboard" },
  { label: "Objects", icon: IconBox, href: "/objects" },
  { label: "Users", icon: IconUsers, href: "/users" },
  { label: "Groups", icon: IconCategory, href: "/groups" },
  { label: "Transfers", icon: IconTransfer, href: "/transfers" },
  { label: "Events", icon: IconCategory, href: "/events" },
  { label: "Settings", icon: IconSettings, href: "/settings" },
];

const tenantAdminItem = {
  label: "Tenant Admin",
  icon: IconShieldLock,
  href: "/admin",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showTenantAdmin, setShowTenantAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveTenantRole() {
      const supabase = getSupabaseClient();
      const { data } = await supabase.rpc("current_tenant_role");
      if (!cancelled) {
        setShowTenantAdmin(data === "admin" || data === "owner");
      }
    }

    void resolveTenantRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = showTenantAdmin
    ? [...navItems, tenantAdminItem]
    : navItems;

  return (
    <ScrollArea>
      <Stack gap={0} mt="md">
        {visibleItems.map((item) => (
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
