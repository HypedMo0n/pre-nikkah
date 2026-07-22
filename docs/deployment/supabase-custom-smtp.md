# Supabase custom SMTP requirement

Supabase's built-in email sending (used for sign-up verification,
password-reset, and any other Auth email) is intended for development and
low-volume testing only. It enforces a strict outbound rate limit — a small
number of emails per hour, shared across the whole project — and is not
sized for real users. Production logs from 2026-07-22 show
`auth.sign_up` failing with Supabase Auth's `over_email_send_rate_limit`
error code once real alpha sign-up volume was exercised.

## Requirement before inviting alpha users

Before any real (non-disposable-test) alpha users are invited to sign up,
the private-alpha Supabase project must have **Custom SMTP** configured in
Supabase Auth settings (Authentication → Emails → SMTP Settings in the
Supabase dashboard), pointed at a transactional-email-capable SMTP
provider. This removes Supabase's built-in per-project send-rate ceiling
and gives the project its own sending reputation and quota.

This document intentionally does not select a provider. Any standard
SMTP-compatible transactional email service is compatible with Supabase's
Custom SMTP setting — the choice is a product/infrastructure decision, not
a code one, and no SMTP provider dependency should be added to the
application without that decision being made explicitly first.

## What configuring it requires

- An account with a transactional email provider, including a verified
  sending domain (SPF/DKIM/DMARC configured on that domain).
- SMTP host, port, username, and password (or API-key-as-password, per the
  provider) entered into the Supabase dashboard's SMTP Settings for the
  private-alpha project.
- A sender address and sender name consistent with the approved product
  branding.
- No repository code change and no new npm dependency — this is Supabase
  project configuration, not an application integration.

## What does not change

- The application already treats `over_email_send_rate_limit` as a
  distinct, localized, non-generic error (see `features/auth/errors.ts`)
  so that when the limit is hit, users see an honest "try again later"
  message instead of a generic failure. Configuring Custom SMTP raises the
  ceiling this error is protecting against; it does not remove the
  possibility of hitting a (much higher) provider-side limit, so the
  distinct error handling stays in place regardless.
- This is separate from `NEXT_PUBLIC_FEEDBACK_FORM_URL` and other
  environment variables documented in `docs/deployment/vercel-private-alpha.md`.
  Custom SMTP is configured in the Supabase dashboard, not as a Vercel
  environment variable.
