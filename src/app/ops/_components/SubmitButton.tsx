"use client";

import { Button } from "@mantine/core";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  color?: string;
};

export function SubmitButton({
  idleLabel,
  pendingLabel,
  color,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} color={color}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
