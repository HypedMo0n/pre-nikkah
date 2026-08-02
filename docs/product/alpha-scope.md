# Private-alpha scope

This file defines "done" for private alpha as a fixed target. It is the
authority on what belongs in the alpha; a feature that is not listed under
in scope does not get built under alpha, no matter how small it seems.
Scope additions require updating this file first, not a pull request that
adds the feature and the scope note in the same change.

Two invariants apply to everything below and are not subject to revision by
this document or a future one without a separate, explicit product decision:

- No compatibility score, marriage-readiness score, or match/recommendation
  output, ever. This is a product invariant, not a preference to be weighed
  against a feature request.
- The existing privacy model does not weaken. Per-answer reveal/revoke,
  `never_compare`, and the `sensitivity`/`comparison_mode` visibility rules
  in `supabase/migrations/20260718000300_answers_and_progress.sql` and
  `supabase/migrations/20260718000500_safe_read_functions.sql` stay exactly
  as they are. Any of the four items below that could be read as license to
  loosen them is scoped explicitly to avoid that reading.

### Amendment: the v3 rewrite against the second invariant

The v3 schema dropped all three named protections. This is the explicit
product decision the invariant requires, taken before the cutover rather than
discovered after it.

- **Per-answer revoke is restored**, in `20260725000300_revoke_answer.sql`.
  `revoke_answer()` deletes every share of an answer and is deliberately not
  gated on space status or membership: granting access is refused while
  paused, withdrawing it never is. Without this a person who shared an answer
  about money, family or faith and then thought better of it had no way back
  short of deleting their account, which is the part of the invariant carrying
  real user-safety weight.
- The same migration stops a share outliving the relationship. `close_space()`
  ends memberships without deleting `answer_shares`, and the read predicate
  authorized on the share row alone, so a former partner kept read access to
  every answer ever shared with them, indefinitely. Current membership is now
  required, matching `get_revealed_disclosures()`.
- **`never_compare` and `sensitivity`/`comparison_mode` are superseded**, not
  restored. v3 replaced free-text answers with fixed options per question, so
  a comparison is a neutral bucket over a closed set rather than an inspection
  of what someone wrote. The per-topic visibility rule in
  `20260725000200_topic_partner_visibility.sql` withholds partner-derived
  state outside the couple's current shared topic, and the disclosure engine
  gives material facts a home that is never compared at all. Reinstating a
  per-question opt-out on top of that is a product question for after alpha,
  not a precondition of it.

Restoring the two superseded flags later remains open. Nothing in v3 forecloses
it; it would mean new columns, seed content, and comparison logic.

## 1. Current state

Built and locally verified:

- The Next.js 16 App Router foundation, localized (English/French)
  authentication and onboarding, invite codes and QR, pace preference,
  dashboard, autosave, per-answer reveal/revoke, guided-discussion notes,
  shared checklist, settings, safe summary export, and account deletion UI
  described in `README.md` are present as source and pass local
  typecheck/lint/unit/build/mobile-e2e per the `npm run` scripts in
  `README.md`.
- The Phase 2 database source is fully authored: five ordered migrations
  (`supabase/migrations/2026071800*` through `…500`) define `topics`,
  `questions`, `answers`, `answer_reveal_events`, `topic_progress`,
  `guided_discussions`, `couple_checklist_items`, `journey_closure_notices`,
  and the safe-read functions `get_connection_overview`,
  `get_question_comparison`, and `get_topic_comparison_summary`. RLS is
  enabled in the same migration that creates each table, and privileges are
  granted explicitly rather than left at table defaults.
- Four pgTAP suites are authored in `supabase/tests/database/`
  (`rls_and_authorization.test.sql`, `comparison_matrix.test.sql`,
  `schema_security.test.sql`, `account_deletion.test.sql`), together with a
  two-connection concurrency harness for invite redemption.

Authored but unverified:

- Per `docs/security/phase-2-execution-status.md`, none of the pgTAP
  assertions have executed against a real PostgreSQL instance. Migration
  replay, seed replay, `db:lint`, authorization, concurrency, comparison,
  reveal, and deletion-cascade behavior are all claims about source code
  that have not been run. `docs/security/private-alpha-security-review.md`
  is explicit that this remains a source review, not a runtime one.
- Runtime authentication and two-user authorization behavior (real Supabase
  Auth sessions, real RLS enforcement) are unverified for the same reason.

