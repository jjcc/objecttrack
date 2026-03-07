"use client";
import { AuthPage as AuthPageBase } from "@refinedev/mantine";
import type { AuthPageProps } from "@refinedev/core";

export const AuthPage = (props: AuthPageProps) => {
  return (
    <AuthPageBase
      {...props}
      formProps={{
        defaultValues: {
          //email: "info@refine.dev",
          email: "bpzmik@163.com",
          //password: "refine-supabase",
          password: "",
        },
      }}
    />
  );
};
