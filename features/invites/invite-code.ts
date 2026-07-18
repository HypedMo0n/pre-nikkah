const INVITE_CODE_LENGTH = 20;

export function normalizeInviteCode(value: string) {
  return value.toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, INVITE_CODE_LENGTH);
}

export function isInviteCode(value: string) {
  return /^[0-9a-f]{20}$/.test(normalizeInviteCode(value));
}

export function formatInviteCode(value: string) {
  const normalized = normalizeInviteCode(value).toUpperCase();
  return normalized.match(/.{1,4}/g)?.join(" ") ?? normalized;
}

export function invitationPath(locale: "en" | "fr", value: string) {
  return `/${locale}/join/${normalizeInviteCode(value)}`;
}
