import { expect, test } from "@playwright/test";

import { attachPageGuards, expectHealthyPage } from "./utils/observers";

test("@smoke signed-out invalid invite explains unavailable state", async ({ page }, testInfo) => {
  const expectNoBrowserFailures = attachPageGuards(page, testInfo);
  const response = await page.goto("/en/join/00000000000000000000");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByText(/invalid|expired|already used|indisponible/i)).toBeVisible();
  await expectHealthyPage(page);
  await expectNoBrowserFailures();
});
