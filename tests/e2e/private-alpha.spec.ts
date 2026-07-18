import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_A_EMAIL;
const password = process.env.E2E_USER_A_PASSWORD;

test.describe("authenticated private-alpha journey", () => {
  test.skip(!email || !password, "Requires an isolated authenticated E2E account.");

  test("restores an authenticated session and keeps private routes protected", async ({ page, context }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email ?? "");
    await page.locator("#sign-in-password").fill(password ?? "");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    await expect(page).toHaveURL(/\/en\/(dashboard|onboarding\/account)/);

    const storedState = await context.storageState();
    expect(storedState.cookies.length).toBeGreaterThan(0);
    await page.reload();
    await expect(page).not.toHaveURL(/\/sign-in/);
  });

  test("private pages have no document-level horizontal overflow", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByLabel("Email").fill(email ?? "");
    await page.locator("#sign-in-password").fill(password ?? "");
    await page.getByRole("button", { name: "Sign in securely" }).click();
    if (page.url().includes("/dashboard")) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth + 1),
      );
    }
  });
});
