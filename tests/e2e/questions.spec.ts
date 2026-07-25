import { expect, test } from "@playwright/test";

import { attachPageGuards, expectHealthyPage } from "./utils/observers";

test.describe("local-only question journeys", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Destructive journey fixtures run only against local Supabase.");

  test("signed-out visitor cannot reach a question URL directly", async ({ page }, testInfo) => {
    // v3 replaced the in-page recovery state with a redirect, and /topics is a
    // protected prefix, so a signed-out visitor is sent to sign-in and no
    // question text or answer form is rendered at all.
    const expectNoBrowserFailures = attachPageGuards(page, testInfo);
    await page.goto("/en/topics/communication-conflict/questions/6766f6f3-05dc-49d7-8f84-aa86998f3e69");
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expect(page.locator("form[action*='/topics/']")).toHaveCount(0);
    await expectHealthyPage(page);
    await expectNoBrowserFailures();
  });
});
