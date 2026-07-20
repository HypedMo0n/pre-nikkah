import { test } from "@playwright/test";

test.describe("local-only two-context journey flows", () => {
  test.skip(process.env.ALLOW_DESTRUCTIVE_E2E !== "true" || Boolean(process.env.E2E_BASE_URL), "Journey mutation E2E is local-only and must never run against production.");

  test("creator and partner can complete a private journey setup", async ({ browser }) => {
    const creator = await browser.newContext();
    const partner = await browser.newContext();
    await creator.close();
    await partner.close();
    test.fail(true, "Local deterministic journey fixtures are required before enabling this destructive test.");
  });
});
