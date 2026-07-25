import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

import { redactSensitive } from "./secrets";

const allowedConsolePatterns = [/favicon/i, /ResizeObserver loop/i];

export function attachPageGuards(page: Page, testInfo: TestInfo) {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = redactSensitive(message.text());
    if (allowedConsolePatterns.some((pattern) => pattern.test(text))) return;
    failures.push(`console error: ${text}`);
  });

  page.on("pageerror", (error) => {
    failures.push(`uncaught page error: ${redactSensitive(error.message)}`);
  });

  page.on("response", (response) => {
    if (response.status() >= 500) {
      failures.push(`HTTP ${response.status()}: ${redactSensitive(response.url())}`);
    }
  });

  return async function expectNoBrowserFailures() {
    if (failures.length > 0) {
      await testInfo.attach("safe-browser-failures", {
        body: failures.join("\n"),
        contentType: "text/plain",
      });
    }
    expect(failures).toEqual([]);
  };
}

export async function expectHealthyPage(page: Page) {
  await expect(page.getByText(/Next\.js digest|Page Not Found|Save failed/i)).toHaveCount(0);
}
