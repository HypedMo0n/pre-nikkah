# Phase 2 execution status

Recorded on July 18, 2026. This is an interim gate report. It deliberately does
not mark database controls as passed based on source inspection.

## 1. Framework versions before and after

Next.js moved from 14.2.35 to the pinned provisional development baseline
16.2.10. React and React DOM moved from 18.3.1 to 19.2.7. ESLint moved from
8.57.1 to 9.39.5, and `eslint-config-next` moved from 14.2.35 to 16.2.10.

## 2. Breaking changes identified

Async cookies, Middleware-to-Proxy migration, React 19, the ESLint flat config,
Turbopack defaults, async route parameters for future routes, caching defaults,
Node requirements, and Supabase SSR cookie/header propagation were reviewed.
The applied changes are recorded in `framework-upgrade-result.md`.

## 3. Migration changes required by the framework upgrade

None. Framework changes affected TypeScript, routing infrastructure, linting,
and dependencies. Database changes in this phase are product-security changes.

## 4. npm audit before and after

Before: five findings, comprising four high and one moderate. After: two
moderate entries, no high or critical findings. Both remaining entries trace to
Next.js 16.2.10 bundling PostCSS 8.4.31. No forced audit fix or override was used.

## 5. Development database safety checks

- `.env.local` is matched by the repository's `.env*` ignore rule.
- No local secret environment file is tracked.
- Only `.env.example` currently exists.
- `SUPABASE_DB_URL` is not configured in the current process.
- `ALLOW_DESTRUCTIVE_DEV_DB_OPERATIONS` is not enabled.
- Remote tooling captures and redacts output and accepts only Supabase cloud
  database hosts.
- A fail-closed invocation was executed and stopped before connecting.

## 6. Migration execution results

Not run. The isolated development database connection is not configured.

## 7. Migration replay results

Not run. `npm run db:remote:verify` is prepared to perform two complete resets
and replays, but the safety prerequisites correctly block it.

## 8. Seed results

Source inspection confirms four topics, 27 questions, and 10 checklist
definitions. Database seed execution and replay are not yet proven.

## 9. Database lint results

Not run against PostgreSQL. The remote command is configured for the `public`
schema at warning level and fails on errors.

## 10. Authorization tests

The pgTAP suite contains 95 assertions in four files. Passed: 0 executed.
Failed: 0 executed. Pending: 95. Supplementary Vitest source and safety
invariants pass, but they are not counted as database authorization evidence.

## 11. Invitation and concurrency tests

pgTAP covers hashed storage, current-policy acceptance, expiry, reuse,
self-redemption, active-couple conflicts, and activation gating. A separate
Postgres integration test uses two connections and requires exactly one
successful concurrent redeemer. None has run against the remote database yet.

## 12. Comparison privacy tests

The authored matrix covers stable single IDs, scale distances zero through
four, text prompts, missing answers, invalid values, `discussion_only`,
`never_compare`, full-topic aggregates, and omission of unrevealed partner
values. Execution is pending.

## 13. Reveal and revoke tests

The authored tests prove direct partner reads remain empty even after reveal,
approved safe-function disclosure is answer-specific, and later responses omit
the value after revocation. Execution is pending.

## 14. Account-deletion tests

The authored test deletes the couple row and thereby both users' journey
answers, reveal events, policy acceptances, progress, shared notes, checklist
state, memberships, and invitations. It verifies a content-free notice, then
simulates the Admin API's Auth deletion and private-account cascade. Execution
is pending. Provider backup retention is explicitly outside the active-database
deletion claim.

## 15. Full table inventory

The fourteen-table access inventory is in `database-inventory.md`. Database
catalog verification is pending.

## 16. Full privileged-function inventory

The 24-function inventory, including 21 `SECURITY DEFINER` functions, fixed
search paths, executable roles, and sensitive return fields, is in
`database-inventory.md`. Database catalog verification is pending.

## 17. Security defects found and corrected

- Replaced the vulnerable Next.js 14 baseline with the latest official stable
  release available on July 18.
- Replaced deprecated Middleware infrastructure with Next.js 16 Proxy.
- Propagated Supabase SSR refreshed cookies and cache-control headers.
- Added current-version deletion-policy acceptance for both participants and a
  database activation trigger.
- Changed account deletion to remove both participants' journey-scoped data.
- Changed manual journey closure to cascade-delete private journey content.
- Added fail-closed remote database controls and output redaction.
- Expanded SQL proofs for revealed-answer direct-read denial and topic-wide
  aggregates.

## 18. Remaining blockers

1. The local `SUPABASE_DB_URL` and destructive-development flag are absent, so
   no remote migration, seed, lint, pgTAP, concurrency, or replay result exists.
2. The official July 20 Next.js security release has not shipped as of the July
   18 check. The production framework baseline remains provisional.
3. Two moderate npm audit entries remain through Next.js's nested PostCSS.

## 19. Is Phase 2 complete?

No. The database execution gate and post-July-20 framework security check are
both outstanding.

## 20. Has Phase 3 started?

Yes, under the later approved controlled-demo exception. Phase 2 remains
execution-blocked and no production-readiness claim is permitted until the
remote database gate passes.
