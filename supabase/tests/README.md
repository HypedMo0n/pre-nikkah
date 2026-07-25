# Database authorization tests

Run the suite with:

```bash
npm run db:test
```

The two pgTAP files cover the v3 schema: table/RLS/function inventory and
grants (`schema_security.test.sql`), and the functional privacy proof —
un-shared answers and private notes are unreadable by a partner through any
route, sharing is one-way and irreversible, comparisons are writable only by
`refresh_comparison()` never a client, and progress functions return counts
only (`rls_and_privacy.test.sql`). This suite is authored against the v3
schema in `supabase/migrations/` and has not yet been executed against
PostgreSQL — see `docs/product/v3-rewrite-audit.md` and the schema
migrations' own header comments for the design decisions it proves.

The remote test command also runs a two-connection redemption race and requires
exactly one successful redeemer:

```bash
npm run db:remote:test
```

These tests are not considered passed until executed against PostgreSQL. Source
inspection and the Vitest migration-invariant checks are supplementary and are
not substitutes for the pgTAP run.
