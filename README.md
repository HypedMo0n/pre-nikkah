# PreNikkah

This repository contains a privacy-first application for two people who are
seriously considering marriage. It helps each person answer privately, compare
general patterns safely, discuss selected questions, and plan practical next
steps without producing a compatibility score or marriage recommendation.

Branding is configured through `NEXT_PUBLIC_APP_NAME` and `config/brand.ts`.

## Current phase

Phase 1 provides the Next.js 16 App Router foundation, strict TypeScript,
Tailwind design tokens, responsive base components, validated environment
access, Supabase browser and server clients, a server-only admin boundary,
session-refresh Proxy, protected-route scaffolding, and the public welcome
screen.

Phase 3 and private-alpha interface source implementation are complete. Runtime authentication and database authorization verification remain gated on the isolated development environment. The repository includes localized English and
French authentication and onboarding, email verification and password reset,
start-or-join choices, policy acknowledgment, opaque invitation codes and QR
codes, a durable non-gamified pace preference, solo start, an authenticated dashboard, private autosave, server-only
comparison consumption, answer-specific reveal/revoke controls, guided notes,
shared checklist progress, private display-name settings, answer reveal management, safe journey closure, safe JSON summary export, an optional provider-neutral feedback handoff, and a
protected account-deletion caller. The integration map, question-cadence model,
private-alpha security review, and Vercel staging guide are under `docs/`.

Phase 2 database source and its remote-development execution harness have been
authored. Phase 2 is not marked complete until the disposable cloud database
passes two clean migration, seed, lint, authorization, concurrency, comparison,
reveal, and deletion-cascade runs. See `supabase/README.md`.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer
- A Supabase project for authenticated features
- Either Docker Desktop for local Supabase or an isolated disposable Supabase
  cloud development project

## Environment

Copy `.env.example` to `.env.local` and provide:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
ALLOW_DESTRUCTIVE_DEV_DB_OPERATIONS=false
NEXT_PUBLIC_APP_NAME=PreNikkah
NEXT_PUBLIC_FEEDBACK_FORM_URL=https://www.cognitoforms.com/PreNikah/PreNikahAlphaFeedback2
```

The service-role key is imported only by `lib/supabase/admin.ts`. That module
uses the `server-only` package so a client-component import fails at build time.
Never prefix the service-role variable with `NEXT_PUBLIC_`.
`SUPABASE_DB_URL` is used only by local database tooling and must never be
committed, pasted into reports, or placed in a public environment variable.
`NEXT_PUBLIC_FEEDBACK_FORM_URL` is public configuration, not a secret. It must
use the approved HTTPS Cognito Forms host and path. The app sends no private
journey information to the form. A future provider can be selected by changing
the centralized validator and environment configuration without rewriting UI
components.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e:mobile
npm run db:lint
npm run db:test
```

For the isolated cloud development database, set the two non-public database
variables only in an ignored `.env.local`, then run:

```bash
npm run db:remote:verify
```

The command fails closed unless `ALLOW_DESTRUCTIVE_DEV_DB_OPERATIONS=true`, the
secret environment file is ignored and untracked, and the URL identifies a
Supabase cloud host. It masks connection details in captured command output.

## Architecture

The project uses App Router route groups:

- `app/[locale]/(public)` for localized product and invitation-entry routes
- `app/[locale]/(auth)` for localized authentication routes
- `app/[locale]/(private)` for server-authenticated onboarding and product routes
- `features` for server actions, validation, permissions, and domain logic

Feature logic lives in `features`, privileged data access in server-only
modules, domain types in `types`, and reusable interface components in
`components`.

## Privacy foundation

- Authentication is verified on the server with `supabase.auth.getUser()`.
- Proxy refreshes sessions and protects private route prefixes.
- The service-role client cannot be imported into browser code.
- No private answer data is included in the current client state.
- Security headers disable framing, referrer leakage, and unused sensitive
  browser capabilities.
- No analytics or private-payload logging is installed.

The full raw-answer privacy guarantee depends on the Phase 2 database schema,
RLS policies, secure comparison functions, and authorization tests. The source
for these controls is present, but the tests still require a runnable local or
remote development database. Do not use this phase as a production deployment.

The public mobile suite covers English and French at 12 required viewports plus
iPhone SE, modern iPhone, Pixel Android, and tablet emulation. Authenticated
two-user Playwright tests require disposable isolated-environment accounts and
are skipped when those test credentials are absent.

## Deployment status

Vercel is the target deployment platform. A protected preview is documented in
`docs/deployment/vercel-private-alpha.md`. Public production must wait until the
database migrations, authorization tests, authenticated two-user flow, deletion
flow, the announced Next.js security release recheck, and production
verification phases are complete.
