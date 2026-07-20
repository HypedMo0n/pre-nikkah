import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("MVP completion security invariants", () => {
  it("derives checklist couple ownership on the server", () => {
    const action = source("features", "checklist", "actions.ts");
    expect(action).toContain('supabase.rpc(\n    "current_couple_id"');
    expect(action).not.toContain('formData.get("coupleId")');
    expect(action).toContain('{ onConflict: "couple_id,checklist_definition_id" }');
  });

  it("closes only the authenticated user current journey", () => {
    const action = source("features", "settings", "actions.ts");
    const validation = source("features", "settings", "validation.ts");
    expect(validation).toContain('z.literal("CLOSE")');
    expect(action).toContain('requireAuthenticatedUser(locale)');
    expect(action).toContain('supabase.rpc("close_couple_journey")');
    expect(action).not.toMatch(/formData\.get\(["'](?:userId|coupleId)["']\)/);
  });

  it("lists reveal management without selecting raw answer values", () => {
    const settingsPage = source(
      "app",
      "[locale]",
      "(private)",
      "settings",
      "page.tsx",
    );
    expect(settingsPage).toContain('.from("answers")');
    expect(settingsPage).toContain('.select("question_id")');
    expect(settingsPage).not.toMatch(/\.select\(["'][^"']*\bvalue\b/);
    expect(settingsPage).toContain('name="revealed" type="hidden" value="false"');
  });
});
