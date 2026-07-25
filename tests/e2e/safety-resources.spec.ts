import { expect, test } from "@playwright/test";

import { signIn } from "./utils/auth";
import { attachPageGuards, expectHealthyPage } from "./utils/observers";
import { getE2ECredentials } from "./utils/secrets";

/**
 * Proves item (b) of docs/product/alpha-scope.md: the resources surface renders
 * without a session and is at most two navigations from every sensitive and
 * professional_discussion question screen, the onboarding privacy explanation,
 * and settings. Reachability is a property of the UI, so it cannot be proven by
 * a pgTAP file.
 */
test.describe("safety resources off-ramp", () => {
  test("renders for a signed-out visitor in both locales", async ({ page }, testInfo) => {
    const expectNoBrowserFailures = attachPageGuards(page, testInfo);

    for (const locale of ["en", "fr"] as const) {
      const response = await page.goto(`/${locale}/resources`);
      // No redirect to sign-in: someone under coercion may not be able to
      // reach a signed-in screen safely.
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveURL(new RegExp(`/${locale}/resources$`));
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByTestId("quick-exit")).toBeVisible();
    }

    await expectHealthyPage(page);
    await expectNoBrowserFailures();
  });

  test("offers a quick exit that leaves the app entirely", async ({ page }, testInfo) => {
    const expectNoBrowserFailures = attachPageGuards(page, testInfo);

    await page.goto("/en/welcome");
    await page.goto("/en/resources");

    const quickExit = page.getByTestId("quick-exit");
    await expect(quickExit).toBeVisible();

    // Record the attempted destination and abort it, so the test proves the
    // control leaves the app without actually loading a third-party site.
    const attempted: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest() && !request.url().includes("127.0.0.1")) {
        attempted.push(request.url());
      }
    });
    await page.route(/^https:\/\//, (route) => route.abort());

    await quickExit.click();

    await expect.poll(() => attempted.length).toBeGreaterThan(0);
    expect(attempted[0]).toMatch(/^https:\/\//);
    // The destination is off-app, so nothing about this journey stays on screen.
    expect(attempted[0]).not.toContain("/resources");

    await expectNoBrowserFailures();
  });

  test("is one navigation from the onboarding privacy explanation", async ({ page }, testInfo) => {
    const expectNoBrowserFailures = attachPageGuards(page, testInfo);

    await page.goto("/en/privacy");
    await page.getByRole("link", { name: /unsafe or pressured/i }).click();
    await expect(page).toHaveURL(/\/en\/resources$/);
    await expect(page.getByTestId("quick-exit")).toBeVisible();

    await expectHealthyPage(page);
    await expectNoBrowserFailures();
  });

  test("is one navigation from settings and from a sensitive question", async ({ page }, testInfo) => {
    test.skip(!process.env.E2E_BASE_URL, "Requires E2E_BASE_URL plus E2E_TEST_EMAIL/E2E_TEST_PASSWORD.");
    const credentials = getE2ECredentials();
    const expectNoBrowserFailures = attachPageGuards(page, testInfo);

    await signIn(page, credentials);

    await test.step("settings carries a persistent link", async () => {
      await page.goto("/en/settings");
      await page.getByRole("link", { name: /unsafe or pressured/i }).click();
      await expect(page).toHaveURL(/\/en\/resources$/);
      await expect(page.getByTestId("quick-exit")).toBeVisible();
    });

    await test.step("a sensitive question screen carries the same link", async () => {
      // family-boundaries-and-involvement question 307 is the seeded
      // professional_discussion prompt that already warns against entering
      // abuse detail, so it is exactly where the off-ramp has to appear.
      await page.goto("/en/topics/family-boundaries-and-involvement/questions/10000000-0000-4000-8000-000000000307");
      const link = page.getByRole("link", { name: /unsafe or pressured/i });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/en\/resources$/);
    });

    await expectHealthyPage(page);
    await expectNoBrowserFailures();
  });
});
