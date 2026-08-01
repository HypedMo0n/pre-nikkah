// Read-only migration drift check.
//
// Compares the versions recorded in supabase_migrations.schema_migrations
// against the files in supabase/migrations/, and exits non-zero when they
// differ in either direction. It never writes, so it is safe to point at
// production; that is the point, since nothing in the deploy path applies
// migrations and drift has previously gone unnoticed until a feature failed.
//
//   SUPABASE_DB_URL=... npm run db:drift

import { readdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");

/** Keeps credentials out of anything printed, including thrown errors. */
function redact(text) {
  return String(text).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[connection masked]");
}

const databaseUrl = process.env.SUPABASE_DB_URL;
if (!databaseUrl) {
  process.stderr.write(
    "SUPABASE_DB_URL is not set. Point it at the database you want to check.\n",
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