A stale-documentation note for accuracy: `supabase/README.md` currently
states the seed adds "four active topics, 27 original questions." The
actual `supabase/seed.sql` defines eight topics and 34 questions
(communication-and-conflict, faith-and-religious-practice,
family-boundaries-and-involvement, living-arrangements, household-roles,
finances-and-debt, children-and-parenting, and dealbreakers). This scope
document is written against the actual seed content, not the stale count.
`supabase/README.md` should be corrected separately; that correction is not
part of this file's scope.

## 2. In scope

Exactly the following four items. Each is design-only for this phase: no
schema, migration, or seed content is authored against these definitions
until a follow-up implementation task exists.

### a) Disclosure engine

**Gap.** The `answers` table stores an opinion or preference against a
canonical `questions` row, validated by `validate_answer_write()` and typed
by `comparison_mode` (`exact`, `scale_distance`, `discussion_only`,
`never_compare`). There is no model for a material factual disclosure —
a prior marriage, dependents, a health condition materially relevant to
marriage, or debt beyond what `finances-and-debt` already asks in general
terms. The current design actively avoids this: the dealbreakers question
(`10000000-0000-4000-8000-000000000801`) and the family-boundaries
`never_compare` question (`…-307`) both instruct the user not to include
health, trauma, or abuse information in their answer. The app has no other
place for that information to go, so today it simply goes nowhere.

**Requirement.** A disclosure is a fact the discloser states about
themselves, not an opinion about a shared question. The requirement is a
separate conceptual model — an **attestation**, not a comparison:

- Attestations are never bucketed into `aligned` / `worth_discussing` /
  `possible_concern`. There is no valid comparison operation on a fact of
  this kind, which is a stronger statement than `never_compare` on today's
  `answers` table (that flag says "we choose not to compare this opinion";
  an attestation has no comparison to choose not to run).
- An attestation needs a structured presence/absence signal per fixed
  disclosure category (has a disclosure been made for this category: yes or
  no), which free text on `answers` does not provide.
- Reveal of an attestation is a distinct, explicit action per attestation,
  never inherited from revealing an unrelated answer, and — because the
  content is a fact about the person's life rather than a preference —
  the requirement includes a confirmation step at reveal time that a
  reveal/revoke confirmation for an ordinary answer does not need.

**Privacy model.** Attestation content stays owner-only until explicitly
revealed, exactly like `answers`. What differs is that partner-visible
state, if any exists before a full reveal, must never be more than "a
required disclosure category has or has not been attested to" — never a
summary, category label, or partial content. No schema is written in this
task; this section fixes the requirement that a future schema must satisfy.

**Status: closed at the database layer, against the v3 model.**
`20260725000100_disclosure_attestations.sql` adds `disclosure_categories`,
`disclosure_category_translations`, `disclosure_attestations`, and
`disclosure_reveals`, with the four fixed categories this section names:
previous marriage, children and dependents, health relevant to marriage, and
financial obligations.

- **No comparison is possible, not merely declined.** `comparisons` keys on
  `question_id` and an attestation has no question, so there is no path by
  which one could be bucketed. Asserted structurally rather than by policy.
- **A direct read is owner-only, including after a reveal.** This is stricter
  than `answers`, where an explicit recipient may read the row itself. Revealed
  content reaches a partner only through `get_revealed_disclosures()`.
- **Reveal is per attestation and explicit.** It lives in its own table behind
  `reveal_disclosure_attestation()`, which rejects the call without a
  confirmation argument, so revealing an answer cannot reveal an attestation
  and revealing one attestation cannot reveal another.

One reading had to be fixed. "A required disclosure category has or has not
been attested to" and "never a category label" pull in opposite directions,
since a per-category signal necessarily names the category. The conservative
reading was taken: `get_disclosure_overview()` returns counts only —
`requiredTotal`, `ownAttested`, `partnerAttested` — with no category id, key,
or title, so a partner learns that disclosures exist without learning which.
A test asserts those are the only three keys.

Proven by `supabase/tests/database/disclosure_attestations.test.sql`, 37
assertions. Executed against PostgreSQL 16 from a clean database — every
migration in `supabase/migrations/`, then `supabase/seed.sql`, then all four
suites: 114 assertions, no failures.

Not included: the UI for recording and revealing an attestation, including the
reveal confirmation screen. The database refuses an unconfirmed reveal, so the
invariant holds regardless, but the surface a person uses is separate work.

### b) Safety/off-ramp layer

