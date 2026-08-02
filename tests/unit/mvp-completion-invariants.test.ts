import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), "utf8");

describe("v3 endpoint invariants", () => {
  it("saves answers through one transactional server RPC", () => {
    const actions = source("features", "v3", "actions.ts");
    expect(actions).toContain('supabase.rpc("save_answer"');
    expect(actions).not.toContain('.from("answers").upsert');
    expect(actions).not.toContain('.from("comparisons").');
  });

  it("shares and revokes exact answers only through the server RPCs", () => {
    const actions = source("features", "v3", "actions.ts");
    expect(actions).toContain('supabase.rpc("share_answer"');
    // Revoke is required by the answer-privacy model; see the amendment in
    // docs/product/alpha-scope.md. This assertion previously read the other
    // way round, requiring that no revoke path existed at all.
    expect(actions).toContain('supabase.rpc("revoke_answer"');
    // The point that still holds: neither direction touches answer_shares
    // from the client, so the membership and ownership checks cannot be
    // bypassed.
    expect(actions).not.toMatch(/from\("answer_shares"\)/);
  });

  it("derives both participants progress through the protected count RPC", () => {
    const data = source("features", "v3", "data.ts");
    expect(data).toContain('client.rpc("get_topic_progress"');
    expect(data).toContain("row.user_id === userId");
    expect(data).toContain("row.user_id !== userId");
  });

  it("closes only the authenticated user current space", () => {
    const actions = source("features", "v3", "actions.ts");
    const closeAction = actions.slice(
      actions.indexOf("export async function closeSpaceAction"),
    );
    expect(closeAction).toContain('supabase.rpc("close_space")');
    expect(closeAction).not.toContain("p_space_id");
  });
});
