"use client";
import { AuthPage as AuthPageBase } from "@refinedev/mui";
import type { AuthPageProps } from "@refinedev/core";

export const AuthPage = (props: AuthPageProps) => {
  return (
    <AuthPageBase
      {...props}
      formProps={{
        defaultValues: {
          email: "info@refine.dev",
          password: "refine-supabase",
        },
      }}
    />
  );
};
