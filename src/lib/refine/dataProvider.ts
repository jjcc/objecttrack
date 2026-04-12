import { dataProvider as supabaseDataProvider } from "@refinedev/supabase";
import { supabaseClient } from "@/lib/supabase/client";

export const dataProvider = supabaseDataProvider(supabaseClient);
