"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

/**
 * Neutral destination for a quick exit. It must be somewhere unremarkable that
 * raises no questions if someone else looks at the screen a moment later.
 */
const NEUTRAL_DESTINATION = "https://www.google.com";

/**
 * Leaves via `location.replace`, so the current entry is overwritten rather
 * than stacked. A browser will not let a page erase the entries before it, so
 * the resources page is explicit that this does not clear browsing history.
 */
function leaveNow() {
  window.location.replace(NEUTRAL_DESTINATION);
}

export function QuickExit({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") leaveNow();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Button
      className="w-full"
      data-testid="quick-exit"
      onClick={leaveNow}
      variant="danger"
    >
      {d["safety.quickExit"]}
    </Button>
  );
}
