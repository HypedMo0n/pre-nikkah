# Database authorization tests

Run the suite with:

```bash
npm run db:test
```

Four pgTAP files cover the v3 schema:

| File | Assertions | Covers |
| --- | --- | --- |
| `schema_security.test.sql` | 16 | Table, RLS, function and grant inventory |
| `privacy_and_lifecycle.test.sql` | 46 | Un-shared answers and private notes are unreadable by a partner through any route; a share is revocable by its author, is retracted when the answer changes, and does not survive the space closing; `comparisons` is writable only by `refresh_comparison()`, never by a client; progress functions return counts only |
| `topic_partner_visibility.test.sql` | 18 | Partner state is withheld for topics the couple has not reached, through every route including the progress RPC, comparisons, events and the save return value |
| `disclosure_attestations.test.sql` | 37 | Attestations are owner-only including after a reveal; reveal is per attestation and explicitly confirmed; the overview returns counts without category identity; every function touching an attestation and its space locks them in one order, account deletion included |

The assertion counts are the `plan()` in each file. They are listed so a run
that silently stops early is visible as a shortfall rather than passing quietly.

The remote test command also runs a two-connection redemption race and requires
exactly one successful redeemer:

```bash
npm run db:remote:test
```

These tests are not considered passed until executed against PostgreSQL. Source
inspection and the Vitest migration-invariant checks are supplementary and are
not substitutes for the pgTAP run. See `docs/product/v3-rewrite-audit.md` and
the migrations' own header comments for the design decisions the suite proves.
