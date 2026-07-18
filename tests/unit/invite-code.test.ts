import { describe, expect, it } from "vitest";

import { formatInviteCode, invitationPath, isInviteCode, normalizeInviteCode } from "../../features/invites/invite-code";

describe("opaque invitation code", () => {
  it("normalizes and formats an 80-bit hex token", () => {
    const raw = "A1B2-C3D4-E5F6-0718-90AB";
    expect(normalizeInviteCode(raw)).toBe("a1b2c3d4e5f6071890ab");
    expect(formatInviteCode(raw)).toBe("A1B2 C3D4 E5F6 0718 90AB");
    expect(isInviteCode(raw)).toBe(true);
  });

  it("builds a QR-safe path containing only locale and opaque token", () => {
    expect(invitationPath("en", "a1b2c3d4e5f6071890ab")).toBe("/en/join/a1b2c3d4e5f6071890ab");
  });
});
