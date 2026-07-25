import { expect, test } from "@playwright/test";

import { signIn } from "./utils/auth";
import { attachPageGuards, expectHealthyPage } from "./utils/observers";
import { getE2ECredentials } from "./utils/secrets";

/**
 * Proves item (b) of docs/product/alpha-scope.md: the resources surface renders
 * without a session and is at most two navigations from the question screens,
 * the onboarding explanation, and settings. Reachability is a property of the
 * UI, so it cannot be proven by a pgTAP file.
 *
 * The scope names the `sensitive` and `professional_discussion` question tiers,
 * but the v3 schema removed them, so the link sits on every question screen
 * instead, which is a superset of what the scope asks for.
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

  test("is one navigation from the onboarding explanation", async ({ page }, testInfo) => {
    const expectNoBrowserFailures = attachPageGuards(page, testInfo);

    // /privacy redirects here in v3, so this is the onboarding privacy surface.
    await page.goto("/en/product");
    await page.getByRole("link", { name: /unsafe or pressured/i }).click();
    await expect(page).toHaveURL(/\/en\/resources$/);
    await expect(page.getByTestId("quick-exit")).toBeVisible();

    await expectHealthyPage(page);
    await expectNoBrowserFailures();
  });

  test("is one navigation from settings and from a question screen", async ({ page }, testInfo) => {
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

    await test.step("a question screen carries the same link", async () => {
      await page.goto("/en/topics");
      await page.locator('a[href*="/topics/"]').first().click();
      await page.getByRole("link", { name: /begin|continue|start/i }).first().click();
      const link = page.getByRole("link", { name: /unsafe or pressured/i });
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/\/en\/resources$/);
    });

    await expectHealthyPage(page);
    await expectNoBrowserFailures();
  });
});
