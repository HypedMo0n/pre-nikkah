# Together in Amanah v3 — Milestone 0 rewrite audit

This is the Milestone 0 deliverable required before any v3 application code is
written: a written audit of what exists today, mapped against the v3
implementation prompt's data model, screens, and invariants. No application
code was written as part of producing this report.

**Decision on record:** the v3 rewrite gуts `app/` and `components/` and
rebuilds inside this repo — it does not need to stay live during the
rewrite. The database is a clean schema replacement (drop and reseed); there
is no production data requiring a migration path. This document therefore
supersedes `docs/product/alpha-scope.md` as the active scope reference. That
file is left in place as a historical record of the pre-v3 alpha rather than
deleted or rewritten in place.

## 1. Current Supabase schema — tables, constraints, RLS (verbatim policy clauses)

**`private_accounts`** (`id` = `auth.uid()`, cascade-deleted with the auth user)
Columns: `preferred_locale` (`en`/`fr`), `private_display_name`,
`relationship_stage` (enum), `onboarding_completed`, `onboarding_step`,
`product_intro_completed`, `privacy_intro_completed`, `entry_mode`
(`create`/`join`), `preferred_pace` (`gentle`/`steady`/`flexible`),
timestamps.
RLS: `"private account owner can read"` — `using (id = (select auth.uid()))`.
`"private account owner can update"` — same `using`/`with check`, and only a
named column list is grantable (locale, display name, stage, onboarding
flags, entry mode, pace — **not** `id`).

**`couples`** (`user_a_id`, `user_b_id` nullable, `status`
`waiting`/`active`/`closed`)
Constraints: members must differ; status must match membership shape
(`waiting` ⇒ `user_b_id is null`, `active` ⇒ not null).
RLS: `"couple members can read their journey"` —
`using (public.is_current_user_couple_member(id))`. No insert/update/delete
policy for clients at all — every write goes through `SECURITY DEFINER`
functions.

**`couple_memberships`** (`couple_id`, `user_id`, `member_role` `a`/`b`,
`ended_at`)
Unique partial index `one_current_couple_per_user on (user_id) where
ended_at is null` — a user can hold exactly one live membership at a time,
DB-enforced.
RLS: enabled, **all privileges revoked from `anon`/`authenticated`, zero
policies**. Fully function-only.

**`journey_policy_acceptances`**: RLS enabled, all revoked, zero policies.
Function-only, validated by a trigger requiring current-version acceptance
plus live membership.

**`couple_invites`** (`code_hash` unique, SHA-256 only — plaintext never
stored): RLS enabled, all revoked, zero policies. Function-only
(`create_couple_invite`, `redeem_couple_invite`, `inspect_couple_invite`,
`revoke_couple_invite`, all `SECURITY DEFINER`, fixed `search_path`).

**`topics` / `questions` / `checklist_definitions`**: RLS `"authenticated
users can read active …"` — `using (is_active)` (questions additionally
requires the parent topic active). No write grant to any client role at
all.

**`answers`** (`question_id`, `user_id`, `couple_id`, `value jsonb`,
`revealed`, `revealed_at`, plus `importance`/`discussion_preference` from
the most recent migration)
RLS: `"answer owner can read"` `using (user_id = auth.uid())`; insert/update
policies additionally require `couple_id = current_couple_id()`; `"answer
owner can delete"` same owner check. No policy path lets a partner read
another user's row, revealed or not — reveal is consumed only through the
`get_question_comparison` function.

**`answer_reveal_events`**: RLS enabled, all revoked, zero policies —
append-only audit trail written by a trigger, unreadable by any client
role.

**`topic_progress`**: `"couple members can read topic completion"`
`using (is_current_user_couple_member(couple_id))`; insert/update/delete
scoped to `user_id = auth.uid() and couple_id = current_couple_id()`.

