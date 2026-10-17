import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getResolvedDatabaseConfig } from "@/lib/supabase/runtime-config";

export async function createServiceSupabaseClient() {
  const { config } = await getResolvedDatabaseConfig();
  const { url, serviceRoleKey } = config;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}
