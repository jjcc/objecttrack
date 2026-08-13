import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Alert,
  Button,
  Center,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { WorkspaceSetupForm } from "@/app/onboarding/_components/WorkspaceSetupForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const workspaceKinds = [
  "family",
  "business",
  "club",
  "collector",
  "other",
] as const;

type WorkspaceKind = (typeof workspaceKinds)[number];

function workspaceKind(value: unknown): WorkspaceKind {
  return typeof value === "string" &&
    workspaceKinds.includes(value as WorkspaceKind)
    ? (value as WorkspaceKind)
    : "other";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: { created?: string; provisioning?: string };
}) {
  const t = await getTranslations("Onboarding");
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const initialName =
    typeof user.user_metadata.workspace_name === "string"
      ? user.user_metadata.workspace_name
      : "";
  const initialKind = workspaceKind(user.user_metadata.workspace_kind);

  return (
    <Center mih="100vh" bg="gray.1" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" maw={520} w="100%">
        <Stack>
          <Title order={2}>{t("title")}</Title>
          {profile ? (
            <>
              <Alert color="green" title={t("readyTitle")}>
                {t("ready")}
              </Alert>
              <Button component={Link} href="/dashboard">
                {t("continue")}
              </Button>
            </>
          ) : (
            <>
              <Text c="dimmed">{t("description")}</Text>
              {searchParams?.provisioning ? (
                <Alert color="yellow" title={t("recoveryTitle")}>
                  {t("recovery")}
                </Alert>
              ) : null}
              <WorkspaceSetupForm
                initialName={initialName}
                initialKind={initialKind}
              />
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
