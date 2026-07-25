"use client";

import { Analytics } from "@vercel/analytics/next";

import { removeLocalePrefix } from "@/lib/auth/paths";

/**
 * Analytics with the safety surface excluded.
 *
 * Vercel Analytics is cookieless and does not identify a visitor, but a
 * pageview for the resources route still records that someone opened the
 * coercion off-ramp. That surface exists for people whose activity may be
 * watched, so it should not appear in any dashboard at all. `beforeSend`
 * returning null drops the event before it is sent.
 */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const path = removeLocalePrefix(new URL(event.url).pathname);
        return path === "/resources" ? null : event;
      }}
    />
  );
}
