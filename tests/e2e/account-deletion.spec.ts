import { test } from "@playwright/test";

test.describe("local-only destructive account deletion", () => {
  test.skip(process.env.ALLOW_DESTRUCTIVE_E2E !== "true" || Boolean(process.env.E2E_BASE_URL), "Account deletion E2E is local-only and must never run against production.");

  test("account deletes successfully and reaches public confirmation page", async () => {
    test.fail(true, "Local Supabase account-deletion fixture wiring is required before enabling this destructive test.");
  });
});
