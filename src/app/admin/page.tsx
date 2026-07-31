import Link from "next/link";
import {
  Anchor,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";

const areas = [
  {
    href: "/admin/profile",
    title: "Profile & settings",
    description: "Manage supported tenant identity, contact, and visibility settings.",
  },
  {
    href: "/admin/members",
    title: "Members",
    description: "Review tenant members and safely manage tenant roles.",
  },
  {
    href: "/admin/invitations",
    title: "Invitations",
    description: "Invite and onboard users into this tenant.",
  },
  {
    href: "/admin/reports",
    title: "Reports",
    description: "Generate and download tenant-scoped reports.",
  },
];

export default function TenantAdminPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Tenant administration</Title>
        <Text c="dimmed" size="sm">
          Administrative actions are restricted to your current tenant.
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        {areas.map((area) => (
          <Paper withBorder p="lg" radius="md" key={area.href}>
            <Anchor component={Link} href={area.href} fw={600}>
              {area.title}
            </Anchor>
            <Text size="sm" c="dimmed" mt="xs">
              {area.description}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
