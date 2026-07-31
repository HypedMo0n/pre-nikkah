# Production cutover to the v3 schema

## Why this document exists

Nothing in the deploy path applies database migrations. Vercel builds and
deploys application code; the Supabase schema is only ever changed by someone
running a command by hand. Drift has therefore accumulated silently and only
surfaced as feature-level failures, such as `PGRST204` schema-cache misses on
answer save.

The drift is now total rather than partial. As of the last check:

| | |
| --- | --- |
| Applied to production | 10 migrations, `20260718000100` → `20260721000100` (v2) |
| In `supabase/migrations/` | 7 migrations, `20260724000100` → `20260725000400` (v3) |
| Overlap | none |

The v3 rewrite replaced the schema outright and deleted the migrations that
built the v2 one. **There is no forward-only path.** Verified by rebuilding
production's applied state locally and running the repository's migrations
against it:

```
20260724000100_together_in_amanah.sql    FAIL
ERROR:  relation "topics" already exists
```

The tables are not compatible either: v2 `couples` became v3 `spaces`,
`private_accounts` became `profiles`, free-text `answers.value` became
`option_key`, `discussion_preference` and the whole reveal-event model were
dropped, and content moved into `*_translations` tables.

## Detecting drift

```bash
SUPABASE_DB_URL=... npm run db:drift
```

Read-only, so it is safe to point at production. Exits `0` when every repository
migration is applied, `1` on drift, `2` if it cannot connect. Run it before every
deploy that touches `supabase/`. It reports drift in both directions, because an
applied migration that is missing from the repository means the histories have
diverged rather than merely fallen behind.

## Never run against production

- `npm run db:remote:verify` — performs **two full resets** and will destroy live
  data. It exists for a disposable verification project only.
- `supabase db reset` — same reason.

## Plan C: rebuild production on v3

The approved cutover. It **destroys the existing production data**. At the time
of writing that is 3 `private_accounts`, 3 `couples`, 3 `couple_memberships`,
3 `journey_policy_acceptances`, and 3 `couple_invites`. `answers`,
`topic_progress`, `guided_discussions`, and `answer_reveal_events` are all
empty, so no answer content is lost.

Re-check those counts immediately before running. If any of them have grown,
stop: real users have arrived since, and Plan C is no longer the right choice.

### 1. Confirm the target

```bash
supabase projects list
```

Confirm the ref you are about to operate on, and that it is the project you
intend. Every later step is irreversible.

### 2. Take a backup you have actually verified

Take a database backup from the Supabase dashboard and **download it**. A
backup you have not downloaded is not a backup. This is the only thing standing
between a mistake and permanent loss.

### 3. Remove the v2 schema and its ledger

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;

delete from supabase_migrations.schema_migrations;
```

Clearing the ledger is required, otherwise the CLI believes the v2 migrations
are still applied and will skip straight past the v3 ones.

### 4. Decide what happens to the existing auth users

v3 `profiles` references `auth.users`, and the row is created by the
`handle_new_auth_user` trigger, which only fires on insert. Existing auth users
therefore survive step 3 with no profile, and cannot use the app.

Either delete them, so the accounts are genuinely gone:

```sql
delete from auth.users;
```

Or leave them and have each person sign up again. Do not leave them in place and
assume they will work.

### 5. Apply the v3 migrations

```bash
supabase db push --db-url "$SUPABASE_DB_URL" --include-all
```

Forward only. Do not reset.

### 6. Reload the PostgREST schema cache

```sql
notify pgrst, 'reload schema';
```

Skipping this is what produces `PGRST204` misses against a schema that is
actually correct.

### 7. Verify

```bash
SUPABASE_DB_URL=... npm run db:drift     # expect: No drift
```

```sql
select count(*) from public.topics;      -- expect 12
select count(*) from public.questions;   -- expect 72
select count(*) from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';   -- expect 21
```

Then exercise the real flow against the deployed app: create a space, redeem the
invite from a second account, save an answer from each side, and confirm the
comparison appears. A migration that applied cleanly is not the same as a
working application.

## Making it stick

`npm run db:drift` is the durable part. The failure mode this document exists to
prevent is not a bad migration, it is a deploy that silently leaves the schema
behind. Run the check before any deploy touching `supabase/`, and treat a
non-zero exit as a blocker rather than a warning.

Wiring it into CI would enforce that automatically, which is worth doing, but it
adds a required check to every pull request and so is left as an explicit
decision rather than assumed here.
