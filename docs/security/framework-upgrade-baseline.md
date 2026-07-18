# Framework upgrade baseline

Recorded at `2026-07-18T11:10:27.9075967-07:00`, before the framework upgrade.

## Installed versions before upgrade

| Package | Version |
| --- | --- |
| Node.js | 24.18.0 |
| npm | 11.16.0 |
| Next.js | 14.2.35 |
| React | 18.3.1 |
| React DOM | 18.3.1 |
| ESLint | 8.57.1 |
| eslint-config-next | 14.2.35 |

The official npm registry reported `next@latest` as `16.2.10`. Its minimum
Node.js version is 20.9.0 and its React peer range includes React 19. The
scheduled July 20, 2026 security release had not shipped when this baseline was
recorded, so the development version selected on July 18 is provisional.

## Pre-upgrade npm audit output

```text
# npm audit report

glob  10.2.0 - 10.4.5
Severity: high
glob CLI: Command injection via -c/--cmd executes matches with shell:true
Advisory: GHSA-5j98-mcp5-4vw2
Dependency path: eslint-config-next > @next/eslint-plugin-next > glob

next  9.3.4-canary.0 - 16.3.0-canary.5
Severity: high
Advisories reported by npm:
- GHSA-9g9p-9gw9-jx7f
- GHSA-h25m-26qc-wcjf
- GHSA-ggv3-7p47-pfv8
- GHSA-3x4c-7xq6-9pq8
- GHSA-q4gf-8mx6-v5v3
- GHSA-8h8q-6873-q5fj
- GHSA-3g8h-86w9-wvmq
- GHSA-ffhc-5mcf-pf4q
- GHSA-vfv6-92ff-j949
- GHSA-gx5p-jg67-6x7h
- GHSA-h64f-5h5j-jqjh
- GHSA-c4j6-fc7j-m34r
- GHSA-wfc6-r584-vfw7
- GHSA-36qx-fr4f-26g5

postcss  <8.5.10
Severity: moderate
PostCSS has XSS via unescaped closing style tags in CSS stringify output
Advisory: GHSA-qx2v-qp2m-jg93
Dependency path: next > postcss

Total: 5 vulnerabilities (1 moderate, 4 high)
```

No forced audit remediation or dependency override was used.

## Official upgrade sources reviewed

- [Next.js 14 to 15 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Next.js 15 to 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js 16 release](https://nextjs.org/blog/next-16)
- [Next.js codemods](https://nextjs.org/docs/app/guides/upgrading/codemods)
- [Next.js Proxy documentation](https://nextjs.org/docs/app/getting-started/proxy)
- [Next.js security advisories](https://github.com/vercel/next.js/security/advisories)
- [Supabase Next.js SSR guidance](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
- [Supabase SSR caching guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide)

## Expected breaking changes

The application is small enough for a direct 14-to-16 package upgrade, with
the 14-to-15 and 15-to-16 changes applied explicitly and reviewed separately.
The official codemod is not necessary for the two affected source files.

1. React and React DOM move from 18.3 to the React 19 line supported by the
   selected Next.js 16 release. React type packages must move with them.
2. `cookies()` is fully asynchronous. `lib/supabase/server.ts` must await the
   cookie store and its `createClient` factory must become asynchronous.
3. `middleware.ts` is deprecated in Next.js 16. It must become `proxy.ts`, and
   the named export must become `proxy`. Proxy runs on the Node.js runtime.
4. Supabase SSR continues to use cookie-based `createServerClient`. The Proxy
   must copy refreshed cookies and cache-control headers to the response, while
   server authorization continues to use a verified Auth call rather than a
   client-supplied session value.
5. `next lint` is removed. Linting must use the ESLint CLI and flat
   configuration with `@next/eslint-plugin-next`.
6. Turbopack becomes the default for development and production builds. This
   repository has no custom webpack configuration, so no opt-out is expected.
7. Uncached `fetch` and GET Route Handler defaults introduced in Next.js 15 are
   suitable for authenticated data. Private responses must remain explicitly
   non-cacheable.
8. `params` and `searchParams` become promises. No current route consumes them,
   but all Phase 3 and later routes will use the asynchronous forms.
9. Server Actions and Route Handlers must authenticate independently and derive
   identity server-side. No current action or handler requires migration.
10. Node.js 20.9 or newer and TypeScript 5.1 or newer are required. The current
    Node.js 24.18 and TypeScript 5 installation satisfy these requirements.
11. Vercel supports the selected stable Next.js line and Node runtime. The
    application does not use Edge-only Proxy behavior.
12. App Router prefetch and client cache behavior changes do not require a code
    edit, but authenticated pages remain dynamically rendered and must be
    covered by protected-route tests.

## Security release timing

The production framework baseline cannot be finalized before checking the
official Next.js security channel again on or after July 20, 2026. Until then,
the upgraded branch is a development baseline and must not be described as
production-ready.
