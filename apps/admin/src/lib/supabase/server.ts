import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfigForServer } from "@/lib/config/env";

export const supabaseServer = () => {
  const config = getSupabaseConfigForServer();
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  });
};
