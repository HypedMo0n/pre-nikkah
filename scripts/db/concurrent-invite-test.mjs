import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { requireRemoteDevelopmentDatabase } from "./remote-safety.mjs";

const policyVersion = "2026-07-18-v1";

async function createFixtureUser(sql, userId, displayName) {
  await sql`
    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      ${userId}::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      ${`${userId}@concurrency.example.test`},
      extensions.crypt('temporary-test-password', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      ${sql.json({ private_display_name: displayName })},
      now(),
      now()
    )
  `;
}

async function asAuthenticated(sql, userId, callback) {
  return sql.begin(async (transaction) => {
    await transaction`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await transaction`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    await transaction.unsafe("set local role authenticated");
    return callback(transaction);
  });
}

async function redeem(sql, userId, inviteCode) {
  return asAuthenticated(sql, userId, async (transaction) => {
    const [result] = await transaction`
      select public.redeem_couple_invite(
        ${inviteCode},
        ${policyVersion}
      ) as couple_id
    `;
    return result.couple_id;
  });
}

export async function runConcurrentInviteTest(dbUrl) {
  const admin = postgres(dbUrl, { max: 4, prepare: false });
  const firstClient = postgres(dbUrl, { max: 1, prepare: false });
  const secondClient = postgres(dbUrl, { max: 1, prepare: false });
  const ownerId = randomUUID();
  const firstRedeemerId = randomUUID();
  const secondRedeemerId = randomUUID();
  const fixtureIds = [ownerId, firstRedeemerId, secondRedeemerId];

  try {
    await createFixtureUser(admin, ownerId, "Concurrency owner");
    await createFixtureUser(admin, firstRedeemerId, "Concurrency redeemer one");
    await createFixtureUser(admin, secondRedeemerId, "Concurrency redeemer two");

    const invitation = await asAuthenticated(admin, ownerId, async (transaction) => {
      const [created] = await transaction`
        select invite_code, couple_id
        from public.create_couple_invite(${policyVersion})
      `;
      return created;
    });

    const outcomes = await Promise.allSettled([
      redeem(firstClient, firstRedeemerId, invitation.invite_code),
      redeem(secondClient, secondRedeemerId, invitation.invite_code),
    ]);
    const successes = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const failures = outcomes.filter((outcome) => outcome.status === "rejected");

    if (successes.length !== 1 || failures.length !== 1) {
      throw new Error("Concurrent redemption did not produce exactly one success.");
    }

    const [couple] = await admin`
      select status, user_b_id
      from public.couples
      where id = ${invitation.couple_id}::uuid
    `;
    const [{ membership_count: membershipCount }] = await admin`
      select count(*)::integer as membership_count
      from public.couple_memberships
      where couple_id = ${invitation.couple_id}::uuid
        and ended_at is null
    `;

    if (couple?.status !== "active" || !couple.user_b_id || membershipCount !== 2) {
      throw new Error("Concurrent redemption left an invalid couple membership state.");
    }
  } finally {
    await admin`
      delete from public.couples
      where user_a_id = any(${fixtureIds}::uuid[])
         or user_b_id = any(${fixtureIds}::uuid[])
    `;
    await admin`delete from auth.users where id = any(${fixtureIds}::uuid[])`;
    await Promise.all([admin.end(), firstClient.end(), secondClient.end()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { dbUrl, redact } = requireRemoteDevelopmentDatabase();
    runConcurrentInviteTest(dbUrl)
      .then(() => process.stdout.write("Concurrent invite redemption: passed\n"))
      .catch((error) => {
        process.stderr.write(`${redact(error instanceof Error ? error.message : error)}\n`);
        process.exitCode = 1;
      });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
