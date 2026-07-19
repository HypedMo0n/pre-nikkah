# Prototype integration map

This document maps the frontend-only Together in Amanah prototype to the existing localized Next.js and Supabase application. It is an implementation guide, not an authorization to copy the prototype architecture.

## Integration rules

- Production routes remain Next.js App Router routes. The prototype's local state-machine router is not copied.
- Production data comes from authenticated server components, Server Actions, route handlers, and protected PostgreSQL functions.
- The browser never calculates comparison buckets and never receives an unrevealed partner answer.
- Reveal and revoke state remains keyed to an individual question UUID.
- Prototype invite codes, QR values, answers, comparison results, completion states, and account actions are visual fixtures only and are not copied.
- All user-facing copy is supplied by the English and French dictionaries.
- The fixed 390-by-844 prototype frame and responsive `transform: scale(...)` rules are not copied. Production layouts must reflow at real viewport widths.
- Runtime Google Font imports are not copied. Production typography continues through `next/font`.

## Screen mapping

| Prototype screen | Production route or component | Visual and interaction patterns to adopt | Prototype-only behavior not copied | Production data source | Accessibility and mobile considerations | Localization and privacy constraints |
| --- | --- | --- | --- | --- | --- | --- |
| Welcome | `/[locale]`, public welcome page and brand components | Cream canvas, navy display heading, restrained olive primary action, concise trust points | Local `setScreen`, hardcoded language strings, fake navigation | Locale routing and dictionaries | One clear `h1`, 44px actions, no fixed-height shell, safe-area padding | English and French copy must say there is no public profile, no score, and exact answers stay private unless shared |
| Journey explanation | `/[locale]/about` and onboarding product-introduction step | Editorial serif heading, short explanation cards, calm pacing | Static demo card order and local completion state | Localized content and authenticated onboarding state | Semantic sections and headings; cards stack at 320px | No compatibility or marriage recommendation language |
| Privacy explanation | `/[locale]/onboarding/privacy` and privacy components | Privacy reassurance strip, private-answer explanation, strong visual hierarchy | Simulated privacy and claims unsupported by server enforcement | Localized copy plus persisted onboarding completion | Screen-reader-friendly ordered steps; status conveyed in text | Describe strong row-level security and server-side isolation. Never claim E2EE or zero knowledge |
| Invite | `/[locale]/onboarding/invite`, invite actions, `InvitePanel`, `InviteQrCode` | Sand code card, contained QR, copy/share controls, expiry context | Hardcoded code, fake QR URL, client-only joined state, fake partner presence | `create_couple_invite`, `inspect_couple_invite`, `redeem_couple_invite`, `revoke_couple_invite`, authenticated account state | QR remains contained and scannable; codes wrap safely; icon buttons have names; controls stack on narrow screens | QR contains only an opaque token or URL. Never include email, user UUID, couple UUID, names, or private content |
| Private question | `/[locale]/topics/[topicSlug]/questions/[questionId]`, question renderer, answer actions | Navy focus card, compact progress, private reassurance, large answer controls | Hardcoded question and answer, local-only persistence, fake progress | Active question metadata, current user's own answer, server autosave | 16px inputs, labelled range/textarea, live save state, visible focus, save-and-exit, short-screen action access | Exact partner answers are absent. Question content and helpers are localized where available |
| Pace selection | `/[locale]/onboarding/pace` and cadence components | Three non-competitive pace choices, no countdowns or rewards | Purely local pace value with no durable meaning | Authenticated private-account preference and centralized cadence metadata | Radio-group semantics, explanatory labels, no pressured default | Localized as a preference, not a performance target; no sensitive content is collected |
| Compare | `/[locale]/comparisons`, grouped per-question comparison sections | Neutral comparison rows, small text-and-icon statuses, calm explanation | Client-side fake bucket, hardcoded partner state, topic result based on a fixture | Server-only per-question comparison function and aggregate service | Status never color-only; rows remain legible at text zoom; no side-by-side raw-answer layout | Browser receives only own answer, completion, bucket, reveal metadata, and a revealed partner answer when authorized |
| Guided conversation | `/[locale]/conversations/[questionId]`, reveal controls, shared-note form | Original question, neutral framing, answer-specific share/stop-sharing, clear shared-note label | Local shared boolean, local note, mock partner answer, automatic implication of resolution | Safe comparison response, owner reveal action, couple-only discussion record | Confirmation dialog focus management; labelled note; 44px share/revoke actions; internal dialog scroll | Revealing one question cannot reveal another. Notes never auto-copy, quote, infer, or summarize private answers |
| Shared Foundation | Dashboard `FoundationProgress` component | Layered arch motif, empty/soft/gold progress states, reflective copy | Any interpretation as relationship quality, compatibility, strength, or marriage readiness | Both-participant topic completion and discussed-question aggregates | Accessible text list mirrors the visual; no meaning depends on fill alone; arch scales without clipping | Labels are “Topics completed together” and “Topics discussed”; never show a relationship percentage |
| Sharing explainer | Conversation reveal confirmation and settings reveal management | Direct warning that sharing is optional and revocation affects future access | Global/topic sharing state and any promise that seen information can be retracted | Answer-specific reveal state and audit history | Confirmation is keyboard accessible and returns focus | Exact approved explanation: stopping sharing cannot undo information already seen |
| Controlled completion | `/[locale]/test-complete` | Restrained completion mark, honest demo framing, dashboard return | Fake completion state, rewards, celebration metrics | Authenticated controlled-test route and configured feedback-link status | Primary and secondary actions remain visible on short devices | Does not claim the app knows whether feedback was submitted and does not imply production readiness |
| Feedback | External feedback handoff on `/[locale]/test-complete` | Optional single-purpose feedback action | In-app star rating, local feedback fields, fake submission | Validated `NEXT_PUBLIC_FEEDBACK_FORM_URL` only | New-tab behavior is announced; URL failure state is readable; no overflow | Approved HTTPS Cognito Forms endpoint only. No names, emails, invite codes, journey IDs, notes, answers, or reveal metadata are appended |
| Settings | `/[locale]/settings` with conversation-level reveal management and embedded account-deletion form | Dense navy/sand rows, clear destructive-action separation | Fake toggles, local deletion, fake export, any one-tap deletion language | Authenticated account actions, safe summary export, question-scoped reveal controls, server-only admin deletion workflow | Destructive confirmation is labelled, scrollable, keyboard operable, and requires `DELETE` | Target user is always derived from the authenticated server session. Deletion copy explains journey-wide active-data removal and separate provider backup retention |

