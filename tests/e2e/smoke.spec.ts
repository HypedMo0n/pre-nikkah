import { expect, test } from "@playwright/test";

import { attachPageGuards, expectHealthyPage } from "./utils/observers";

const publicRoutes = [
  "/en/welcome",
  "/fr/welcome",
  "/en/sign-in",
  "/en/join/00000000000000000000",
  "/en/account-deleted",
  "/fr/account-deleted",
  "/account-deleted",
];

for (const route of publicRoutes) {
  test(`@smoke public route ${route} renders without framework failures`, async ({ page }, testInfo) => {
    const expectNoBrowserFailures = attachPageGuards(page, testInfo);
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("main")).toBeVisible();
    await expectHealthyPage(page);
    await expectNoBrowserFailures();
  });
}

test("@smoke signed-out protected route redirects to sign-in", async ({ page }, testInfo) => {
  const expectNoBrowserFailures = attachPageGuards(page, testInfo);
  const response = await page.goto("/en/dashboard");
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/en\/sign-in/);
  await expectHealthyPage(page);
  await expectNoBrowserFailures();
});
