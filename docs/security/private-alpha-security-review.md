# Private-alpha security review

Review date: 2026-07-18. This is a source and local-application review. PostgreSQL authorization controls remain unverified until the isolated Supabase development project completes `npm run db:remote:verify`.

## Security posture

The honest privacy description for the private alpha is **strong row-level security and server-side isolation**. The application does not claim end-to-end encryption, zero knowledge, complete anonymity, or that infrastructure operators cannot access hosted data.

The application is not approved for high-sensitivity real disclosures or broad public access. Controlled testing must use fictional or low-sensitivity answers.

## Authentication and sessions

- Private layouts call `supabase.auth.getUser()` on the server. Proxy session refresh is a navigation aid, not the authorization boundary.
- Sign-up, sign-in, sign-out, email verification callbacks, forgot-password, and reset-password operations use Supabase Auth.
- Password-reset responses do not disclose whether an email exists.
- Return paths must begin with the active locale prefix and reject protocol-relative values, backslashes, and control characters.
- Account deletion requires the exact `DELETE` confirmation plus current-password reconfirmation.
- The deletion target is derived from the authenticated session. Submitted target-user fields are rejected before the privileged service is called.

Runtime authentication and two-user session behavior still require isolated-environment Playwright verification.

## Invitations and QR codes

- Invitation tokens are generated from cryptographically random bytes inside PostgreSQL.
- Only a SHA-256 token hash is stored. Plaintext is returned once to the creator.
- Tokens expire, are revocable, and are consumed transactionally with row locking.
- QR codes encode only the opaque invitation URL. They do not encode an email, auth UUID, couple UUID, display name, answer, or database key.
- The camera Permissions Policy previously blocked the QR scanner. It now permits camera access from `self` only while microphone and geolocation stay disabled.
- Concurrent redemption has a two-connection test harness, but its result remains pending PostgreSQL execution.

## Answers, comparison, and reveal

- Direct answer-table policies are intended to expose only an authenticated user's own answers, even when a partner answer is revealed.
- Comparison is requested through the protected `get_question_comparison` database function and parsed against a discriminated safe-response schema in a server-only module.
- The browser does not calculate a comparison bucket.
- Free-text questions are constrained to `discussion_only` or `never_compare` in the canonical schema.
- Reveal and revoke actions identify a question UUID, then re-select the current user's owned answer before updating it.
- A private response contains `partner_answer: null` unless that exact partner answer is currently revealed.
- Summary export currently excludes all raw answers, including revealed answers. It includes shared notes, workflow status, and checklist state only.

These guarantees depend on the pending 95-assertion pgTAP suite and cannot be described as runtime-verified yet.

## Journey and account deletion

- Both participants accept the versioned journey-wide deletion policy before activation.
- `prepare_account_deletion(uuid)` is service-role-only. Its sole application caller passes the server-authenticated user UUID, never a body-provided target.
- Journey-scoped answers for both participants, reveal history, discussions, checklist state, memberships, and outstanding invitations are removed when either user deletes the journey.
- The remaining participant receives only a content-free closure notice.
- Active-database deletion is distinct from provider-managed backup retention. No instant backup-erasure promise is made.

The database cascade and remaining-participant isolation tests remain pending PostgreSQL execution.

## External feedback handoff

- `NEXT_PUBLIC_FEEDBACK_FORM_URL` is optional and browser-visible.
- The validator accepts HTTPS `docs.google.com/forms/...` and `forms.gle/...` links only.
- Query strings and fragments are removed before rendering, so the app cannot forward prefilled names, emails, answers, invite codes, journey IDs, notes, or reveal records.
- The link opens with `target="_blank"` and `rel="noopener noreferrer"`.
- No analytics or private telemetry is attached to the external-link action.
- The app does not claim to know whether the Google Form was submitted.

## General web controls

- Responses set CSP, frame denial, no-sniff, no-referrer, same-origin opener policy, and a restricted Permissions Policy.
- The compatible static CSP denies objects, external frames, cross-origin form submission, and unexpected network connections. Next.js currently requires inline style/script allowances; a nonce-based CSP is a future hardening item.
- Server Actions use Next.js same-origin checks and SameSite authentication cookies. Mutations also re-authenticate and validate input with Zod or narrow runtime checks.
- User-facing errors are generic and do not include SQL, credentials, payloads, emails, or another user's data.
- The service-role and database URL variables are not public-prefixed. The admin client imports `server-only`.
- No third-party analytics, marketing scripts, or private-content logging are installed.

## Open risks and release blockers

1. The full PostgreSQL reset/replay, lint, pgTAP, concurrency, comparison, reveal, and deletion suite has not run because isolated credentials are absent.
2. Authenticated two-user Playwright coverage requires disposable verified accounts and a migrated isolated database.
3. A provider-backed rate limiter is not yet configured for invite creation/redemption and destructive actions. Supabase Auth applies its own auth limits, but application RPC throttling must be selected and verified before broader exposure. An in-memory serverless limiter was intentionally not presented as durable protection.
4. Next.js 16.2.10 is a provisional development baseline. The announced official security release must be checked on or after 2026-07-20, followed by a complete reinstall, audit, build, authorization, and Playwright rerun.
5. CSP uses compatibility allowances for inline scripts and styles. Nonce-based hardening should be evaluated after the security release and before a public launch.

No item above may be represented as production verification until its runtime gate has executed successfully.
