import { z } from "zod";

const publicEnvSchema = z.object({
  supabaseUrl: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  supabaseAnonKey: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required."),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

function readPublicEnvInput() {
  return {
    supabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
    supabaseAnonKey:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY,
  };
}


export function hasPublicEnv(): boolean {
  const input = readPublicEnvInput();
  return Boolean(input.supabaseUrl && input.supabaseAnonKey);
}

export function isTesterEnvironment(): boolean {
  return process.env.NEXT_PUBLIC_TESTER_ENVIRONMENT === "true";
}

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse(readPublicEnvInput());
}
