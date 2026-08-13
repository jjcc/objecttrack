"use client";

import {
  Alert,
  Button,
  NativeSelect,
  Stack,
  TextInput,
} from "@mantine/core";
import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import {
  createSimpleWorkspaceAction,
  type WorkspaceProvisioningState,
} from "@/app/onboarding/actions";

const initialState: WorkspaceProvisioningState = {
  status: "idle",
  code: "",
};

function SubmitButton() {
  const t = useTranslations("Onboarding");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {t("create")}
    </Button>
  );
}

export function WorkspaceSetupForm({
  initialName,
  initialKind,
}: {
  initialName: string;
  initialKind: "family" | "business" | "club" | "collector" | "other";
}) {
  const t = useTranslations("Onboarding");
  const [state, action] = useFormState(
    createSimpleWorkspaceAction,
    initialState
  );

  return (
    <form action={action}>
      <Stack>
        {state.status === "error" ? (
          <Alert color="red" title={t("unableTitle")}>
            {t(`errors.${state.code || "failed"}`)}
          </Alert>
        ) : null}
        <TextInput
          name="workspaceName"
          label={t("workspaceName")}
          defaultValue={initialName}
          minLength={2}
          maxLength={200}
          required
        />
        <NativeSelect
          name="workspaceKind"
          label={t("workspaceKind")}
          defaultValue={initialKind}
          data={[
            { value: "family", label: t("workspaceKinds.family") },
            { value: "business", label: t("workspaceKinds.business") },
            { value: "club", label: t("workspaceKinds.club") },
            { value: "collector", label: t("workspaceKinds.collector") },
            { value: "other", label: t("workspaceKinds.other") },
          ]}
        />
        <SubmitButton />
      </Stack>
    </form>
  );
}
