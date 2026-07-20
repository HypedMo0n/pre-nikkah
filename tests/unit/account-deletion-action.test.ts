import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  deleteVerifiedAuthenticatedAccount: vi.fn(),
  logServerActionError: vi.fn(() => "trace1234"),
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock("@/features/account-deletion/service", () => ({
  deleteVerifiedAuthenticatedAccount: mocks.deleteVerifiedAuthenticatedAccount,
}));
vi.mock("@/lib/auth/require-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("@/lib/logging/server-action-error", async () => {
  const actual = await vi.importActual<typeof import("@/lib/logging/server-action-error")>("@/lib/logging/server-action-error");
  return { ...actual, logServerActionError: mocks.logServerActionError };
});

const { deleteOwnAccountAction } = await import("@/features/account-deletion/actions");

function form(locale: "en" | "fr") {
  const data = new FormData();
  data.set("locale", locale);
  data.set("confirmation", "DELETE");
  data.set("password", "correct-password");
  return data;
}

function authenticated(signOutResult: unknown = { error: null }) {
  const supabase = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue(signOutResult),
    },
  };
  mocks.requireAuthenticatedUser.mockResolvedValue({
    supabase,
    user: { email: "person@example.test", id: "11111111-1111-4111-8111-111111111111" },
  });
  return supabase;
}

describe("deleteOwnAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteVerifiedAuthenticatedAccount.mockResolvedValue(undefined);
  });

  it("returns the English deleted redirect state after successful deletion", async () => {
    authenticated();
    await expect(deleteOwnAccountAction({ status: "idle" }, form("en"))).resolves.toEqual({
      status: "deleted",
      redirectTo: "/en/account-deleted",
    });
  });

  it("returns the French deleted redirect state after successful deletion", async () => {
    authenticated();
    await expect(deleteOwnAccountAction({ status: "idle" }, form("fr"))).resolves.toEqual({
      status: "deleted",
      redirectTo: "/fr/account-deleted",
    });
  });

  it("returns an error with a trace ID when prepare_account_deletion fails", async () => {
    authenticated();
    mocks.deleteVerifiedAuthenticatedAccount.mockRejectedValue(new Error("ACCOUNT_DELETION_FAILED:abc123ef"));
    const result = await deleteOwnAccountAction({ status: "idle" }, form("en"));
    expect(result.status).toBe("error");
    expect(result).toMatchObject({ message: expect.stringContaining("abc123ef") });
  });

  it("returns an error with a trace ID when admin deleteUser fails", async () => {
    authenticated();
    mocks.deleteVerifiedAuthenticatedAccount.mockRejectedValue(new Error("ACCOUNT_DELETION_FAILED:def456ab"));
    const result = await deleteOwnAccountAction({ status: "idle" }, form("en"));
    expect(result.status).toBe("error");
    expect(result).toMatchObject({ message: expect.stringContaining("def456ab") });
  });

  it("still returns deleted when local sign-out fails after deletion", async () => {
    authenticated({ error: { message: "local storage unavailable" } });
    await expect(deleteOwnAccountAction({ status: "idle" }, form("en"))).resolves.toEqual({
      status: "deleted",
      redirectTo: "/en/account-deleted",
    });
    expect(mocks.logServerActionError).toHaveBeenCalledWith(expect.objectContaining({
      action: "account_deletion.local_sign_out",
      userId: "deleted-user",
    }));
  });
});