**`guided_discussions`** / **`couple_checklist_items`**: read scoped to
`is_current_user_couple_member(couple_id)`; insert/update scoped to
`couple_id = current_couple_id()`. `guided_discussions` carries one
`shared_note` per question (a single mutable text field, not a list of
dated entries).

**`journey_closure_notices`**: owner-only read; owner can update only the
`acknowledged_at` column (column-level grant).

**Comparison/read functions** (`get_connection_overview`,
`get_question_comparison`, `get_topic_comparison_summary`): all `SECURITY
DEFINER`, `stable`, fixed `search_path`. `get_question_comparison` computes
`state`/`bucket` server-side from both rows and returns the partner's raw
`value` only when that specific answer's `revealed = true` — structurally
the same one-way, per-question, revocable disclosure model v3 calls
`answer_shares`, implemented today as a boolean+timestamp on the row plus an
audit table instead of a separate junction table.

## 2. Auth flow and session handling

- `proxy.ts` (Next 16 Proxy) calls `lib/supabase/proxy.ts:updateSession`,
  which calls `supabase.auth.getClaims()` on every non-static request and
  redirects unauthenticated requests to `/{locale}/sign-in` for any path
  `isProtectedPath()` matches. It copies refreshed session cookies onto the
  redirect response.
- Server Components/Actions use `lib/supabase/server.ts:createClient()`
  (cookie-based SSR client) and `lib/auth/require-user.ts:requireAuthenticatedUser()`,
  which calls `supabase.auth.getUser()` server-side and redirects to
  sign-in with a `next` param if absent — this is the real authorization
  boundary; Proxy is a navigation aid, not authorization.
- `handle_new_auth_user()` trigger on `auth.users` insert auto-creates the
  matching `private_accounts` row from signup metadata.
- Service-role client (`lib/supabase/admin.ts`) is `server-only`-guarded and
  used only for account deletion.

## 3. i18n routing

- Homegrown, not next-intl: `lib/i18n/config.ts` defines `locales =
  ["en","fr"]`, `localizedPath()`, a locale cookie.
  `lib/i18n/dictionaries.ts` is one flat `Record<key,string>` per locale
  with a `translate(locale, key)` lookup and a `TranslationKey` type
  derived from the `en` object's keys — every string is typo-checked at
  compile time, a real strength worth keeping regardless of what replaces
  the UI.
- Routing is `app/[locale]/...` App Router segments. There is also a
  top-level, locale-less `app/(app)`, `app/(auth)`, `app/(public)` route
  group (the `/sign-in`, `/sign-up`, and root `/` build-output routes) — a
  duplicate shim layer outside `[locale]`, currently just a language-picker
  entry point (`app/(public)/page.tsx`). This duplication is a cleanup
  item independent of the v3 rewrite.
- v3's requirement to "assume more languages will be added — no
  two-language assumptions in routing, state, or UI" is **not yet true**
  of the current `LanguageEntryPage`: its language links are two hardcoded
  `<Link>` elements, not driven by the `locales` array.

## 4. What survives contact with the v3 data model, what doesn't

**Survives as-is:**
- `private_accounts`, `couples`, `couple_memberships`,
  `journey_policy_acceptances`, and the invite system (`couple_invites` +
  its four functions) — v3's `profiles`/`spaces`/`space_members` map almost
  1:1 onto these, and the invite/pairing mechanics (hashed codes,
  one-current-couple-per-user unique index, transactional redemption)
  already do what v3 §4 asks. Rename/adapt rather than rebuild.
- The RLS pattern itself — owner-only base tables, `SECURITY DEFINER`
  functions as the only path to derived/shared data, zero policies on
  tables that should be function-only — is exactly the v3 model. This
  transfers directly.
- Auth flow, Proxy, session handling — no conflict with v3, keep as-is.
- The compile-time-checked dictionary system is a legitimate "next-intl or
  equivalent" per v3's own allowance.

