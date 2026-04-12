"use client";

import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Stack,
  Alert,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { useLogin } from "@refinedev/core";
import { z } from "zod";
import { useState } from "react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { mutate: login, isPending } = useLogin<LoginFormValues>();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    initialValues: {
      email: "",
      password: "",
    },
    validate: zodResolver(loginSchema),
  });

  const handleSubmit = (values: LoginFormValues) => {
    setError(null);
    login(values, {
      onError: (err) => {
        setError(err?.message ?? "Login failed. Please try again.");
      },
    });
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
        </Stack>
      </form>
    </Paper>
  );
}
