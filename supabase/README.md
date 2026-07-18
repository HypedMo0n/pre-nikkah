# Supabase database

The database is defined by ordered SQL migrations. Every user-facing table has
RLS enabled in the same migration that creates it, and every exposed privilege
is granted explicitly.

## Migration sequence

1. `20260718000100_accounts_couples_invites.sql`
   - Private accounts, couples, internal memberships, invitation hashing,
     one-current-couple enforcement, transactional creation and redemption
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

`seed.sql` adds four active topics, 27 original questions, and 10 checklist
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

## Hosted development project

If Docker is unavailable, link a non-production Supabase project and apply the
migrations there:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
npx supabase db lint --linked --level warning
```

Do not run unfinished migrations against a production project. Database test
fixtures must only be executed in an isolated development environment.

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

## Account-deletion data behavior

Account deletion closes and removes every shared journey containing the
deleting account. Shared notes, checklist state, topic progress, reveal events,
and all answers attached to those journeys are removed. A remaining partner
receives only a content-free closure notice. The server then deletes the Auth
user through the Supabase Admin API.

All answers in the deleted shared journey are removed because answers are
couple-scoped. This includes the remaining partner's answers for that closed
journey. The deletion confirmation UI must state this clearly.
