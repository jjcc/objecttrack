import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_KEY!
  );
}

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (!browserClient) {
    browserClient = createClient();
  }

  return browserClient;
}
