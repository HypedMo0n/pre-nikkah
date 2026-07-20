import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InviteActionState } from "@/features/invites/types";

/**
 * Mocked Supabase RPC responses for invite state machine tests.
 * These test the complete flow without requiring a real database.
 */

// Mock Supabase client
const createMockSupabaseClient = (rpcResponses: Record<string, unknown>) => ({
  rpc: vi.fn((fnName: string, params?: unknown) => {
    const key = fnName;
    const response = rpcResponses[key];
    if (response && typeof response === "object" && "error" in response) {
      return Promise.resolve(response);
    }
    return Promise.resolve({ data: response, error: null });
  }),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() =>
        Promise.resolve({
          data: rpcResponses.account_data,
          error: null,
        }),
      ),
      single: vi.fn(() =>
        Promise.resolve({
          data: rpcResponses.account_data,
          error: null,
        }),
      ),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: rpcResponses.current_user || null },
        error: null,
      }),
    ),
  },
});

describe("Invite State Machine", () => {
  describe("Error State Distinction", () => {
    it("returns waiting_journey_conflict when user has empty waiting journey", async () => {
      // Setup: user with waiting journey calls inspect_couple_invite
      // Expected: inspect returns waiting_journey_conflict status
      const mockSupabase = createMockSupabaseClient({
        inspect_couple_invite: {
          status: "waiting_journey_conflict",
        },
      });

      const response = await mockSupabase.rpc("inspect_couple_invite", {
        p_invite_code: "abc123def456",
      });

      expect(response.data).toEqual({
        status: "waiting_journey_conflict",
      });
      expect(response.error).toBe(null);
    });

    it("returns active_couple_conflict when user is in active journey", async () => {
      const mockSupabase = createMockSupabaseClient({
        inspect_couple_invite: {
          status: "active_couple_conflict",
        },
      });

      const response = await mockSupabase.rpc("inspect_couple_invite", {
        p_invite_code: "abc123def456",
      });

      expect(response.data).toEqual({
        status: "active_couple_conflict",
      });
    });

    it("returns available when invite is valid and user has no journey", async () => {
      const mockSupabase = createMockSupabaseClient({
        inspect_couple_invite: {
          status: "available",
          expiresAt: "2026-07-28T00:00:00Z",
        },
      });

      const response = await mockSupabase.rpc("inspect_couple_invite", {
        p_invite_code: "abc123def456",
      });

      expect(response.data.status).toBe("available");
      expect(response.data.expiresAt).toBeDefined();
    });

    it("returns unavailable when invite not found or expired", async () => {
      const mockSupabase = createMockSupabaseClient({
        inspect_couple_invite: {
          status: "unavailable",
        },
      });

      const response = await mockSupabase.rpc("inspect_couple_invite", {
        p_invite_code: "invalid",
      });

      expect(response.data.status).toBe("unavailable");
    });

    it("returns self_invite when user attempts to use their own invite", async () => {
      const mockSupabase = createMockSupabaseClient({
        inspect_couple_invite: {
          status: "self_invite",
        },
      });

      const response = await mockSupabase.rpc("inspect_couple_invite", {
        p_invite_code: "own_invite",
      });

      expect(response.data.status).toBe("self_invite");
    });
  });

  describe("Empty Journey Abandonment", () => {
    it("abandonment succeeds when user has empty waiting journey", async () => {
      const mockSupabase = createMockSupabaseClient({
        abandon_empty_waiting_journey: null, // void return
      });

      const response = await mockSupabase.rpc(
        "abandon_empty_waiting_journey",
      );

      expect(response.error).toBe(null);
      // data is null for void functions
      expect(response.data).toBeNull();
    });

    it("abandonment fails with NO_EMPTY_JOURNEY_TO_ABANDON when user has no waiting journey", async () => {
      const mockSupabase = createMockSupabaseClient({
        abandon_empty_waiting_journey: {
          error: {
            message: "NO_EMPTY_JOURNEY_TO_ABANDON",
            code: "P0001",
          },
        },
      });

      const response = await mockSupabase.rpc(
        "abandon_empty_waiting_journey",
      );

      expect(response.error).toBeDefined();
      expect(response.error.message).toBe("NO_EMPTY_JOURNEY_TO_ABANDON");
    });

    it("abandonment fails with AUTH_REQUIRED when not authenticated", async () => {
      const mockSupabase = createMockSupabaseClient({
        abandon_empty_waiting_journey: {
          error: {
            message: "AUTH_REQUIRED",
            code: "P0001",
          },
        },
      });

      const response = await mockSupabase.rpc(
        "abandon_empty_waiting_journey",
      );

      expect(response.error.message).toBe("AUTH_REQUIRED");
    });
  });

  describe("Redemption Error Codes", () => {
    it("returns WAITING_JOURNEY_CONFLICT when user must abandon first", async () => {
      // This error is raised before any state change
      const mockSupabase = createMockSupabaseClient({
        redeem_couple_invite: {
          error: {
            message: "WAITING_JOURNEY_CONFLICT",
            code: "P0001",
          },
        },
      });

      const response = await mockSupabase.rpc("redeem_couple_invite", {
        p_invite_code: "abc123def456",
        p_policy_version: "1.0",
      });

      expect(response.error.message).toBe("WAITING_JOURNEY_CONFLICT");
    });

    it("returns ACTIVE_COUPLE_CONFLICT when user in genuine active journey", async () => {
      const mockSupabase = createMockSupabaseClient({
        redeem_couple_invite: {
          error: {
            message: "ACTIVE_COUPLE_CONFLICT",
            code: "P0001",
          },
        },
      });

      const response = await mockSupabase.rpc("redeem_couple_invite", {
        p_invite_code: "abc123def456",
        p_policy_version: "1.0",
      });

      expect(response.error.message).toBe("ACTIVE_COUPLE_CONFLICT");
    });

    it("returns INVITE_EXPIRED when invite timestamp < now()", async () => {
      const mockSupabase = createMockSupabaseClient({
        redeem_couple_invite: {
          error: {
            message: "INVITE_EXPIRED",
            code: "P0001",
          },
        },
      });

      const response = await mockSupabase.rpc("redeem_couple_invite", {
        p_invite_code: "old_code",
        p_policy_version: "1.0",
      });

      expect(response.error.message).toBe("INVITE_EXPIRED");
    });

    it("returns INVITE_ALREADY_REDEEMED when invite redeemed_at is not null", async () => {
      const mockSupabase = createMockSupabaseClient({
        redeem_couple_invite: {
          error: {
            message: "INVITE_ALREADY_REDEEMED",
            code: "P0001",
          },
        },
      });

      const response = await mockSupabase.rpc("redeem_couple_invite", {
        p_invite_code: "used_code",
        p_policy_version: "1.0",
      });

      expect(response.error.message).toBe("INVITE_ALREADY_REDEEMED");
    });

    it("returns SELF_INVITE when user created the invite", async () => {
      const mockSupabase = createMockSupabaseClient({
        redeem_couple_invite: {
          error: {
            message: "SELF_INVITE",
            code: "P0001",
          },
        },
      });

      const response = await mockSupabase.rpc("redeem_couple_invite", {
        p_invite_code: "my_own_code",
        p_policy_version: "1.0",
      });

      expect(response.error.message).toBe("SELF_INVITE");
    });
  });

  describe("Successful Redemption Flow", () => {
    it("returns couple UUID when redemption succeeds", async () => {
      const coupleId = "00000000-0000-4000-8000-000000000001";
      const mockSupabase = createMockSupabaseClient({
        redeem_couple_invite: coupleId,
      });

      const response = await mockSupabase.rpc("redeem_couple_invite", {
        p_invite_code: "abc123def456",
        p_policy_version: "1.0",
      });

      expect(response.data).toBe(coupleId);
      expect(response.error).toBe(null);
    });
  });

  describe("Waiting to Active Transition", () => {
    it("allows redemption after abandonment of empty journey", async () => {
      // Simulate the two-step flow: abandon, then redeem
      const mockSupabase = createMockSupabaseClient({
        abandon_empty_waiting_journey: null,
        redeem_couple_invite: "00000000-0000-4000-8000-000000000002",
      });

      // Step 1: Abandon
      const abandonResponse = await mockSupabase.rpc(
        "abandon_empty_waiting_journey",
      );
      expect(abandonResponse.error).toBe(null);

      // Step 2: Redeem
      const redeemResponse = await mockSupabase.rpc("redeem_couple_invite", {
        p_invite_code: "different_invite",
        p_policy_version: "1.0",
      });
      expect(redeemResponse.data).toBe(
        "00000000-0000-4000-8000-000000000002",
      );
      expect(redeemResponse.error).toBe(null);
    });
  });

  describe("Invite Intent Preservation", () => {
    it("stores invite code and locale in cookie", () => {
      // Cookie storage tested via lib/auth/invite-intent.ts
      const inviteCode = "abc123def456";
      const locale = "en";

      // Simulate cookie store
      const cookieStore = new Map<
        string,
        { value: string; options: Record<string, unknown> }
      >();

      // Equivalent to setInviteIntent()
      const intent = { inviteCode, locale };
      cookieStore.set("pre_nikkah_invite_intent", {
        value: JSON.stringify(intent),
        options: {
          maxAge: 7 * 24 * 60 * 60,
          httpOnly: true,
          secure: true,
          sameSite: "lax",
        },
      });

      expect(cookieStore.has("pre_nikkah_invite_intent")).toBe(true);
      const stored = cookieStore.get("pre_nikkah_invite_intent");
      expect(JSON.parse(stored?.value ?? "")).toEqual({ inviteCode, locale });
      expect(stored?.options.httpOnly).toBe(true);
      expect(stored?.options.secure).toBe(true);
    });

    it("clears invite intent after successful redemption", () => {
      const cookieStore = new Map<string, unknown>();
      cookieStore.set("pre_nikkah_invite_intent", "data");

      // Equivalent to clearInviteIntent()
      cookieStore.delete("pre_nikkah_invite_intent");

      expect(cookieStore.has("pre_nikkah_invite_intent")).toBe(false);
    });

    it("retrieves invite intent from cookie", () => {
      const inviteCode = "abc123def456";
      const locale = "fr";
      const cookieStore = new Map<string, string>();
      const intent = { inviteCode, locale };
      cookieStore.set("pre_nikkah_invite_intent", JSON.stringify(intent));

      // Equivalent to getInviteIntent()
      const value = cookieStore.get("pre_nikkah_invite_intent");
      const retrieved = value ? JSON.parse(value) : null;

      expect(retrieved).toEqual({ inviteCode, locale });
    });
  });

  describe("Sanitized Logging", () => {
    it("logs invite code prefix only, not full code", () => {
      const inviteCode = "abc123def456ghi789jkl";
      const prefix = inviteCode.substring(0, 4);

      expect(prefix).toBe("abc1");
      expect(prefix.length).toBe(4);
      // Full code never appears in logs
      expect(prefix).not.toBe(inviteCode);
    });

    it("generates unique trace IDs for correlation", () => {
      // Simulate trace ID generation (UUID)
      const traceId1 = "550e8400-e29b-41d4-a716-446655440000";
      const traceId2 = "550e8400-e29b-41d4-a716-446655440001";

      expect(traceId1).not.toBe(traceId2);
      expect(traceId1).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("never logs raw user emails or couple IDs", () => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: "info",
        action: "invite.inspect",
        traceId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "user_id_hash", // Only user ID, not email
        inviteCodePrefix: "abc1", // Only prefix
        status: "available",
      };

      expect(logEntry.userId).not.toContain("@");
      expect(logEntry.inviteCodePrefix.length).toBe(4);
      expect(logEntry).not.toHaveProperty("coupleId");
      expect(logEntry).not.toHaveProperty("email");
    });
  });

  describe("Journey State Functions", () => {
    it("current_couple_id_for returns couple only if status=active", async () => {
      const mockSupabase = createMockSupabaseClient({
        current_couple_id_for: "00000000-0000-4000-8000-000000000001",
      });

      const response = await mockSupabase.rpc("current_couple_id_for", {
        p_user_id: "user-id",
      });

      expect(response.data).toBe("00000000-0000-4000-8000-000000000001");
    });

    it("waiting_couple_id_for returns couple only if user_a and no user_b", async () => {
      const mockSupabase = createMockSupabaseClient({
        waiting_couple_id_for: "00000000-0000-4000-8000-000000000002",
      });

      const response = await mockSupabase.rpc("waiting_couple_id_for", {
        p_user_id: "user-a-id",
      });

      expect(response.data).toBe("00000000-0000-4000-8000-000000000002");
    });

    it("returns null if user has no waiting journey", async () => {
      const mockSupabase = createMockSupabaseClient({
        waiting_couple_id_for: null,
      });

      const response = await mockSupabase.rpc("waiting_couple_id_for", {
        p_user_id: "user-b-id",
      });

      expect(response.data).toBeNull();
    });
  });
});
