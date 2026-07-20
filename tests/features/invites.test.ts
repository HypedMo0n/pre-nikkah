import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
    set: (name: string, value: string) => cookieStore.set(name, value),
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

import { getPostLoginRoute } from "../../features/auth/post-login-router";
import { normalizeInviteCode } from "../../features/invites/invite-code";
import { clearInviteIntent, getInviteIntent, setInviteIntent } from "../../lib/auth/invite-intent";
import { safeReturnPath } from "../../lib/auth/paths";
import { logServerActionError } from "../../lib/logging/server-action-error";

function supabaseWithStatus(status: string) {
  return { rpc: vi.fn().mockResolvedValue({ data: { status }, error: null }) } as never;
}

describe("invite journey routing", () => {
  beforeEach(() => cookieStore.clear());

  it("routes users with no journey to the safe requested path", async () => {
    await expect(getPostLoginRoute("en", supabaseWithStatus("not_connected"), "/en/dashboard")).resolves.toBe("/en/dashboard");
  });

  it("routes waiting journey conflicts to the real waiting page", async () => {
    await expect(getPostLoginRoute("en", supabaseWithStatus("waiting"), "/en/dashboard")).resolves.toBe("/en/onboarding/waiting-journey");
  });

  it("keeps active journey users on the safe requested route instead of enabling invite join", async () => {
    await expect(getPostLoginRoute("en", supabaseWithStatus("active"), "/en/dashboard")).resolves.toBe("/en/dashboard");
  });

  it("rejects unsafe post-login next values", () => {
    expect(safeReturnPath("en", "https://evil.example/invite")).toBe("/en/dashboard");
    expect(safeReturnPath("en", "//evil.example/invite")).toBe("/en/dashboard");
    expect(safeReturnPath("en", "/fr/dashboard")).toBe("/en/dashboard");
  });
});

describe("invite intent cookies", () => {
  beforeEach(() => cookieStore.clear());

  it("persists normalized invite intent through auth steps", async () => {
    await setInviteIntent("abcd-1234-efgh-5678");
    await expect(getInviteIntent()).resolves.toEqual({ code: normalizeInviteCode("abcd-1234-efgh-5678") });
  });

  it("clears invite intent only when requested after successful redemption", async () => {
    await setInviteIntent("abcd-1234-efgh-5678");
    await clearInviteIntent();
    await expect(getInviteIntent()).resolves.toBeNull();
  });

  it("prioritizes persisted invite intent after sign-in or callback", async () => {
    await setInviteIntent("abcd-1234-efgh-5678");
    await expect(getPostLoginRoute("en", supabaseWithStatus("not_connected"), "/en/dashboard")).resolves.toBe("/en/join/abcd1234efgh5678");
  });
});

describe("invite action outcomes", () => {
  it("represents successful empty-journey abandonment as a no-error RPC outcome", async () => {
    const supabase = { rpc: vi.fn().mockResolvedValue({ error: null }) };
    await expect(supabase.rpc("abandon_empty_waiting_journey")).resolves.toEqual({ error: null });
  });

  it("represents failed abandonment as a returned RPC error", async () => {
    const error = new Error("not empty");
    const supabase = { rpc: vi.fn().mockResolvedValue({ error }) };
    await expect(supabase.rpc("abandon_empty_waiting_journey")).resolves.toEqual({ error });
  });

  it("represents successful redemption RPC and profile entry-mode update", async () => {
    const supabase: {
      rpc: (name: string, args: Record<string, string>) => Promise<{ error: null }>;
      from: (table: string) => {
        update: (values: { entry_mode: string }) => {
          eq: (column: string, value: string) => Promise<{ error: null }>;
        };
      };
    } = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) })),
    };
    await expect(supabase.rpc("redeem_couple_invite", { p_invite_code: "abcd1234efgh5678", p_policy_version: "2026-07-18" })).resolves.toEqual({ error: null });
    const table = supabase.from("private_accounts");
    const updateResult = table.update({ entry_mode: "join" });
    expect(updateResult.eq("id", "user-1")).resolves.toEqual({ error: null });
  });

  it("sanitizes logging context without raw invite codes", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logServerActionError({ action: "invite.redeem", error: new Error("bad code"), userId: "user-1", context: { inviteId: "00000000-0000-4000-8000-000000000000" } });
    expect(spy.mock.calls.join("\n")).not.toContain("abcd1234efgh5678");
    spy.mockRestore();
  });
});
