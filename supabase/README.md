# Supabase database

The database is defined by ordered SQL migrations. Every user-facing table has
RLS enabled in the same migration that creates it, and every exposed privilege
is granted explicitly. This is the v3 ("Together in Amanah") schema — see
`docs/product/v3-rewrite-audit.md` for how it differs from the pre-v3 schema
it replaced.

## Migration sequence

1. `20260723000100_profiles_spaces_invites.sql`
   - Profiles, spaces, space memberships, one-current-space-per-user
     enforcement, and hashed opaque invitations with transactional creation
     and redemption (kept as a full invite table rather than the prompt's
     single static `invite_code` column, since the settings screens require
     revoke and regenerate — see the migration's header comment)
2. `20260723000200_topics_questions.sql`
   - Topics and single-choice questions with clustered options; no scale or
     free-text question types exist in this schema
3. `20260723000300_answers_shares_comparisons.sql`
   - Owner-only answers with an importance flag and a private note,
     one-way irreversible answer sharing, and the comparisons table
     computed only by a `SECURITY DEFINER` trigger path, never by a client
4. `20260723000400_discussions_notes_events.sql`
   - Per-question discussed markers, a real multi-entry shared-note list,
     and the space_events/event_reads notification model
5. `20260723000500_space_lifecycle_and_deletion.sql`
   - Pause/resume, unlink-partner space closure, and the server-only
     account-deletion preparation function

`seed.sql` adds the 12 topics and 72 questions from the provided
question-bank content, with deterministic `uuid5` ids (namespace
`6f8f7a2e-0000-4000-8000-000000000000`, name `topic:<slug>` /
`question:<key>`) so re-running the file is idempotent and ids never
depend on insertion order.

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
