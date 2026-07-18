# Database authorization tests

Run the suite with:

```bash
npm run db:test
```

The suite proves account non-enumeration, answer ownership, reveal ownership,
safe revealed-answer access, revocation behavior, outsider isolation, canonical
content immutability, couple-only shared records, and invitation self-use,
expiry, conflict, and reuse protections.

The test requires a running local Supabase stack. Docker is not available in
the current workspace environment, so the committed test has not yet produced
a passing runtime result.
