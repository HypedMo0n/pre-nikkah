# Database authorization tests

Run the suite with:

```bash
npm run db:test
```

The seven pgTAP files contain 125 assertions covering schema and function grants,
account non-enumeration, answer ownership, the complete comparison matrix,
reveal ownership, safe revealed-answer access, revocation behavior, outsider
isolation, canonical content immutability, policy acceptance, couple-only shared
records, invitation misuse, the agreed two-person deletion cascade, and the
seeded content inventory with its mahr, intimacy, and cadence invariants.

The remote test command also runs a two-connection redemption race and requires
exactly one successful redeemer:

```bash
npm run db:remote:test
```

These tests are not considered passed until executed against PostgreSQL. Source
inspection and the Vitest migration-invariant checks are supplementary and are
not substitutes for the pgTAP run.
