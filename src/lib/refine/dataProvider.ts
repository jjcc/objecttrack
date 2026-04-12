import { dataProvider as supabaseDataProvider } from "@refinedev/supabase";
import { getSupabaseClient } from "@/lib/supabase/client";

export const dataProvider = supabaseDataProvider(getSupabaseClient());
