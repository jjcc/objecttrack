"use client";
import { useLogout } from "@refinedev/core";

export const MyLogoutTestButton = () => {
  const { mutate: logout } = useLogout();

  return (
    <button
      onClick={() => {
        console.log("🔵 Manual logout triggered");
        logout();
      }}
    >
      🔐 Logout Now
    </button>
  );
};
