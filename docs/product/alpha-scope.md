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

A note on seed counts: this document was originally written when
`supabase/seed.sql` defined eight topics and 34 questions. The seed now
defines twelve topics and 72 questions, adding careers-education-and-time,
marriage-contract-and-nikah, health-and-wellbeing, and
intimacy-and-closeness alongside the original eight, and moving
dealbreakers to `order_index` 12 so it remains the closing reflection. The
counts in `supabase/README.md` and the verify gate in
`scripts/db/remote-db.mjs` were corrected in the same change.

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

**Status: closed.** `finances-and-debt` now carries a `single` / `exact`
mahr question at `order_index` 8 asking which arrangement (immediate,
deferred, or split) is expected, with helper text keeping the answer to the
general form rather than an amount. The `discussion_only` contract prompt
sits in the new `marriage-contract-and-nikah` topic, which also covers
ceremony, walimah, civil registration, contract conditions, and wali or
witnesses. Proven by `supabase/tests/database/seed_content_inventory.test.sql`.

**Gap — intimacy.** No topic or question in the current seed addresses
intimacy expectations at all.

**Requirement.** At least one sensitive-tier intimacy-expectations question
must exist, following the existing pattern for sensitive material in this
schema (`sensitivity = 'sensitive'` or `'professional_discussion'`, with
`comparison_mode` of `discussion_only` or `never_compare` depending on how
the content is eventually authored). Topic placement (existing topic vs. a
new one) is a content-authoring decision deferred past this scope document.

**Status: closed.** Placement went to a new `intimacy-and-closeness` topic
at `order_index` 11, immediately before dealbreakers. It holds five
questions: a `standard` opener about how each person shows care day to day,
so the topic does not begin on a sensitive prompt, then three `sensitive`
questions on affection, comfort discussing expectations, and how private
this stays from family, and finally a `professional_discussion` free-text
prompt that is `never_compare` and non-revealable. Every prompt is written
to expectations rather than explicit detail, and the free-text helper names
sexual detail, trauma, abuse history, and medical information as
out of scope. Proven by
`supabase/tests/database/seed_content_inventory.test.sql`.

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

**Status: closed.** The second option was taken, and the collapse happens in
`buildTopicStages` rather than in the pages, so no caller can reintroduce the
leak. `computeTopicStages` remains private to the module; the exported builder
maps every non-current topic through `redactPartnerDetail`, which nulls
`partnerCompletedCount`, `bothCompletedCount`, and `completionPercentage`, and
rewrites the stage:

- `waiting_for_partner` and `ready_to_discuss` both disclose whether the
  partner has finished, so both collapse to a new self-only `your_part_done`.
- `in_progress` is recomputed from this user's own answers, because the old
  rule also fired when only the partner had started a topic, which revealed
  which subject they had gone to alone.
- `completed` survives: it means both finished *and* discussed the topic
  together, which both partners already know.

Whole-journey aggregates are still permitted, so `calculateJourneyMetrics` and
`foundationLayersFromStages` now take the builder input and derive from the
unredacted view instead of from the redacted summaries. The comparisons
surface needed no change: `groupComparisons` already drops everything except
`status === 'ready'`, which is only ever a mutually answered question. Proven
by `tests/unit/topic-stages.test.ts`.

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
