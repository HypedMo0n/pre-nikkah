import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = [
  "20260723000100_profiles_spaces_invites.sql",
  "20260723000200_topics_questions.sql",
  "20260723000300_answers_shares_comparisons.sql",
  "20260723000400_discussions_notes_events.sql",
  "20260723000500_space_lifecycle_and_deletion.sql",
  "20260723000600_space_creation_without_invite.sql",
  "20260723000700_partner_display_name.sql",
  "20260723000800_answer_share_status.sql",
];
const migrations = migrationFiles
  .map((fileName) => readFileSync(path.join(migrationsDirectory, fileName), "utf8"))
  .join("\n");

describe("migration source invariants", () => {
  it("enables RLS for every public table in the migration that creates it", () => {
    const createdTables = Array.from(
      migrations.matchAll(/create table public\.(\w+)/gi),
      (match) => match[1],
    );

    expect(createdTables).toHaveLength(13);
    for (const tableName of createdTables) {
      expect(migrations).toMatch(
        new RegExp(`alter table public\\.${tableName} enable row level security`, "i"),
      );
    }
  });

  it("fixes the search path on every SECURITY DEFINER function", () => {
    const functions = migrations.split(/create or replace function/i).slice(1);
    const definers = functions.filter((definition) => /security definer/i.test(definition));

    expect(definers.length).toBeGreaterThan(0);
    for (const definition of definers) {
      expect(definition).toMatch(/set search_path = public,(?: extensions,)? pg_temp/i);
    }
  });

  it("stores only invitation hashes and never defines a plaintext code column", () => {
    const inviteTable = migrations.match(
      /create table public\.space_invites \(([\s\S]*?)\n\);/i,
    )?.[1];

    expect(inviteTable).toBeDefined();
    expect(inviteTable).toContain("code_hash text unique not null");
    expect(inviteTable).not.toMatch(/\binvite_code\s+text\b/i);
  });

  it("never grants a client a direct write path onto comparisons", () => {
    expect(migrations).toContain("grant select on table public.comparisons to authenticated;");
    expect(migrations).not.toMatch(
      /grant\s+(?:insert|update|delete)[^;]*\btable public\.comparisons\b/i,
    );
  });

  it("never grants a policy path for a partner to read another user's answer directly", () => {
    expect(migrations).toContain('create policy "answer owner can read"');
    expect(migrations).toMatch(/answer owner can read"[\s\S]*?using \(user_id = \(select auth\.uid\(\)\)\)/);
    expect(migrations).not.toMatch(/create policy[^;]+answers[^;]+shared[^;]+for select/i);
  });

  it("keeps answer_shares insert-only — no delete/unshare path exists", () => {
    const shareFunctions = migrations.match(
      /create or replace function public\.share_answer[\s\S]*?\$\$;/,
    )?.[0];

    expect(shareFunctions).toBeDefined();
    expect(shareFunctions).not.toMatch(/delete from public\.answer_shares/);
    expect(migrations).not.toMatch(/delete from public\.answer_shares/);
  });
});
