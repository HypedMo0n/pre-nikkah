import { z } from "zod";

const publicEnvSchema = z.object({
  supabaseUrl: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL."),
  supabaseAnonKey: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required."),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function hasPublicEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
