# Vercel private-alpha preparation

The application is prepared for a protected Vercel preview or staging deployment. It must not be promoted as public production while database authorization and the authenticated two-user journey remain pending.

## Required environment variables

| Variable | Visibility | Private alpha | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible | Required | URL for an isolated preview/staging Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-visible | Required | Publishable anonymous key for that same project; RLS must remain enabled |
| `NEXT_PUBLIC_SITE_URL` | Browser-visible | Required | Exact HTTPS Vercel deployment origin used for auth redirects |
| `NEXT_PUBLIC_APP_NAME` | Browser-visible | Required | Set to the approved product name; components read the centralized brand config |
| `NEXT_PUBLIC_FEEDBACK_FORM_URL` | Browser-visible | Optional | HTTPS Google Forms responder URL; use an environment-specific form if configured |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Required for deletion | Never expose in client code, logs, preview comments, or screenshots |
| `SUPABASE_DB_URL` | Tooling only | Never set in Vercel | Used only for isolated destructive database verification from a trusted workstation or CI secret store |
| `ALLOW_DESTRUCTIVE_DEV_DB_OPERATIONS` | Tooling safety flag | Never set in Vercel | Must never be enabled in preview or production application environments |

Playwright variables such as `E2E_USER_A_EMAIL` and `E2E_USER_A_PASSWORD` belong only in a protected test runner and must use disposable private-alpha accounts.

## Environment separation

- Preview/staging Supabase must be separate from any future production project.
- Never run destructive verification against production or a shared project.
- Vercel Preview variables should point only to preview/staging services.
- Production variables must not be created until the PostgreSQL gate, two-user authorization journey, Next.js security recheck, and release review pass.
- Protect private-alpha deployments with Vercel deployment protection or another invite-only access control. Supabase authentication remains required inside the app.

## Build settings

Vercel should detect Next.js automatically.

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

The production build command is `npm run build`. The output is the standard Next.js `.next` directory and must not be committed.

## Preview deployment

After Vercel CLI authentication and only when the database verification gate is green:

```bash
npx vercel link
npx vercel env pull .env.local
npx vercel
```

Do not use `vercel --prod` for this private alpha while any critical gate is pending.

## Smoke-test checklist

1. Confirm the deployment is access-protected.
2. Confirm English and French entry, welcome, privacy, auth, and onboarding screens.
3. Verify email redirects return only to the configured HTTPS deployment origin.
4. Create, copy, scan, revoke, regenerate, and redeem an opaque invite.
5. Complete the same question as two disposable users.
6. Inspect browser network payloads and confirm unrevealed partner answers are absent.
7. Reveal exactly one answer, confirm only that answer appears, revoke it, and confirm later responses omit it.
8. Save a shared note and verify an outsider receives no row.
9. Generate a summary and confirm it contains no raw answers.
10. Open the feedback handoff and confirm no application data appears in the URL.
11. Delete one account and confirm journey-wide active data removal plus a content-free notice for the other user.
12. Review server logs for secrets or private content.

## Rollback

1. Promote the last known-good protected preview in Vercel, or redeploy its exact reviewed commit.
2. Do not roll the database backward with destructive SQL. Use a forward migration reviewed against the isolated project first.
3. If privacy isolation is in doubt, disable the affected deployment and invitation entry points immediately.
4. Revoke compromised preview credentials in Supabase and Vercel, then replace them without committing values.
5. Re-run the database and application gates before restoring access.
