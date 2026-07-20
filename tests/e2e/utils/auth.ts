import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(credentials.email);
  await page.locator("#sign-in-password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/en\/(dashboard|onboarding\/account|onboarding\/waiting-journey|join\/)/);
}
