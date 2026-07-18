# Private premarital preparation application

This repository contains a privacy-first application for two people who are
seriously considering marriage. It helps each person answer privately, compare
general patterns safely, discuss selected questions, and plan practical next
steps without producing a compatibility score or marriage recommendation.

Branding is configured through `NEXT_PUBLIC_APP_NAME` and `config/brand.ts`.

## Current phase

Phase 1 provides the Next.js App Router foundation, strict TypeScript,
Tailwind design tokens, responsive base components, validated environment
access, Supabase browser and server clients, a server-only admin boundary,
session-refresh middleware, protected-route scaffolding, and the public welcome
screen.

Authentication forms and application integration for invitations, answers,
comparisons, discussions, the checklist, PDF generation, and account deletion
are not yet implemented.

Phase 2 database source has been authored but is not marked complete until its
RLS suite runs successfully against PostgreSQL. See `supabase/README.md`.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A Supabase project for authenticated features
- Docker Desktop for local Supabase migrations and database tests

## Environment

Copy `.env.example` to `.env.local` and provide:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_NAME=
```

The service-role key is imported only by `lib/supabase/admin.ts`. That module
uses the `server-only` package so a client-component import fails at build time.
Never prefix the service-role variable with `NEXT_PUBLIC_`.

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
npm run build
npm run db:lint
npm run db:test
```

## Architecture

The project uses App Router route groups:

- `app/(public)` for public product information
- `app/(auth)` for authentication routes
- `app/(onboarding)` for privacy, relationship-stage, and invitation flows
- `app/(app)` for authenticated product routes
- `app/api` for narrowly scoped route handlers where Server Actions are not a
  good fit

Feature logic will live in `features`, privileged data access in server-only
modules, domain types in `types`, and reusable interface components in
`components`.

## Privacy foundation

- Authentication is verified on the server with `supabase.auth.getUser()`.
- Middleware refreshes sessions and protects private route prefixes.
- The service-role client cannot be imported into browser code.
- No private answer data is included in the current client state.
- Security headers disable framing, referrer leakage, and unused sensitive
  browser capabilities.
- No analytics or private-payload logging is installed.

The full raw-answer privacy guarantee depends on the Phase 2 database schema,
RLS policies, secure comparison functions, and authorization tests. The source
for these controls is present, but the tests still require a runnable local or
remote development database. Do not use this phase as a production deployment.

## Deployment status

Vercel is the target deployment platform. Deployment should wait until the
database migrations, authorization tests, authentication flow, deletion flow,
and production verification phases are complete.
