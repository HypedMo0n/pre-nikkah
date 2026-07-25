import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(
    path.join(process.cwd(), "supabase", "migrations", name),
    "utf8",
  );
const schema = migration("20260724000100_together_in_amanah.sql");
const content = migration("20260724000200_question_bank_en.sql");
const frenchTopics = migration("20260724000300_topic_bank_fr.sql");

describe("v3 migration invariants", () => {
  it("installs the privacy-first state model", () => {
    for (const table of [
      "profiles",
      "spaces",
      "space_members",
      "answers",
      "private_answer_notes",
      "answer_shares",
      "comparisons",
      "discussions",
      "shared_notes",
    ]) {
      expect(schema).toContain(`create table public.${table}`);
      expect(schema).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps exact answers and private notes out of shared comparison rows", () => {
    const comparisonTable = schema.match(
      /create table public\.comparisons \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(comparisonTable).toContain("state text");
    expect(comparisonTable).toContain("priority text");
    expect(comparisonTable).not.toMatch(/option_key|private_note|answer_value/);
  });

  it("permits mutations only through the approved functions", () => {
    expect(schema).toContain(
      "revoke all on all tables in schema public from public, anon, authenticated",
    );
    expect(schema).toContain(
      "revoke all on all functions in schema public from public, anon, authenticated",
    );
    expect(schema).toContain("public.save_answer(uuid, uuid, text, text, text)");
    expect(schema).toContain("public.share_answer(uuid)");
    expect(schema).toContain(
      "grant execute on function public.prepare_account_deletion(uuid) to service_role",
    );
  });

  it("ships the complete English bank and localized French topic labels", () => {
    expect(content.match(/insert into public\.topics /g)).toHaveLength(12);
    expect(content.match(/insert into public\.questions /g)).toHaveLength(72);
    expect(content.match(/insert into public\.question_translations /g)).toHaveLength(72);
    expect(frenchTopics.match(/'fr'/g)).toHaveLength(12);
  });

  it("contains no legacy table model", () => {
    expect(schema).not.toMatch(
      /create table public\.(?:private_accounts|couples|couple_invites|topic_progress|guided_discussions|checklist_definitions)\b/,
    );
  });
});
