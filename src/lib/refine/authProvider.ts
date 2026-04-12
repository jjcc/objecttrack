import type { AuthProvider } from "@refinedev/core";
import { getSupabaseClient } from "@/lib/supabase/client";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const supabaseClient = getSupabaseClient();
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: {
            name: "LoginError",
            message: error.message,
          },
        };
      }

      if (data?.user) {
        const { data: adminRecord } = await supabaseClient
          .from("admin_users")
          .select("id")
          .eq("id", data.user.id)
          .single();

        if (!adminRecord) {
          await supabaseClient.auth.signOut();
          return {
            success: false,
            error: {
              name: "LoginError",
              message: "You are not authorized to access this application.",
            },
          };
        }
      }

      return {
        success: true,
        redirectTo: "/dashboard",
      };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: {
          name: "LoginError",
          message: error.message,
        },
      };
    }
  },

  register: async ({ email, password }) => {
    try {
      const supabaseClient = getSupabaseClient();
      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
      });

      if (error) {
        return {
          success: false,
          error: {
            name: "RegisterError",
            message: error.message,
          },
        };
      }

      await supabaseClient.auth.signOut();

      return {
        success: true,
        redirectTo: "/login",
        successNotification: {
          message: "Registration submitted",
          description:
            "Your account was created. An existing admin must still grant admin access before you can use this application.",
        },
      };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: {
          name: "RegisterError",
          message: error.message,
        },
      };
    }
  },

  forgotPassword: async ({ email }) => {
    try {
      const supabaseClient = getSupabaseClient();
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        return {
          success: false,
          error: {
            name: "ForgotPasswordError",
            message: error.message,
          },
        };
      }

      return {
        success: true,
        redirectTo: "/login",
        successNotification: {
          message: "Reset email sent",
          description: "If that email exists, a password reset link has been sent.",
        },
      };
    } catch (e) {
      const error = e as Error;
      return {
        success: false,
        error: {
          name: "ForgotPasswordError",
          message: error.message,
        },
      };
    }
  },

  logout: async () => {
    const supabaseClient = getSupabaseClient();
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      return {
        success: false,
        error: {
          name: "LogoutError",
          message: error.message,
        },
      };
    }

    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    const supabaseClient = getSupabaseClient();
    const { data } = await supabaseClient.auth.getUser();

    if (data?.user) {
      const { data: adminRecord } = await supabaseClient
        .from("admin_users")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!adminRecord) {
        return {
          authenticated: false,
          redirectTo: "/unauthorized",
          logout: true,
        };
      }

      return {
        authenticated: true,
      };
    }

    return {
      authenticated: false,
      redirectTo: "/login",
    };
  },

  getPermissions: async () => {
    const supabaseClient = getSupabaseClient();
    const { data } = await supabaseClient.auth.getUser();

    if (!data?.user) {
      return null;
    }

    const { data: adminRecord } = await supabaseClient
      .from("admin_users")
      .select("id")
      .eq("id", data.user.id)
      .single();

    return adminRecord ? "admin" : "user";
  },

  getIdentity: async () => {
    const supabaseClient = getSupabaseClient();
    const { data } = await supabaseClient.auth.getUser();

    if (!data?.user) {
      return null;
    }

    const { data: profile } = await supabaseClient
      .from("user_profiles")
      .select("first_name, last_name, email")
      .eq("id", data.user.id)
      .single();

    const profileData = profile as { first_name: string | null; last_name: string | null; email: string | null } | null;

    return {
      id: data.user.id,
      name: profileData
        ? `${profileData.first_name ?? ""} ${profileData.last_name ?? ""}`.trim()
        : data.user.email,
      email: data.user.email,
      avatar: undefined,
    };
  },

  onError: async (error) => {
    if (error?.status === 401 || error?.status === 403) {
      return {
        logout: true,
        redirectTo: "/login",
      };
    }

    return { error };
  },
};
