"use client";

import {
  Alert,
  Anchor,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase/client";

const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const nextPath =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/dashboard";
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<RegisterFormValues>({
    initialValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    validate: zodResolver(registerSchema),
  });

  const handleSubmit = async (values: RegisterFormValues) => {
    setError(null);
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}${nextPath}`,
          data: {
            email: values.email,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.replace(nextPath);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError((err as Error)?.message ?? "Registration failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Center h="100vh" bg="gray.1" px="md">
      <Paper shadow="md" p={30} radius="md" w={420}>
        <Title order={2} ta="center" mb="lg">
          Object Tracking
        </Title>
        <Title order={4} ta="center" mb="xs" c="dimmed">
          Request Access
        </Title>
        <Text size="sm" c="dimmed" ta="center" mb="lg">
          Creating an account does not grant tenant access automatically. An authorized
          tenant administrator or owner must add you as a member of their tenant.
        </Text>

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            mb="md"
            onClose={() => setError(null)}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        {success ? (
          <Stack>
            <Alert color="green" mb="md">
              Account created! Check your email for a confirmation link.
            </Alert>
            <Anchor
              component={Link}
              href={`/login?next=${encodeURIComponent(nextPath)}`}
              size="sm"
              ta="center"
            >
              Continue to sign in
            </Anchor>
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label="Email"
                placeholder="name@example.com"
                required
                {...form.getInputProps("email")}
              />
              <PasswordInput
                label="Password"
                placeholder="Create a password"
                required
                {...form.getInputProps("password")}
              />
              <PasswordInput
                label="Confirm Password"
                placeholder="Repeat your password"
                required
                {...form.getInputProps("confirmPassword")}
              />
              <Button type="submit" fullWidth loading={isPending}>
                Register
              </Button>
              <Anchor
                component={Link}
                href={`/login?next=${encodeURIComponent(nextPath)}`}
                size="sm"
                ta="center"
              >
                Back to login
              </Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  );
}
