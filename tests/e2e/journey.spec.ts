import { test } from "@playwright/test";

test.describe("local-only two-context journey flows", () => {
  test.skip(process.env.ALLOW_DESTRUCTIVE_E2E !== "true" || Boolean(process.env.E2E_BASE_URL), "Journey mutation E2E is local-only and must never run against production.");

  // fixme rather than fail: the body asserts nothing, so `test.fail` marked it
  // expected-to-fail and then reported a failure when it trivially passed,
  // which broke CI wherever ALLOW_DESTRUCTIVE_E2E is set.
  test.fixme("creator and partner can complete a private journey setup", async () => {
    // Local deterministic journey fixtures are required before this
    // destructive test can be enabled.
  });
});
