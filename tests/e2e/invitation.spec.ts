import { expect, test } from "@playwright/test";

import { attachPageGuards, expectHealthyPage } from "./utils/observers";

test("@smoke signed-out invite route renders safely before inspection", async ({ page }, testInfo) => {
  const expectNoBrowserFailures = attachPageGuards(page, testInfo);
  const response = await page.goto("/en/join/00000000000000000000");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: /join|sign in/i })).toBeVisible();
  await expectHealthyPage(page);
  await expectNoBrowserFailures();
});
