"use client";

import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Stack,
  Alert,
  Anchor,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    initialValues: {
      email: "",
      password: "",
    },
    validate: zodResolver(loginSchema),
  });

  const handleSubmit = async (values: LoginFormValues) => {
    setError(null);
    setIsPending(true);
    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error)?.message ?? "Login failed. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Paper shadow="md" p={30} radius="md" w={400}>
      <Title order={2} ta="center" mb="lg">
        Object Tracking
      </Title>
      <Title order={4} ta="center" mb="lg" c="dimmed">
        Admin Login
      </Title>

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

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label="Email"
            placeholder="admin@example.com"
            required
            {...form.getInputProps("email")}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            {...form.getInputProps("password")}
          />
          <Button type="submit" fullWidth loading={isPending}>
            Sign in
          </Button>
          <Anchor component={Link} href="/forgot-password" size="sm" ta="center">
            Forgot your password?
          </Anchor>
          <Anchor component={Link} href="/register" size="sm" ta="center">
            Need an account?
          </Anchor>
        </Stack>
      </form>
    </Paper>
  );
}
