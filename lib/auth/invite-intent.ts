import "server-only";

import { cookies } from "next/headers";

import { isInviteCode, normalizeInviteCode } from "@/features/invites/invite-code";

export const inviteIntentCookieName = "pn_invite_intent";

const maxAgeSeconds = 60 * 60 * 24 * 7;

export type InviteIntent = { code: string };

export async function setInviteIntent(rawCode: string) {
  const code = normalizeInviteCode(rawCode);
  if (!isInviteCode(code)) return;
  const store = await cookies();
  store.set(inviteIntentCookieName, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function getInviteIntent(): Promise<InviteIntent | null> {
  const store = await cookies();
  const code = normalizeInviteCode(store.get(inviteIntentCookieName)?.value ?? "");
  return isInviteCode(code) ? { code } : null;
}

export async function clearInviteIntent() {
  const store = await cookies();
  store.delete(inviteIntentCookieName);
}

export function inviteIntentPath(locale: "en" | "fr", intent: InviteIntent | null) {
  return intent ? `/${locale}/join/${encodeURIComponent(intent.code)}` : null;
}
