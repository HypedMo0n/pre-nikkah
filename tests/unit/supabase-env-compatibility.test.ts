import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("Supabase environment compatibility", () => {
  const nextConfig = readFileSync(
    path.join(process.cwd(), "next.config.mjs"),
    "utf8",
  );
  const serverEnv = readFileSync(
    path.join(process.cwd(), "lib", "env", "server.ts"),
    "utf8",
  );

  it("maps modern public Supabase variables into the browser-safe aliases", () => {
    expect(nextConfig).toContain("process.env.SUPABASE_URL");
    expect(nextConfig).toContain("process.env.SUPABASE_PUBLISHABLE_KEY");
    expect(nextConfig).toContain("NEXT_PUBLIC_SUPABASE_URL: supabaseUrl");
    expect(nextConfig).toContain(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublishableKey",
    );
  });

  it("never exposes the elevated Supabase secret through Next public env", () => {
    expect(nextConfig).not.toContain("SUPABASE_SECRET_KEY");
    expect(nextConfig).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serverEnv).toContain("process.env.SUPABASE_SECRET_KEY");
    expect(serverEnv).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
  });
});
