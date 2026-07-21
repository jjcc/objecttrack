"use client";

import {
  Group,
  Burger,
  ActionIcon,
  useMantineColorScheme,
  Text,
  Menu,
  Avatar,
} from "@mantine/core";
import {
  IconSun,
  IconMoon,
  IconLogout,
  IconUser,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface HeaderProps {
  opened: boolean;
  toggle: () => void;
}

interface UserIdentity {
  id: string;
  name: string;
  email: string;
}

export function Header({ opened, toggle }: HeaderProps) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const router = useRouter();
  const [user, setUser] = useState<UserIdentity | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const supabase = getSupabaseClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", authUser.id)
          .maybeSingle() as unknown as { data: { first_name: string | null; last_name: string | null } | null };

        const name = profile
          ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || authUser.email || "Admin"
          : "Admin";

        setUser({
          id: authUser.id,
          name,
          email: authUser.email ?? "",
        });
      }
    }
    fetchUser();
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group>
        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        <Text size="lg" fw={700}>
          Object Tracking
        </Text>
      </Group>
      <Group>
        <ActionIcon
          variant="default"
          onClick={() => toggleColorScheme()}
          size="lg"
          aria-label="Toggle color scheme"
        >
          {colorScheme === "dark" ? (
            <IconSun size={18} />
          ) : (
            <IconMoon size={18} />
          )}
        </ActionIcon>

        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="default" size="lg">
              <Avatar size="sm" radius="xl" color="blue">
                {user?.name?.charAt(0)?.toUpperCase() ?? "A"}
              </Avatar>
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{user?.name ?? "Admin"}</Menu.Label>
            <Menu.Label>{user?.email ?? ""}</Menu.Label>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconUser size={14} />}
              disabled
            >
              Profile
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconLogout size={14} />}
              onClick={handleLogout}
            >
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
