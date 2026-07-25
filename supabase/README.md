# Supabase database

The database is defined by ordered SQL migrations. Every user-facing table has
RLS enabled in the same migration that creates it, and every exposed privilege
is granted explicitly. This is the v3 ("Together in Amanah") schema — see
`docs/product/v3-rewrite-audit.md` for how it differs from the pre-v3 schema
it replaced.

## Migration sequence

1. `20260724000100_together_in_amanah.sql`
   - The whole v3 schema in one migration: profiles, spaces, space
     memberships with one-current-space-per-user enforcement, hashed opaque
     invitations with transactional creation and redemption, localized
     topics and single-choice questions with clustered options, owner-only
     answers carrying an importance flag and a private note, one-way
     irreversible answer sharing, comparisons written only by a
     `SECURITY DEFINER` trigger path and never by a client, per-question
     discussed markers, a multi-entry shared-note list, the
     space_events/event_reads notification model, pause/resume and
     unlink-partner lifecycle, and the server-only account-deletion
     preparation function
   - Every table has RLS enabled in this migration, and `anon` is granted
     no table access at all: the pre-auth onboarding screens render from
     static copy rather than reading the database
2. `20260724000200_question_bank_en.sql`
   - The English question bank: 12 topics and 72 questions with their
     options, generated deterministically from the approved content
3. `20260724000300_topic_bank_fr.sql`
   - French translations for the same topics and questions

Canonical content lives in migrations, not in `seed.sql`, so a fresh
database is complete after migrating. `seed.sql` is development-only
fixtures and is empty by default.

An earlier `20260723*` series of ten migrations built up the same schema
incrementally. `20260724000100` supersedes it wholesale rather than
extending it, so both sets could not coexist: applying them in order failed
at `create table public.profiles` with `relation "profiles" already
exists`, which meant no database could be created from this repository at
all. The superseded ten were removed.

## Local setup

Install and start Docker Desktop, then run:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
```

The SQL authorization tests run inside a transaction and roll back all fixture
users and space data.

## Isolated cloud development project

Docker is optional. Configure an ignored, untracked `.env.local` with an
encoded direct or session-pooler connection URL for a separate, disposable
Supabase cloud development project:

```text
SUPABASE_DB_URL=
ALLOW_DESTRUCTIVE_DEV_DB_OPERATIONS=true
```

Never place the URL in a command, document, screenshot, commit, report, or chat
message. Run the complete destructive verification gate with:

```bash
npm run db:remote:verify
```

The verifier performs two complete reset, migration, seed, lint, pgTAP,
concurrent-redemption, and schema-inventory passes. The safety wrapper rejects
non-Supabase hosts, checks local secret files are ignored and untracked, masks
connection details in captured output, and fails closed without the explicit
destructive-development flag.

Individual commands are available for controlled diagnosis:

```bash
npm run db:remote:push
npm run db:remote:seed
npm run db:remote:lint
npm run db:remote:test
```

Do not use a production project, a project containing real users, or a shared
project containing unrelated data.

## Privacy boundary

- Direct `answers` access is owner-only. There is no policy path, revealed or
  not, that grants a partner direct table access — sharing never creates one.
- A partner's answer can leave PostgreSQL only through
  `get_partner_shared_answer()`, and only the shared `option_key` — the
  function has no `private_note` output column at all, by construction.
- Sharing is one-way and irreversible: `answer_shares` is insert-only, with
  no revoke path, matching the v3 product requirement that a share cannot be
  undone.
- `comparisons` grants `authenticated` clients `SELECT` only. Every row is
  written by `refresh_comparison()`, invoked by a trigger on `answers`; a
  direct client insert/update/delete is rejected at the grant level.
- Invitation plaintext is returned once and never stored. Only a SHA-256 hash
  is persisted.
- Internal membership helpers that accept arbitrary user IDs are not
  executable by authenticated clients.
- Canonical content (`topics`, `questions`) is readable but has no
  authenticated write grant.
- The account-deletion preparation function is executable only by the
  `service_role` and accepts a user ID derived by trusted server code.
- Progress functions (`get_topic_progress`) return integer counts only —
  never a question identity or answer content.

## Account-deletion and unlink data behavior

Both account deletion and unlinking a partner close and remove the shared
space. Answers, comparisons, discussions, shared notes, and invitations
scoped to that space are removed. The remaining partner (if any) receives
only a content-free `space_closed` event. For account deletion, the server
then deletes the Auth user through the Supabase Admin API.

All answers in a closed space are removed because answers are space-scoped.
This includes the remaining partner's answers for that closed space — the
deletion/unlink confirmation UI must state this clearly.

The server first removes all active-database space content, then (for
account deletion) deletes the requesting Auth identity through the Admin
API. Active-database deletion does not claim immediate erasure from
provider-managed infrastructure backups. Supabase backup retention and
restoration behavior must be documented separately before production
launch.

"Pause the space" is the one reversible lifecycle action: it does not touch
any data, only `spaces.status`.
