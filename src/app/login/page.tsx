import { AuthPage } from "@components/auth-page";
import { authProviderServer } from "@providers/auth-provider/auth-provider.server";
import { redirect } from "next/navigation";

export default async function Login() {
  const data = await getData();

  if (data.authenticated) {
    console.log("Already authenticated, redirecting...");
    redirect(data?.redirectTo || "/");
  }

  return <AuthPage type="login" />;
}

async function getData() {
  console.log("GETDATA called");
  const { authenticated, redirectTo, error } = await authProviderServer.check();
  console.log("AUTH:", authenticated);

  return {
    authenticated,
    redirectTo,
    error,
  };
}
