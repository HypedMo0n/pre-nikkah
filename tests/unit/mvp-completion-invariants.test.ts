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

  it("shares exact answers only through the irreversible endpoint", () => {
    const actions = source("features", "v3", "actions.ts");
    expect(actions).toContain('supabase.rpc("share_answer"');
    expect(actions).not.toMatch(/delete\(\).*answer_shares|revoke.*answer/i);
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
