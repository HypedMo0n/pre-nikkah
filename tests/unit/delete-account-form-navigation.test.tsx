// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/account-deletion/actions", () => ({
  deleteOwnAccountAction: vi.fn(),
}));

const stateMock = vi.hoisted(() => ({
  current: { status: "idle" } as { status: "idle" } | { status: "error"; message: string } | { status: "deleted"; redirectTo: string },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [stateMock.current, vi.fn(), false],
  };
});

const { DeleteAccountForm } = await import("@/components/settings/delete-account-form");

describe("DeleteAccountForm deletion navigation", () => {
  const originalLocation = window.location;
  const replace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    stateMock.current = { status: "idle" };
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, replace },
    });
  });

  it("does not navigate while idle", () => {
    render(<DeleteAccountForm locale="en" />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not navigate while showing an error", () => {
    stateMock.current = { status: "error", message: "Could not delete" };
    render(<DeleteAccountForm locale="en" />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("uses full-document navigation exactly once after deletion", async () => {
    stateMock.current = { status: "deleted", redirectTo: "/fr/account-deleted" };
    const { rerender } = render(<DeleteAccountForm locale="fr" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/fr/account-deleted"));
    rerender(<DeleteAccountForm locale="fr" />);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
