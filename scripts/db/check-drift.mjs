// Read-only migration drift check.
//
// Compares the versions recorded in supabase_migrations.schema_migrations
// against the files in supabase/migrations/, and exits non-zero when they
// differ in either direction. It never writes, so it is safe to point at
// production; that is the point, since nothing in the deploy path applies
// migrations and drift has previously gone unnoticed until a feature failed.
//
// Put SUPABASE_DB_URL in an ignored .env.local, then:
//
//   npm run db:drift

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

import { loadSecretEnvironment } from "./remote-safety.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");

// supabase/README.md requires the connection string to live in an ignored
// .env.local and never to appear in a command. Reading only process.env meant
// the documented configuration could not run this check at all, and the
// obvious workaround -- SUPABASE_DB_URL=... npm run db:drift -- writes the
// production credential into shell history.
//
// Captured before loading, so an explicitly exported value still wins in CI.
const exportedUrl = process.env.SUPABASE_DB_URL?.trim() ?? "";

// Loaded for its side effect only: it re-asserts that the env files are
// ignored and untracked. Its resolution of SUPABASE_DB_URL is deliberately
// not used -- see below.
loadSecretEnvironment();

/**
 * Reads one key straight out of .env.local.
 *
 * @next/env loads .env.development.local *before* .env.local and never
 * overwrites a key already set, so .env.development.local wins:
 *
 *   load order: .env.development.local then .env.local
 *   winner host: dev-host
 *
 * That file is where the disposable verification database lives. This check
 * gates production deploys, so resolving it that way could report "No drift"
 * about the wrong database entirely. Read the file the runbook names.
 */
async function readEnvLocal(key) {
  let contents;
  try {
    contents = await readFile(path.join(projectRoot, ".env.local"), "utf8");
  } catch {
    return "";
  }
  let found = "";
  for (const line of contents.split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || match[1] !== key) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    found = value.trim();
  }
  return found;
}

/** Keeps credentials out of anything printed, including thrown errors. */
function redact(text) {
  return String(text).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[connection masked]");
}

const databaseUrl = exportedUrl || (await readEnvLocal("SUPABASE_DB_URL"));
process.stdout.write(
  `source: ${exportedUrl ? "exported SUPABASE_DB_URL" : ".env.local"}\n`,
);
if (!databaseUrl) {
  process.stderr.write(
    "SUPABASE_DB_URL is not set. Put it in an ignored .env.local rather than " +
      "on the command line, where it would persist in shell history.\n",
  );
  process.exit(2);
}

const repoVersions = (
  await readdir(path.join(projectRoot, "supabase", "migrations"))
)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => name.split("_")[0])
  .sort();

// The comparison below is set-based, so two files sharing a timestamp would
// cancel out: neither pending nor unknown, and a confident "No drift" even
// though the ledger records that version once and cannot represent the second.
const duplicateVersions = [
  ...new Set(
    repoVersions.filter((version, index) => repoVersions.indexOf(version) !== index),
  ),
];
if (duplicateVersions.length > 0) {
  process.stderr.write(
    `Duplicate migration versions in supabase/migrations (${duplicateVersions.length}):\n` +
      duplicateVersions.map((version) => `  ${version}\n`).join("") +
      "The ledger keys on version, so only one of each can ever be applied.\n",
  );
  process.exit(1);
}

let appliedVersions = [];
let sql;
try {
  // Constructed inside the boundary: postgres() parses the URL eagerly and
  // throws on a malformed one with the whole input in the message. Outside
  // this catch that surfaces as an uncaught exception, printing the username
  // and password to the terminal or a CI log — past the redact() this script
  // exists to guarantee — and exiting 1 rather than the documented 2.
  sql = postgres(databaseUrl, { max: 1, prepare: false, idle_timeout: 5 });
  const rows = await sql`
    select version
    from supabase_migrations.schema_migrations
    order by version
  `;
  appliedVersions = rows.map((row) => row.version);
} catch (error) {
  process.stderr.write(`${redact(error.message ?? error)}\n`);
  process.exit(2);
} finally {
  await sql?.end();
}

const applied = new Set(appliedVersions);
const inRepo = new Set(repoVersions);
const pending = repoVersions.filter((version) => !applied.has(version));
const unknown = appliedVersions.filter((version) => !inRepo.has(version));

process.stdout.write(
  `applied: ${appliedVersions.length}   in repo: ${repoVersions.length}\n`,
);

if (pending.length === 0 && unknown.length === 0) {
  process.stdout.write("No drift: every repo migration is applied.\n");
  process.exit(0);
}

if (pending.length > 0) {
  process.stdout.write(
    `\nIn the repository but NOT applied (${pending.length}):\n` +
      pending.map((version) => `  ${version}\n`).join(""),
  );
}

// An applied migration missing from the repository means the two histories have
// diverged rather than simply fallen behind, so a plain forward push will not
// reconcile them.
if (unknown.length > 0) {
  process.stdout.write(
    `\nApplied but NOT in the repository (${unknown.length}):\n` +
      unknown.map((version) => `  ${version}\n`).join(""),
  );
}

if (unknown.length > 0 && pending.length > 0) {
  process.stdout.write(
    "\nThe histories have diverged in both directions. A forward-only push " +
      "cannot reconcile this; see docs/deployment/production-cutover.md.\n",
  );
}

process.exit(1);
