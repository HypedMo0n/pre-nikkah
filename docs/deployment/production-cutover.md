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
| In `supabase/migrations/` | 7 migrations, `20260724000100` → `20260725000300` (v3) |
| Overlap | none |

Both counts move as migrations are added, so re-derive them rather than trust
the table: `ls supabase/migrations/*.sql | wc -l` for the repository side and
`npm run db:drift` for both. If a checkout disagrees with this table it is the
table that is stale, and a checkout with *fewer* migrations than the drift
report expects is missing security fixes and must not be cut over.

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
npm run db:drift
```

It reads `SUPABASE_DB_URL` from the ignored `.env.local`, as `supabase/README.md`
requires, so the connection string never reaches the command line or shell
history. Read-only, so it is safe to point at production.

It compares migration **versions** on both sides, and nothing else. An applied
migration edited in place keeps its version, so this check cannot see the
change and neither can `supabase db push`, which pushes versions missing from
the remote history rather than reconciling content. **Applied migrations are
immutable**: to change something already shipped, add a new migration. That is
why `20260724000400_normalize_free_text.sql` exists as its own file rather than
as an edit to `20260724000100`. Exits `0` when every repository
migration is applied, `1` on drift, `2` if it cannot connect. Run it before every
deploy that touches `supabase/`. It reports drift in both directions, because an
applied migration that is missing from the repository means the histories have
diverged rather than merely fallen behind.

## Never run against production

- `npm run db:remote:verify` — performs **two full resets** and will destroy live
  data. It exists for a disposable verification project only.
- `supabase db reset` — same reason.

## Prerequisites, none of which are satisfied yet

`docs/product/alpha-scope.md` is explicit that the runtime gate and the four
in-scope items are independent: passing the gate without completing the items
does not make alpha done, and completing the items without the gate does not
either. **Plan C is approved in principle, not cleared to run.** Both of these
have to close first:

1. The runtime gate below.
2. Every in-scope item in `alpha-scope.md`. Item (c) is **open**: no question
   in the library addresses intimacy expectations, and authoring it is a
   content decision that has not been made. Items (a), (b) and (d) are closed.

### The runtime gate, which has not been satisfied

`docs/product/alpha-scope.md` makes this a hard gate, not a preference: private
alpha is not done until an **isolated, disposable** Supabase project passes
**two clean** runs of

```bash
npm run db:remote:verify
```

covering migration replay, seed, lint, authorization, concurrency, comparison,
reveal, and deletion-cascade behaviour. That document also states its own rule
that no item may be represented as verified on source inspection alone.

**As of this writing the gate has not run.** No disposable project has been
provided, so the suites have executed only against a local PostgreSQL harness.
That is a real signal — 118 assertions from a clean replay — but it is not the
gate, because it does not exercise Supabase's own roles, PostgREST, or auth.

Step 7 below checks table counts and one happy path. That is nowhere near the
same thing. Running the cutover before the gate passes replaces the production
schema with authorization, concurrency, and deletion paths that have never been
verified on the platform they will run on.

`npm run db:remote:verify` performs **two full resets** and must never be
pointed at production. It exists for the disposable project only.

## Plan C: rebuild production on v3

The approved cutover, to be run only once **every prerequisite above** has
closed — not the gate alone. It **destroys the existing production data**. At the time
of writing that is 3 `private_accounts`, 3 `couples`, 3 `couple_memberships`,
3 `journey_policy_acceptances`, and 3 `couple_invites`. `answers`,
`topic_progress`, `guided_discussions`, and `answer_reveal_events` are all
empty, so no answer content is lost.

Re-check those counts immediately before running. If any of them have grown,
stop: real users have arrived since, and Plan C is no longer the right choice.

### 1. Confirm the target through the connection you will actually use

```bash
supabase projects list
```

That lists the projects your login can reach. It says nothing about
`SUPABASE_DB_URL`, which is what steps 3 and 4 operate through — so on its own
it cannot catch a stale or mistyped URL pointing at a different project. Check
the connection itself, read-only, before any destructive SQL:

```bash
psql "$SUPABASE_DB_URL" -c "select current_database(), current_user"
psql "$SUPABASE_DB_URL" -c "select count(*), min(version), max(version)
                            from supabase_migrations.schema_migrations"
