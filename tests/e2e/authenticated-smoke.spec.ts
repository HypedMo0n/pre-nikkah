import { expect, test } from "@playwright/test";

import { signIn } from "./utils/auth";
import { attachPageGuards, expectHealthyPage } from "./utils/observers";
import { getE2ECredentials } from "./utils/secrets";

test("@smoke authenticated private-alpha journey read-only smoke", async ({ page }, testInfo) => {
  test.skip(
    !process.env.E2E_BASE_URL ||
      !process.env.E2E_TEST_EMAIL ||
      !process.env.E2E_TEST_PASSWORD,
    "Authenticated smoke requires E2E_BASE_URL plus E2E_TEST_EMAIL/E2E_TEST_PASSWORD.",
  );
  const credentials = getE2ECredentials();
  const expectNoBrowserFailures = attachPageGuards(page, testInfo);

  await test.step("sign in", async () => {
    await signIn(page, credentials);
    await expectHealthyPage(page);
  });

  await test.step("open dashboard", async () => {
    const response = await page.goto("/en/dashboard");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("main")).toBeVisible();
    await expectHealthyPage(page);
  });

  await test.step("inspect invalid invitation safely", async () => {
    const response = await page.goto("/en/join/00000000000000000000");
    expect(response?.status()).toBeLessThan(500);
    await expectHealthyPage(page);
  });

  await test.step("open topic and question page without destructive actions", async () => {
    const topicResponse = await page.goto("/en/topics/family-boundaries-and-involvement");
    expect(topicResponse?.status()).toBeLessThan(500);
    await expectHealthyPage(page);
    const questionResponse = await page.goto("/en/topics/family-boundaries-and-involvement/questions/10000000-0000-4000-8000-000000000501");
    expect(questionResponse?.status()).toBeLessThan(500);
    await expectHealthyPage(page);
  });

  await expectNoBrowserFailures();
});
