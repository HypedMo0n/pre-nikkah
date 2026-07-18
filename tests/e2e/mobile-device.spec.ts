import { expect, test } from "@playwright/test";

test("language choice and localized onboarding remain touch accessible", async ({ page }) => {
  await page.goto("/");
  const english = page.getByRole("button", { name: "English" });
  const french = page.getByRole("button", { name: "Français" });
  await expect(english).toBeVisible();
  await expect(french).toBeVisible();
  for (const control of [english, french]) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await french.click();
  await expect(page).toHaveURL(/\/fr\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vous avez trouvé quelqu’un");
  await expect(page.evaluate(() => document.documentElement.scrollWidth)).resolves.toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth + 1),
  );
});

test("auth forms have labelled controls, usable text size, and visible keyboard focus", async ({ page }) => {
  await page.goto("/en/sign-in");
  const email = page.getByLabel("Email");
  const password = page.locator("#sign-in-password");
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  expect(await email.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
