import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

export function createAdminClient() {
  const env = getServerEnv();

  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