**Needs real migration, not an ALTER:**
- `questions`/`answers`: today supports three question types
  (`single`/`scale`/`text`) and four `comparison_mode`s including free-text
  `discussion_only`/`never_compare`. v3 is single-choice-only, no free
  text, no scale, comparison driven by author-assigned `cluster` rather
  than `comparison_mode`. Every existing question and answer row's shape
  changes. `answers.value jsonb` becomes `answers.option_key text not
  null`; `comparison_mode`/`sensitivity` are replaced by cluster membership
  on options.
- `revealed`/`revealed_at`/`answer_reveal_events` → v3's `answer_shares`
  table. Same guarantee, different shape (append-only grant table vs.
  boolean+audit-log). Re-implemented, not reused verbatim.
- `guided_discussions.shared_note` (one mutable field per question) → v3's
  `shared_notes` (multiple dated, authored entries per question).
  Different cardinality; requires a new table.

**New, with no current equivalent:**
- `space_events`/`event_reads` (notifications) — does not exist anywhere in
  the current schema.
- `comparisons` as its own persisted table — today `get_question_comparison`
  computes state on read rather than writing a row. v3 wants it written by
  the `SECURITY DEFINER` function (a cache vs. compute-on-read decision to
  make explicitly during schema authoring).

**Design system gap, separate from schema:**
- `app/globals.css` already declares `--font-fraunces`/`--font-inter`
  custom properties, but they resolve to `Georgia`/`ui-sans-serif`
  fallbacks. No `next/font` import for Fraunces or Inter exists anywhere in
  the repo — someone started naming toward this direction and didn't
  finish it.
- Current palette (`--color-primary: 94 103 69` olive, `--color-accent: 196
  154 74` gold) is a different exact system from v3's `--green:#34594A` /
  `--amber:#C9923E` tokens — same family, different values.
- The current app has a third semantic color, `--color-concern: 165 65 62`
  (a red), used for the `possible_concern` comparison bucket. v3 is
  explicit that divergence is never rendered as failure and forbids red
  for it. Since v3 drops the three-tier `scale_distance` bucket for a
  two-state `aligned`/`discuss` model, this conflict resolves itself via
  the schema change rather than needing separate reconciliation.
- No `motion` package installed. Currently CSS transitions only.
- Tailwind 3.4 (not v4) with a custom plugin scoping `:hover` to
  `(hover:hover) and (pointer:fine)`, fixing a real iOS Safari
  sticky-hover bug — worth keeping regardless of the rewrite.

## 5. Migration plan

**Altered:** `answers` and `questions` redefined (new columns, dropped
columns, constraints tied to `cluster`/`option_key`/`importance`);
`guided_discussions.shared_note` becomes a proper `shared_notes` table;
token/color/font layers replaced wholesale in `globals.css` and
`tailwind.config.ts`; the duplicate locale-less route group under
`app/(app|auth|public)` resolved as part of the gut-and-rebuild rather than
left dangling.

**Dropped:** `comparison_mode`, `sensitivity` tiers, `scale`/`text`
question types, the `possible_concern`/red bucket, `answer_reveal_events`
(replaced by `answer_shares`), the single-note-per-question shape.

**New:** `space_events`/`event_reads`, `shared_notes` as a real list,
`cluster` on options, `priority` derivation from importance, the `<Path
/>` component's 12-node data shape, the full v3 screen set, Motion, real
Fraunces/Inter loading.

**Kept outright:** account/couple/membership/invite tables and functions,
the RLS-and-`SECURITY DEFINER`-only pattern, Proxy/auth flow, the
dictionary-based i18n system (extended to be locale-list-driven rather than
hardcoded EN/FR), the pgTAP testing discipline in
`supabase/tests/database/` — that test pattern carries forward rewritten
against the new schema, not abandoned.

## Decisions on record

1. Gut and rebuild inside this repo, on a new branch. The rewrite does not
   need to stay live in parallel with the current alpha.
2. Clean schema replacement: drop and reseed. No production data requires a
   migration path.
3. This report is saved to the repo as the Milestone 0 record.
