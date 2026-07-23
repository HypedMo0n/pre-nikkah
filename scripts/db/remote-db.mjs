import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { runConcurrentInviteTest } from "./concurrent-invite-test.mjs";
import {
  printSanitizedResult,
  projectRoot,
  requireRemoteDevelopmentDatabase,
} from "./remote-safety.mjs";

const supportedActions = new Set(["push", "seed", "lint", "test", "verify"]);
const action = process.argv[2];

if (!supportedActions.has(action)) {
  process.stderr.write("Usage: node scripts/db/remote-db.mjs <push|seed|lint|test|verify>\n");
  process.exit(1);
}

let context;
try {
  context = requireRemoteDevelopmentDatabase();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
const supabaseBinary = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "supabase.cmd" : "supabase",
);

function runSupabase(args, label) {
  process.stdout.write(`${label}\n`);
  const result = spawnSync(supabaseBinary, args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
  printSanitizedResult(result, context.redact);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }
}

async function seed() {
  process.stdout.write("Applying seed data in a transaction\n");
  const seedSql = await readFile(path.join(projectRoot, "supabase", "seed.sql"), "utf8");
  const sql = postgres(context.dbUrl, { max: 1, prepare: false });
  try {
    await sql.begin((transaction) => transaction.unsafe(seedSql));
  } finally {
    await sql.end();
  }
}

async function verifySchemaAndSeed() {
  process.stdout.write("Verifying schema, RLS, functions, and seed inventory\n");
  const sql = postgres(context.dbUrl, { max: 1, prepare: false });
  try {
    // Kept in sync by hand with the inventory asserted in
    // supabase/tests/database/schema_security.test.sql — update both
    // together when a migration adds or removes an application function.
    const applicationSecurityDefinerFunctions = [
      "answers_refresh_comparison",
      "create_space_invite",
      "current_space_id",
      "current_space_id_for",
      "emit_answer_shared_event",
      "emit_note_added_event",
      "emit_partner_joined_event",
      "emit_topic_finished_event",
      "get_all_topic_progress",
      "get_or_create_current_space",
      "get_partner_display_name",
      "get_partner_shared_answer",
      "get_topic_progress",
      "handle_new_auth_user",
      "has_shared_own_answer",
      "inspect_space_invite",
      "is_current_user_space_member",
      "is_space_member_for",
      "pause_space",
      "prepare_account_deletion",
      "redeem_space_invite",
      "refresh_comparison",
      "resume_space",
      "revoke_space_invite",
      "share_answer",
      "unlink_partner",
      "validate_answer_write",
    ];
    const expectedTables = [
      "answer_shares",
      "answers",
      "comparisons",
      "discussions",
      "event_reads",
      "profiles",
      "questions",
      "shared_notes",
      "space_events",
      "space_invites",
      "space_members",
      "spaces",
      "topics",
    ];
    const tables = await sql`
      select class.relname as table_name, class.relrowsecurity as rls_enabled
      from pg_class class
      join pg_namespace namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relkind = 'r'
      order by class.relname
    `;
    if (
      tables.length !== expectedTables.length ||
      tables.some(
        (table, index) =>
          table.table_name !== expectedTables[index] || table.rls_enabled !== true,
      )
    ) {
      throw new Error("Public table inventory or RLS state does not match the approved schema.");
    }

    const applicationDefiners = await sql`
      select procedure.proname, procedure.proconfig
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.prosecdef
        and procedure.proname = any(${applicationSecurityDefinerFunctions})
      order by procedure.proname
    `;
    if (applicationDefiners.length !== applicationSecurityDefinerFunctions.length) {
      throw new Error(
        "The application SECURITY DEFINER inventory is incomplete or duplicated.",
      );
    }
    const unsafeDefiners = applicationDefiners.filter(
      (procedure) =>
        !procedure.proconfig?.includes("search_path=public, pg_temp") &&
        !procedure.proconfig?.includes(
          "search_path=public, extensions, pg_temp",
        ),
    );
    if (unsafeDefiners.length > 0) {
      throw new Error(
        "An application SECURITY DEFINER function does not have an approved fixed search_path.",
      );
    }

    const [{ topic_count: topicCount, question_count: questionCount }] = await sql`
      select
        (select count(*)::integer from public.topics where is_active) as topic_count,
        (select count(*)::integer from public.questions where is_active) as question_count
    `;
    if (topicCount !== 12 || questionCount !== 72) {
      throw new Error("Seed inventory does not match the approved twelve-topic library.");
    }
  } finally {
    await sql.end();
  }
}

function push() {
  runSupabase(
    ["db", "push", "--db-url", context.dbUrl, "--include-all", "--yes"],
    "Applying all pending migrations",
  );
}

function lint() {
  runSupabase(
    [
      "db",
      "lint",
      "--db-url",
      context.dbUrl,
      "--schema",
      "public",
      "--level",
      "warning",
      "--fail-on",
      "error",
    ],
    "Linting the remote development database",
  );
}

function pgTap() {
  runSupabase(
    [
      "test",
      "db",
      "supabase/tests/database",
      "--db-url",
      context.dbUrl,
    ],
    "Running remote pgTAP authorization tests",
  );
}

function reset(label) {
  runSupabase(
    ["db", "reset", "--db-url", context.dbUrl, "--yes"],
    label,
  );
}

async function testPass(label) {
  process.stdout.write(`${label}\n`);
  lint();
  pgTap();
  await runConcurrentInviteTest(context.dbUrl);
  process.stdout.write("Concurrent invite redemption: passed\n");
  await verifySchemaAndSeed();
}

try {
  if (action === "push") {
    push();
  } else if (action === "seed") {
    await seed();
  } else if (action === "lint") {
    lint();
  } else if (action === "test") {
    pgTap();
    await runConcurrentInviteTest(context.dbUrl);
    process.stdout.write("Concurrent invite redemption: passed\n");
    await verifySchemaAndSeed();
  } else if (action === "verify") {
    reset("Clean replay pass 1: resetting, migrating, and seeding");
    await testPass("Clean replay pass 1: verification");
    reset("Clean replay pass 2: resetting, migrating, and seeding");
    await testPass("Clean replay pass 2: verification");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${context.redact(message)}\n`);
  process.exitCode = 1;
}
