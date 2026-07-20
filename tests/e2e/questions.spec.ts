import { expect, test } from "@playwright/test";

import { attachPageGuards, expectHealthyPage } from "./utils/observers";

test.describe("local-only question journeys", () => {
  test.skip(Boolean(process.env.E2E_BASE_URL), "Destructive journey fixtures run only against local Supabase.");

  test("user without active journey sees recovery state on direct question URL", async ({ page }, testInfo) => {
    const expectNoBrowserFailures = attachPageGuards(page, testInfo);
    await page.goto("/en/topics/family-boundaries-and-involvement/questions/10000000-0000-4000-8000-000000000501");
    await expect(page.getByText(/Create or join an active journey|waiting for your partner|journey is closed/i)).toBeVisible();
    await expect(page.locator("form[action]")).toHaveCount(0);
    await expectHealthyPage(page);
    await expectNoBrowserFailures();
  });
});