psql "$SUPABASE_DB_URL" -c "select count(*) from public.private_accounts"
```

Expect the v2 ledger — 10 rows, `20260718000100` through `20260721000100` —
and the account count from the inventory above. If the ledger shows the v3
range, the migration table is empty, or `private_accounts` does not exist, this
URL is **not** production v2 and the procedure must stop: step 3 would drop a
schema you did not mean to drop, and step 4 would then push migrations
somewhere else entirely.

Read the URL from the ignored `.env.local` (`set -a; . ./.env.local; set +a`)
rather than typing it inline, so the credential does not land in shell history.

Every later step is irreversible.

### 2. Take a backup you have actually restored

Take a database backup from the Supabase dashboard and download it. Then
**restore it into a disposable database and look at what came back**:

```bash
createdb cutover_backup_check
psql cutover_backup_check < <the-downloaded-dump>

psql cutover_backup_check -c "select count(*) from public.private_accounts"
psql cutover_backup_check -c "select count(*) from public.couples"
psql cutover_backup_check -c "select count(*) from public.couple_memberships"
psql cutover_backup_check -c "select count(*) from public.journey_policy_acceptances"
psql cutover_backup_check -c "select count(*) from public.couple_invites"
psql cutover_backup_check -c "select count(*) from auth.users"
```

Every table the inventory above names, plus `auth.users`. A dump missing
`couple_memberships` or `journey_policy_acceptances` would otherwise pass this
gate while losing the relationship links and the recorded policy acceptances.
Those counts must match what production reports right now. Step 3 drops the
schema and clears the ledger, so a dump that is truncated, partial, or missing
`auth.users` is discovered *after* the data it was protecting is gone —
downloading a file proves only that a file exists. A backup you have not
restored is not a backup. This is the only thing standing between a mistake
and permanent loss.

### 3. Remove the v2 schema and its ledger

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;

delete from supabase_migrations.schema_migrations;
```

Clearing the ledger is required, otherwise the CLI believes the v2 migrations
are still applied and will skip straight past the v3 ones.

### 4. Apply the v3 migrations

```bash
supabase db push --db-url "$SUPABASE_DB_URL" --include-all
```

Forward only. Do not reset.

### 5. Deal with the existing auth users — do not skip this

`auth.users` lives outside the `public` schema, so step 3 does not touch it. v3
`profiles` references it, and that row is created by `handle_new_auth_user`,
which is attached `after insert on auth.users`. Every account that existed
before the cutover therefore survives with **no profile row**, and
`create_space()` then fails on its profile foreign key.

Signing up again does **not** fix this. The confirmed `auth.users` row already
exists, so Supabase returns "User already registered" (or an obfuscated fake
user) rather than inserting a new row, the trigger never fires, and the person
is left authenticated but permanently unable to use the app.

Pick one of these two. There is no third option.

**Either** backfill the missing profiles, keeping the accounts. This mirrors the
trigger's own logic, including its display-name and locale fallbacks. It uses
`public.normalize_body()` for the same reason the trigger does: `trim()` strips
ordinary spaces only, so metadata containing just tabs or newlines would
survive it and become a visually blank display name instead of falling back to
the email prefix. The helper exists by this point because step 4 has already
applied the migrations:

```sql
insert into public.profiles (id, display_name, locale)
select
  users.id,
  coalesce(
    nullif(left(public.normalize_body(users.raw_user_meta_data ->> 'display_name'), 80), ''),
    nullif(left(split_part(coalesce(users.email, ''), '@', 1), 80), ''),
    'Member'
  ),
  case
    when coalesce(users.raw_user_meta_data ->> 'locale', '') ~ '^[a-z]{2}(?:-[A-Z]{2})?$'
      then users.raw_user_meta_data ->> 'locale'
    else 'en'
  end
from auth.users users
on conflict (id) do nothing;
```

Then confirm none are left behind:

```sql
select count(*) from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);
-- expect 0
```

**Or** delete the accounts outright, so those people start genuinely fresh and
can sign up again:

```sql
delete from auth.users;
```

### 6. Reload the PostgREST schema cache

```sql
notify pgrst, 'reload schema';
```

Skipping this is what produces `PGRST204` misses against a schema that is
actually correct.

### 7. Verify

```bash
npm run db:drift     # expect: No drift
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
