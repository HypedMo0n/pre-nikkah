"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mediaQueryList = window.matchMedia(query);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

function getServerSnapshot() {
  return false;
}

// §9's reduced-motion block in globals.css only reaches CSS transitions —
// it can't touch the WAAPI-driven animations Motion produces, so every
// Motion-based component in the product checks this hook itself and
// substitutes the §9-mandated 200ms opacity crossfade (or nothing) for
// its slide/spring. useSyncExternalStore rather than useState+useEffect:
// the server has no notion of the browser's motion preference, so the
// server snapshot is a fixed `false` and the real value syncs in on the
// client without a hydration mismatch.
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
