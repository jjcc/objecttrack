import { Center } from "@mantine/core";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  const selfServiceRegistrationEnabled =
    process.env.SELF_SERVICE_REGISTRATION_ENABLED === "true";

  return (
    <Center h="100vh" bg="gray.1">
      <LoginForm
        selfServiceRegistrationEnabled={selfServiceRegistrationEnabled}
      />
    </Center>
  );
}