**Gap.** No routing exists anywhere in the app for coercion or safety
signals. The dealbreakers and family-boundaries questions tell a user not
to put abuse or trauma detail in their answer, but the app gives that user
nowhere else to go. `docs/product/question-cadence.md` establishes a
relevant constraint already: cadence metadata "does not inspect answer
values," and no raw answer content is used for any adaptive behavior. A
safety feature must respect the same boundary — it cannot read answer
content to decide when to trigger, because that would mean scanning private
answers, which nothing in this app does today and which this scope does not
introduce.

**Requirement — minimum viable version.**

- A static, locale-aware resources surface: generic, jurisdiction-agnostic
  safety information and an "if you feel unsafe" framing, plus a way to
  leave the current screen quickly. Static content only — no per-user
  detection, scoring, or routing logic based on answer content.
- It must be reachable without an authenticated session, since a person
  affected by coercion may not be able to safely reach a signed-in screen.
- It must appear in the flow at, at minimum: every `sensitive` and
  `professional_discussion` question screen (the same tier that already
  carries the "do not include abuse/trauma detail" copy), the onboarding
  privacy explanation, and a persistent link from settings.

**Status: closed, against the v3 model.**
`app/[locale]/(public)/resources/page.tsx` is a static, locale-aware surface
carrying an "if something doesn't feel safe" framing, signs worth taking
seriously, what a person can do, and what this app does and does not do. It is
outside `protectedPrefixes` and makes no Supabase call, so it renders with no
session. It reads no answer, topic, or per-user state.

Content is deliberately jurisdiction-agnostic: it points at local emergency
services and local organisations rather than naming a hotline that would be
wrong for most readers.

`components/safety/quick-exit.tsx` leaves via `location.replace` so the current
history entry is overwritten rather than stacked, and also fires on Escape. A
browser cannot erase the entries before it, so the page says plainly that this
does not clear browsing history and explains what to check.

One deviation from the wording above. The v3 rewrite removed the sensitivity
tiers — `20260724000100_together_in_amanah.sql` carries no `comparison_mode`
and no sensitivity column — so "every `sensitive` and `professional_discussion` question
screen" has no v3 equivalent. The link is therefore on **every** question
screen, a superset of what this section asks for. The onboarding entry point is
`/product`, since `/privacy` now redirects there. Settings carries the
persistent link.

Beyond the written requirement, opening the off-ramp recorded an analytics
pageview. Vercel Analytics is cookieless and does not identify a visitor, but
this surface exists for people whose activity may be watched, so
`components/analytics/site-analytics.tsx` drops the event for `/resources`.

Proven by `tests/e2e/safety-resources.spec.ts`. The signed-out cases run
anywhere; the settings and question-screen cases follow the repository's
existing convention of skipping without `E2E_BASE_URL`.

### c) Seed content gaps

**Gap — mahr / marriage-contract.** `checklist_definitions` has a
`clarify-mahr` item (order 8), but no question in `finances-and-debt`
(topic `00000000-0000-4000-8000-000000000102`) addresses mahr type
(immediate or deferred) or marriage-contract expectations. The topic's
seven questions cover general finances, debt, transparency, family support,
and major purchases, but mahr and contract terms are absent entirely.

**Requirement.** At least one comparison-eligible question (following the
existing `single` or `scale` pattern already used in `finances-and-debt`)
and, given the sensitivity, likely one `discussion_only`-tier prompt, must
be added to `finances-and-debt` covering mahr and marriage-contract
expectations. No content is authored in this task.

**Gap — intimacy.** No topic or question in the current seed addresses
intimacy expectations at all.

**Requirement.** At least one sensitive-tier intimacy-expectations question
must exist, following the existing pattern for sensitive material in this
schema (`sensitivity = 'sensitive'` or `'professional_discussion'`, with
`comparison_mode` of `discussion_only` or `never_compare` depending on how
the content is eventually authored). Topic placement (existing topic vs. a
new one) is a content-authoring decision deferred past this scope document.

### d) Partner-visibility softening

**Gap.** `features/topics/stages.ts` computes, per topic, a
`partnerCompletedCount` and a `stage` that includes `"waiting_for_partner"`.
`app/[locale]/(private)/dashboard/page.tsx` renders that per-topic `stage`
for every topic in the list, not only the current shared one. The result:
a user who has completed, say, the dealbreakers or children-and-parenting
topic can see specifically that their partner has not — topic-by-topic,
across the whole list — which exposes which particular sensitive subject
the partner is avoiding or delaying, not just that the journey overall is
still in progress.

