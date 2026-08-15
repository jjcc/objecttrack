"use client";

import { NavLink, Stack, ScrollArea } from "@mantine/core";
import {
  IconBox,
  IconCategory,
  IconDashboard,
  IconSettings,
  IconShieldLock,
  IconScan,
  IconTransfer,
  IconUsers,
} from "@tabler/icons-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

const navItems = [
  { key: "dashboard", icon: IconDashboard, href: "/dashboard" },
  { key: "objects", icon: IconBox, href: "/objects" },
  { key: "holderLookup", icon: IconScan, href: "/scan" },
  { key: "users", icon: IconUsers, href: "/users" },
  { key: "groups", icon: IconCategory, href: "/groups" },
  { key: "transfers", icon: IconTransfer, href: "/transfers" },
  { key: "events", icon: IconCategory, href: "/events" },
  { key: "settings", icon: IconSettings, href: "/settings" },
] as const;

const tenantAdminItem = {
  key: "tenantAdmin",
  icon: IconShieldLock,
  href: "/admin",
} as const;

export function Sidebar() {
  const t = useTranslations("Shell.sidebar");
  const pathname = usePathname();
  const router = useRouter();
  const [showTenantAdmin, setShowTenantAdmin] = useState(false);
  const [tenantRole, setTenantRole] = useState<string | null>(null);
  const [features, setFeatures] = useState({
    groups: false,
    advancedTransfers: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function resolveTenantRole() {
      const supabase = getSupabaseClient();
      const [roleResult, productResult] = await Promise.all([
        supabase.rpc("current_tenant_role"),
        supabase.rpc("current_tenant_product_context"),
      ]);
      if (!cancelled) {
        setShowTenantAdmin(
          roleResult.data === "admin" || roleResult.data === "owner"
        );
        setTenantRole(roleResult.data);
        const product = productResult.data?.[0];
        if (product) {
          setFeatures({
            groups: product.groups,
            advancedTransfers: product.advanced_transfers,
          });
        }
      }
    }

    void resolveTenantRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const editionItems = navItems.filter(
    (item) =>
      (item.key !== "users" ||
        tenantRole === "admin" ||
        tenantRole === "owner") &&
      (item.key !== "settings" ||
        tenantRole === "admin" ||
        tenantRole === "owner") &&
      (item.key !== "events" || tenantRole !== "viewer") &&
      (item.key !== "groups" || features.groups) &&
      (item.key !== "groups" ||
        tenantRole === "admin" ||
        tenantRole === "owner") &&
      (item.key !== "transfers" || features.advancedTransfers)
  );
  const visibleItems = showTenantAdmin
    ? [...editionItems, tenantAdminItem]
    : editionItems;

  return (
    <ScrollArea>
      <Stack gap={0} mt="md">
        {visibleItems.map((item) => (
          <NavLink
            key={item.href}
            label={t(item.key)}
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
