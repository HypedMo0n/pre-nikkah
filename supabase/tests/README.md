# Database authorization tests

Run the suite with:

```bash
npm run db:test
```

The four pgTAP files contain 96 assertions covering schema and function grants,
account non-enumeration, answer ownership, the complete comparison matrix,
reveal ownership, safe revealed-answer access, revocation behavior, outsider
isolation, canonical content immutability, policy acceptance, couple-only shared
records, invitation misuse, and the agreed two-person deletion cascade.

The remote test command also runs a two-connection redemption race and requires
exactly one successful redeemer:

```bash
npm run db:remote:test
```

These tests are not considered passed until executed against PostgreSQL. Source
inspection and the Vitest migration-invariant checks are supplementary and are
not substitutes for the pgTAP run.
