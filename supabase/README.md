# Supabase database

The database is defined by ordered SQL migrations. Every user-facing table has
RLS enabled in the same migration that creates it, and every exposed privilege
is granted explicitly.

## Migration sequence

1. `20260718000100_accounts_couples_invites.sql`
   - Private accounts and onboarding state, couples, internal memberships,
     journey-deletion policy acceptance, invitation hashing, one-current-couple
     enforcement, and transactional creation and redemption
2. `20260718000200_canonical_content.sql`
   - Topics, questions, stable options, and checklist definitions
3. `20260718000300_answers_and_progress.sql`
   - Owner-only answers, type-aware validation, answer-specific reveals,
     reveal audit events, and topic completion validation
4. `20260718000400_shared_journey_and_lifecycle.sql`
   - Guided discussions, shared checklist state, journey closure, and the
     server-only account-deletion preparation function
5. `20260718000500_safe_read_functions.sql`
   - Restricted connected-partner metadata, question comparison, and complete
     topic aggregates

`seed.sql` adds 12 active topics, 72 original questions, and 10 checklist
definitions.

## Local setup

Install and start Docker Desktop, then run:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
```

The SQL authorization tests run inside a transaction and roll back all fixture
users and journey data.

## Isolated cloud development project

Docker is optional for Phase 2. Configure an ignored, untracked `.env.local`
with an encoded direct or session-pooler connection URL for a separate,
disposable Supabase cloud development project:

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

- Direct `answers` access is owner-only, including after reveal.
- A partner answer can leave PostgreSQL only through
  `get_question_comparison`, and only when that exact answer is revealed.
- Editing an answer automatically revokes its prior reveal.
- Invitation plaintext is returned once and never stored. Only a SHA-256 hash
  is persisted.
- Internal membership helpers that accept arbitrary user IDs are not executable
  by authenticated clients.
- Canonical content is readable but has no authenticated write grant.
- The account-deletion preparation function is executable only by the
  `service_role` and accepts a user ID derived by trusted server code.
- A journey cannot become active until both participants accept the current
  journey-deletion policy version.

## Account-deletion data behavior

Account deletion closes and removes every shared journey containing the
deleting account. Shared notes, checklist state, topic progress, reveal events,
and all answers attached to those journeys are removed. A remaining partner
receives only a content-free closure notice. The server then deletes the Auth
user through the Supabase Admin API.

All answers in the deleted shared journey are removed because answers are
couple-scoped. This includes the remaining partner's answers for that closed
journey. The deletion confirmation UI must state this clearly.

Both users must accept this disclosure before invitation creation or redemption:

> If either person permanently deletes their account, this shared journey ends.
> Answers, comparisons, shared notes, and checklist progress connected to this
> journey are permanently removed for both people.

The server first removes all active-database journey content, then deletes the
requesting Auth identity through the Admin API. Active-database deletion does
not claim immediate erasure from provider-managed infrastructure backups.
Supabase backup retention and restoration behavior must be documented separately
before production launch.
