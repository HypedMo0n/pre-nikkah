import { describe, expect, it } from "vitest";
import { createRedactor } from "../../scripts/db/remote-safety.mjs";

describe("remote database output redaction", () => {
  it("masks the URL, host, credentials, and project reference", () => {
    const rawUrl =
      "postgresql://postgres.sampleproject:encoded-password@aws-0-region.pooler.supabase.com:6543/postgres";
    const redact = createRedactor(new URL(rawUrl), rawUrl);
    const output = redact(
      `Failed for ${rawUrl} on aws-0-region.pooler.supabase.com as postgres.sampleproject sampleproject encoded-password`,
    );

    expect(output).not.toContain(rawUrl);
    expect(output).not.toContain("aws-0-region.pooler.supabase.com");
    expect(output).not.toContain("postgres.sampleproject");
    expect(output).not.toContain("sampleproject");
    expect(output).not.toContain("encoded-password");
    expect(output).toContain("[masked]");
  });

  it("masks unexpected PostgreSQL URLs in command output", () => {
    const configuredUrl =
      "postgresql://postgres.known:known-password@db.known.supabase.co:5432/postgres";
    const redact = createRedactor(new URL(configuredUrl), configuredUrl);

    expect(
      redact(
        "A driver echoed postgresql://other-user:other-password@other.example.test:5432/postgres",
      ),
    ).toBe("A driver echoed postgresql://[masked]");
  });
});