## Production-only screens covered by the same system

The prototype does not show every required state. The same tokens and components will also cover:

- language selection;
- sign up, sign in, verification, forgot-password, and reset-password screens;
- create-or-join entry choice;
- optional private display name and relationship stage;
- mandatory journey-deletion policy acceptance;
- invite inspection, invalid, expired, used, revoked, self-redemption, and conflict states;
- solo-start and waiting-for-partner states;
- dashboard empty, loading, error, and recommended-topic states;
- autosave pending, saved, failed, offline, and restored states;
- topic completion and waiting comparison states;
- shared checklist and safe summary export;
- content-free journey-closure notice;
- authenticated account deletion and session invalidation.

## Token translation

| Role | Prototype reference | Production intent |
| --- | --- | --- |
| Page background | warm gray and cream | Warm cream outer canvas with no fixed device frame |
| Surface | cream and sand | Cream primary cards and sand secondary sections |
| Primary text and emphasis | deep navy | Dominant brand anchor and productive navigation surface |
| Primary action and progress | muted olive | Restrained actions and workflow progress, never a compatibility signal |
| Highlight | muted gold | Shared progress and calm completion emphasis, never a score |
| Warning and concern | amber and muted red | Text-and-icon workflow states with reviewed semantics only |
| Typography | Libre Baskerville and DM Sans | Existing `next/font` display serif and sans product register |
| Shape | medium rounded cards | Maintainable radius tokens, smaller radii on dense rows |
| Focus | prototype outline intent | High-contrast reusable focus-ring token and visible `:focus-visible` states |

## Security boundary summary

The visual integration does not change the security boundary. Proxy-based route checks improve navigation but are not authorization. Supabase RLS, protected database functions, authenticated Server Actions, route handlers, and server-only administrative modules remain authoritative. Client components receive only the minimum safe response shape required for the current screen.
