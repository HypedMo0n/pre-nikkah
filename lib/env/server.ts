import "server-only";

import { z } from "zod";

import { getPublicEnv } from "@/lib/env/public";

const serverEnvSchema = z.object({
  serviceRoleKey: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required."),
});

export function getServerEnv() {
  return {
    ...getPublicEnv(),
    ...serverEnvSchema.parse({
      serviceRoleKey:
        process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_SECRET_KEY,
    }),
  };
}
