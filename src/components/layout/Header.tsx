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
import { useGetIdentity, useLogout } from "@refinedev/core";

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
  const { data: user } = useGetIdentity<UserIdentity>();
  const { mutate: logout } = useLogout();

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
              onClick={() => logout()}
            >
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
  );
}
