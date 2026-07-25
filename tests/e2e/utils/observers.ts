import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

import { redactSensitive } from "./secrets";

// `/_vercel/insights/script.js` is injected by @vercel/analytics and is only
// served by Vercel's edge, so it 404s against a local `next start` and returns
// an HTML error page that trips strict MIME checking. Same class of
// off-platform noise as a missing favicon, not a defect under test.
const allowedConsolePatterns = [/favicon/i, /ResizeObserver loop/i, /_vercel\/insights/i];

export function attachPageGuards(page: Page, testInfo: TestInfo) {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = redactSensitive(message.text());
    // A failed resource load reports only a generic "Failed to load resource"
    // message; the URL that actually failed is on the console location, so
    // allowances have to be matched against both.
    const source = redactSensitive(message.location()?.url ?? "");
    if (allowedConsolePatterns.some((pattern) => pattern.test(text) || pattern.test(source))) return;
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
