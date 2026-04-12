import { dataProvider as supabaseDataProvider } from "@refinedev/supabase";
import { getSupabaseClient } from "@/lib/supabase/client";

export function createDataProvider() {
  return supabaseDataProvider(getSupabaseClient());
}
