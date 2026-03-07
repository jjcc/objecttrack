"use client";

import { ActionIcon, Avatar, Group, Text } from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useGetIdentity } from "@refinedev/core";
import { HamburgerMenu, RefineThemedLayoutV2HeaderProps } from "@refinedev/mantine";
import React from "react";

type IUser = {
  id: number;
  name: string;
  avatar: string;
};

export const Header: React.FC<RefineThemedLayoutV2HeaderProps> = ({
  sticky = true,
}) => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  const { data: user } = useGetIdentity<IUser>();

  return (
    <Group justify="space-between" align="center" px="sm" h="100%">
      <HamburgerMenu />
      <Group gap="sm">
        <ActionIcon
          variant="subtle"
          onClick={toggleColorScheme}
          aria-label="Toggle color scheme"
        >
          {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
        </ActionIcon>
        {(user?.avatar || user?.name) && (
          <Group gap="sm" align="center">
            {user?.name && (
              <Text size="sm" visibleFrom="sm">
                {user.name}
              </Text>
            )}
            <Avatar src={user?.avatar} alt={user?.name} size="sm" />
          </Group>
        )}
      </Group>
    </Group>
  );
};
