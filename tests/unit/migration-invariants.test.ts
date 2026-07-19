import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = [
  "20260718000100_accounts_couples_invites.sql",
  "20260718000200_canonical_content.sql",
  "20260718000300_answers_and_progress.sql",
  "20260718000400_shared_journey_and_lifecycle.sql",
  "20260718000500_safe_read_functions.sql",
  "20260719000100_fix_invite_policy_upsert.sql",
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

    expect(createdTables).toHaveLength(14);
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
      /create table public\.couple_invites \(([\s\S]*?)\n\);/i,
    )?.[1];

    expect(inviteTable).toBeDefined();
    expect(inviteTable).toContain("code_hash text unique not null");
    expect(inviteTable).not.toMatch(/\binvite_code\s+text\b/i);
  });

  it("avoids an ambiguous conflict target in the invite policy acceptance upsert", () => {
    const repair = readFileSync(
      path.join(
        migrationsDirectory,
        "20260719000100_fix_invite_policy_upsert.sql",
      ),
      "utf8",
    );

    expect(repair).toContain("on conflict do nothing");
    expect(repair).not.toContain(
      "on conflict (couple_id, user_id, policy_version)",
    );
    expect(repair).toContain(
      "update public.journey_policy_acceptances acceptance",
    );
  });

  it("contains the approved onboarding and journey-policy schema", () => {
    expect(migrations).toContain("preferred_locale text not null default 'en'");
    expect(migrations).toContain("onboarding_completed boolean not null default false");
    expect(migrations).toContain("privacy_intro_completed boolean not null default false");
    expect(migrations).toContain("entry_mode text null");
    expect(migrations).toContain("preferred_pace text not null default 'flexible'");
    expect(migrations).toContain("create table public.journey_policy_acceptances");
    expect(migrations).toContain("JOURNEY_POLICY_ACCEPTANCE_REQUIRED");
  });

  it("uses explicit safe comparison modes for every seeded question", () => {
    const seed = readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8");
    const questionRows = seed
      .split("insert into public.questions")[1]
      .split("on conflict (id) do update")[0]
      .split(/\n\s*\),\s*\n\s*\(/);
    const textRows = questionRows.filter((row) => /\n\s*'text',/.test(row));
    expect(textRows.length).toBeGreaterThan(0);
    for (const row of textRows) expect(row).toMatch(/'(?:discussion_only|never_compare)'/);
    expect(seed).toContain("'discussion_only'");
    expect(migrations).toContain("when 'scale_distance' then");
    expect(migrations).toContain("when 'discussion_only' then");
    expect(migrations).toContain("when 'never_compare' then");
  });

  it("never grants direct partner-answer reads after reveal", () => {
    expect(migrations).toContain('create policy "answer owner can read"');
    expect(migrations).not.toMatch(/create policy[^;]+answers[^;]+revealed[^;]+for select/i);
  });
});
