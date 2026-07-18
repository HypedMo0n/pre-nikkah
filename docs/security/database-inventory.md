# Phase 2 database inventory

This is the intended migration inventory. The remote verifier must confirm the
same objects and privileges through executed database queries before Phase 2 is
complete.

## Tables

| Table | Purpose | RLS | Client-readable | Client-writable | Access mechanism |
| --- | --- | --- | --- | --- | --- |
| `private_accounts` | Minimal private account and onboarding state | Yes | Owner only | Owner, approved columns only | Direct owner RLS; partner name only through safe overview function |
| `couples` | Private journey state and two member references | Yes | Current members only | No | Direct member SELECT; membership changes only through protected functions |
| `couple_memberships` | Internal current-membership enforcement | Yes | No | No | Privileged helper functions only |
| `journey_policy_acceptances` | Versioned deletion-policy acceptance per participant | Yes | No | No | Invite creation and redemption functions only |
| `couple_invites` | Hashed, expiring, one-use invitations | Yes | No | No | Protected create and redeem functions; plaintext returned only at creation |
| `topics` | Canonical active topic definitions | Yes | Active rows for authenticated users | No | Direct authenticated SELECT |
| `questions` | Canonical question definitions and stable option IDs | Yes | Active rows for authenticated users | No | Direct authenticated SELECT |
| `checklist_definitions` | Canonical checklist definitions | Yes | Active rows for authenticated users | No | Direct authenticated SELECT |
| `answers` | Couple-scoped private answers and reveal state | Yes | Owner only | Owner only | Direct owner CRUD; partner value only through safe comparison function after exact-answer reveal |
| `answer_reveal_events` | Timestamped reveal and revoke audit records | Yes | No | No | Trigger only; cascades with answer and journey deletion |
| `topic_progress` | Per-user topic completion | Yes | Current couple members | Owner only | Direct RLS with completion-validation trigger |
| `guided_discussions` | Shared note and discussed state per question | Yes | Current couple members | Current couple members | Direct couple-member RLS with ownership-validation trigger |
| `couple_checklist_items` | Shared checklist completion | Yes | Current couple members | Current couple members | Direct couple-member RLS with state-validation trigger |
| `journey_closure_notices` | Content-free notice that a journey ended | Yes | Notice owner only | Owner may acknowledge only | Direct owner RLS; created by lifecycle functions |

## Functions

`Fixed path` means the function has an explicit `public, pg_temp` search path,
with `extensions` added only where cryptographic functions are required.

| Function | SECURITY DEFINER | Fixed path | Executable roles | Returned sensitive fields |
| --- | --- | --- | --- | --- |
| `set_updated_at()` | No | Yes | Trigger only | None |
| `handle_new_auth_user()` | Yes | Yes | Auth trigger only | None |
| `current_journey_policy_version()` | No | Yes | `authenticated` | Public policy version only |
| `validate_journey_policy_acceptance()` | Yes | Yes | Trigger only | None |
| `validate_couple_activation()` | Yes | Yes | Trigger only | None |
| `is_couple_member_for(uuid, uuid)` | Yes | Yes | Internal only | Boolean membership decision |
| `is_current_user_couple_member(uuid)` | Yes | Yes | `authenticated` | Boolean for requesting user only |
| `current_couple_id_for(uuid)` | Yes | Yes | Internal only | Couple UUID for trusted internal identity |
| `current_couple_id()` | Yes | Yes | `authenticated` | Requesting user's current couple UUID |
| `create_couple_invite(text)` | Yes | Yes | `authenticated` | Plaintext invite code returned once; never stored |
| `inspect_couple_invite(text)` | Yes | Yes | `authenticated` | Generic availability and expiration only; no identity or couple identifiers |
| `revoke_couple_invite(uuid)` | Yes | Yes | `authenticated` | None; creator-only revocation for a waiting journey |
| `redeem_couple_invite(text, text)` | Yes | Yes | `authenticated` | Redeemed couple UUID only |
| `valid_question_options(text, jsonb)` | No | Yes | Constraint only | None |
| `validate_answer_write()` | Yes | Yes | Trigger only | None |
| `log_answer_reveal_event()` | Yes | Yes | Trigger only | None |
| `validate_topic_progress()` | Yes | Yes | Trigger only | None |
| `validate_guided_discussion()` | Yes | Yes | Trigger only | None |
| `validate_checklist_item()` | Yes | Yes | Trigger only | None |
| `close_couple_journey()` | Yes | Yes | `authenticated` | None; deletes journey and creates content-free notice |
| `prepare_account_deletion(uuid)` | Yes | Yes | `service_role` | None; deletes all journey-scoped data for both users |
| `get_connection_overview()` | Yes | Yes | `authenticated` | Connected partner's private display name only, never email |
| `get_question_comparison(uuid)` | Yes | Yes | `authenticated` | Own answer; partner answer only when that exact answer is currently revealed |
| `get_topic_comparison_summary(uuid)` | Yes | Yes | `authenticated` | Aggregate bucket counts only |

There are 24 public functions, including 21 `SECURITY DEFINER` functions. Ten
privileged functions are intentionally executable by `authenticated`; the
account-deletion preparation function is executable only by `service_role`.
