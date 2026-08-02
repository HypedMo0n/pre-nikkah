import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

export const projectRoot = path.resolve(import.meta.dirname, "../..");

const secretEnvironmentFiles = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
];

function runGit(args) {
  return spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
    stdio: "pipe",
  });
}

function assertSecretFilesAreSafe() {
  for (const fileName of secretEnvironmentFiles) {
    const absolutePath = path.join(projectRoot, fileName);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const ignored = runGit(["check-ignore", "--quiet", "--", fileName]);
    if (ignored.status !== 0) {
      throw new Error(`${fileName} must be ignored by Git before remote database use.`);
    }

    const tracked = runGit(["ls-files", "--error-unmatch", "--", fileName]);
    if (tracked.status === 0) {
      throw new Error(`${fileName} is tracked by Git. Remote database use is blocked.`);
    }
  }
}

function parseDevelopmentDatabaseUrl(rawValue) {
  if (!rawValue) {
    throw new Error("SUPABASE_DB_URL is not configured. Remote database use is blocked.");
  }

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error("SUPABASE_DB_URL is not a valid URL. Remote database use is blocked.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("SUPABASE_DB_URL must use the postgres protocol.");
  }

  const host = parsed.hostname.toLowerCase();
  const isSupabaseCloudHost =
    host.endsWith(".supabase.co") || host.endsWith(".supabase.com");
  if (!isSupabaseCloudHost) {
    throw new Error(
      "SUPABASE_DB_URL must point to an isolated Supabase cloud development project.",
    );
  }

  if (!parsed.username || !parsed.password || !parsed.pathname.slice(1)) {
    throw new Error("SUPABASE_DB_URL is incomplete. Remote database use is blocked.");
  }

  return parsed;
}

function uniqueSecrets(parsed, rawValue) {
  const candidates = [
    rawValue,
    parsed.hostname,
    parsed.username,
    parsed.password,
    decodeURIComponent(parsed.password),
  ];

  const projectReference =
    parsed.hostname.split(".")[0] === "db"
      ? parsed.hostname.split(".")[1]
      : parsed.username.startsWith("postgres.")
        ? parsed.username.slice("postgres.".length)
        : null;

  if (projectReference) {
    candidates.push(projectReference);
  }

  return [...new Set(candidates.filter((value) => value && value.length >= 4))].sort(
    (left, right) => right.length - left.length,
  );
}

export function createRedactor(parsed, rawValue) {
  const secrets = uniqueSecrets(parsed, rawValue);

  return (input) => {
    let output = String(input ?? "");
    for (const secret of secrets) {
      output = output.split(secret).join("[masked]");
    }

    return output.replace(
      /postgres(?:ql)?:\/\/[^\s'"<>]+/gi,
      "postgresql://[masked]",
    );
  };
}

// Loads the ignored env files and re-checks that they are still ignored and
// untracked. Split out of requireRemoteDevelopmentDatabase() so a read-only
// command can use the documented credential-safe configuration -- the URL in
// .env.local, never on a command line -- without also demanding
// ALLOW_DESTRUCTIVE_DEV_DB_OPERATIONS, which it has no business requiring.
export function loadSecretEnvironment() {
  loadEnvConfig(projectRoot, true);
  assertSecretFilesAreSafe();
}

export function requireRemoteDevelopmentDatabase() {
  loadSecretEnvironment();

  if (process.env.ALLOW_DESTRUCTIVE_DEV_DB_OPERATIONS !== "true") {
    throw new Error(
      "ALLOW_DESTRUCTIVE_DEV_DB_OPERATIONS=true is required. Remote database use is blocked.",
    );
  }

  const dbUrl = process.env.SUPABASE_DB_URL?.trim() ?? "";
  const parsed = parseDevelopmentDatabaseUrl(dbUrl);

  return {
    dbUrl,
    redact: createRedactor(parsed, dbUrl),
  };
}

export function printSanitizedResult(result, redact) {
  const stdout = redact(result.stdout).trim();
  const stderr = redact(result.stderr).trim();
  if (stdout) {
    process.stdout.write(`${stdout}\n`);
  }
  if (stderr) {
    process.stderr.write(`${stderr}\n`);
  }
}