**Requirement.** Define a less granular partner-side state: the
partner-facing signal must collapse to something coarser than a per-topic
count or per-topic `waiting_for_partner` label for any topic other than the
couple's current shared topic. The exact collapse rule (a single
whole-journey "partner is progressing" indicator, or restricting
`waiting_for_partner` display to only the current topic) is an
implementation decision for the follow-up task; the fixed requirement here
is that no topic-level partner-completion signal reaches the client for
topics outside the couple's current shared one.

**Status: closed, against the v3 model.** The second option was taken. Note
that this section describes `features/topics/stages.ts`, which the v3 rewrite
deleted; the same leak existed in `features/v3/progress.ts`, across a wider
surface than v2 had:

- `getVisibleTopicStage` collapses `waiting` and `ready` — both disclose
  whether the partner has finished — to a new self-only `your_part_done` for
  any topic that is not the current shared one, and otherwise derives the stage
  from this user's own answers. That last part matters because the previous
  rule returned `in_progress` when only the partner had started, revealing a
  topic they had gone to alone. `discussed` survives, since it means both
  people worked through the topic together.
- `getCurrentTopicId` is the single definition of "current" behind every
  partner-visibility decision, so the rule cannot drift between screens.
- Four render surfaces were disclosing per-topic partner state: the topic list
  ("together" count and stage), the topic detail page (a chip naming the
  partner and their count for whichever topic was opened), the journey path (a
  partner mark on every node), and the summary export, which wrote
  `partnerAnswered` per topic into a downloadable file.

Proven by `tests/unit/topic-progress-visibility.test.ts`, including a case that
no non-current topic can emit a partner-revealing stage. The file this section
names as the place to extend was deleted by the rewrite.

## 3. Phase 2 verification gate

Restated from `README.md` as a hard gate, not a preference: Phase 2, and
therefore private alpha, is not done until the disposable cloud database
passes **two clean** migration, seed, lint, authorization, concurrency,
comparison, reveal, and deletion-cascade runs via `npm run db:remote:verify`
against an isolated Supabase cloud development project.

This gate is independent of items 2(a)–2(d). Completing all four in-scope
items without the gate passing does not make alpha done, and passing the
gate without completing the four in-scope items does not make alpha done
either. Per the existing security review's own rule, no item in this
document may be represented as verified based on source inspection alone —
only a passing runtime gate counts.

## 4. Acceptance criteria

| Item | Testable condition | Test file that should exist |
| --- | --- | --- |
| a) Disclosure engine | A direct read of an attestation record returns rows only to its owner, including after reveal (mirroring the existing direct-read denial proven for `answers` in `rls_and_authorization.test.sql`). No comparison bucket is ever computed for an attestation. Revealing one attestation does not reveal another. | `supabase/tests/database/disclosure_attestations.test.sql` |
| b) Safety/off-ramp layer | The resources surface renders without an authenticated session and is reachable in at most two navigations from every `sensitive`/`professional_discussion` question screen, from onboarding privacy, and from settings. This is a reachability property of the UI, not database state, so a pgTAP file cannot prove it. | `tests/e2e/safety-resources.spec.ts` |
| c) Seed content gaps | `finances-and-debt` contains an active question addressing mahr/marriage-contract expectations. At least one active question across all topics has `sensitivity` in (`sensitive`, `professional_discussion`) and addresses intimacy expectations. | `supabase/tests/database/seed_content_inventory.test.sql` |
| d) Partner-visibility softening | For any topic other than the couple's current shared topic, no response reaching the client contains a per-topic partner-completion count or a per-topic `waiting_for_partner` label. If the fix stays in the application layer, this is proven at the unit level; if it moves into a database-side safe-read function, a pgTAP file should assert the function never returns per-topic partner detail for non-current topics. | Extend `tests/unit/topic-stages.test.ts`; add `supabase/tests/database/partner_visibility.test.sql` only if the computation moves server-side |

## 5. Explicitly out of scope

Deferred. None of the following is built under private alpha. Adding any of
them to scope requires updating this file first:

- Post-nikah / first-year mode — deferred.
- Counselor directory — deferred.
- Imam or masjid licensing — deferred.
- Content marketing engine — deferred.
- Standalone question-bank product — deferred.
- Spiritual/dua content layer — deferred.
- Any monetization surface — deferred.
- Any compatibility scoring — deferred, and per the invariant above, not a
  future alpha feature to be reconsidered later so much as a permanently
  excluded product direction.
