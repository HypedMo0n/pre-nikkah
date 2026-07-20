import { cookies } from "next/headers";

const INVITE_INTENT_COOKIE = "pre_nikkah_invite_intent";
const INVITE_INTENT_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export type InviteIntent = {
  inviteCode: string;
  locale: string;
};

/**
 * Preserve invite code and locale through sign-up flow.
 * Stores in httpOnly, secure cookie to survive redirects.
 */
export async function setInviteIntent(
  inviteCode: string,
  locale: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(INVITE_INTENT_COOKIE, JSON.stringify({ inviteCode, locale }), {
    maxAge: INVITE_INTENT_MAX_AGE,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
}

/**
 * Retrieve stored invite intent.
 * Returns null if not found or parsing fails.
 */
export async function getInviteIntent(): Promise<InviteIntent | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(INVITE_INTENT_COOKIE)?.value;
  if (!value) return null;

  try {
    return JSON.parse(value) as InviteIntent;
  } catch {
    return null;
  }
}

/**
 * Clear the invite intent cookie after successful redemption or cancellation.
 */
export async function clearInviteIntent(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(INVITE_INTENT_COOKIE);
}
