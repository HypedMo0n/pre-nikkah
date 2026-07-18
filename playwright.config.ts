import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  expect: { timeout: 8_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: "test-results/playwright",
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/e2e",
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: baseURL,
      },
  projects: [
    {
      name: "viewport-matrix",
      testMatch: /mobile-matrix\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "iphone-se",
      testMatch: /mobile-device\.spec\.ts/,
      use: { ...devices["iPhone SE"], browserName: "chromium" },
    },
    {
      name: "modern-iphone",
      testMatch: /mobile-device\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "pixel-android",
      testMatch: /mobile-device\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "tablet",
      testMatch: /mobile-device\.spec\.ts/,
      use: { ...devices["iPad (gen 7)"], browserName: "chromium" },
    },
    {
      name: "private-alpha",
      testMatch: /private-alpha\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
});
