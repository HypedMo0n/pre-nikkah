# E2E testing guide

## Local setup

1. Install dependencies with `npm ci`.
2. Install browsers with `npx playwright install --with-deps chromium webkit`.
3. Start/reset local Supabase for destructive tests with `npm run db:start` and `npm run db:reset`.
4. Run `npm run test:e2e`.

Destructive journey and account-deletion tests must run only against local Supabase. Set `ALLOW_DESTRUCTIVE_E2E=true` only for local test environments.

## Private-alpha smoke variables

Production or preview smoke tests use these environment variables and must never print or store their values:

- `E2E_BASE_URL`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

Authenticated smoke tests read credentials with `process.env.E2E_TEST_EMAIL` and `process.env.E2E_TEST_PASSWORD`. Missing values produce a clear environment-variable error when authenticated smoke is enabled against `E2E_BASE_URL`.

## Common commands

- Full local E2E: `npm run test:e2e`
- Headed mode: `npm run test:e2e:headed`
- Debug mode: `npm run test:e2e:debug`
- Production-safe smoke tests: `E2E_BASE_URL=https://pre-nikkah.vercel.app npm run test:e2e:smoke`
- One test file: `npx playwright test tests/e2e/smoke.spec.ts`

## Trace and artifacts

The Playwright config captures screenshots only on failure, retains videos and traces on failure, and writes the HTML report to `playwright-report`. Open a trace with:

```bash
npx playwright show-trace test-results/playwright/<trace>.zip
```

## Redaction rules

Do not include emails, passwords, cookies, Supabase JWTs, invite codes, or raw user IDs in source, logs, screenshots, traces, or test reports. E2E observers redact common credential, token, and code patterns before attaching browser-failure summaries.
