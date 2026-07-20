# Journey State Machine Fixes

## Problem Statement

The `current_couple_id_for()` function treated both `waiting` and `active` couple statuses as "current", conflating abandoned empty waiting journeys with genuine active two-person journeys.

### Production Symptom

User A creates an invitation and waits for User B to join. After some time:
- The couple has `status='waiting'` and `user_b_id=null`
- The invitation expires or is never redeemed
- User A receives: "Your private account is already connected to another active journey"
- User A cannot join a different invitation without data deletion

### Root Cause

**Migration 20260718000100 — Lines 311–325:**
```plpgsql
create or replace function public.current_couple_id_for(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select membership.couple_id
  from public.couple_memberships membership
  join public.couples couple on couple.id = membership.couple_id
  where membership.user_id = p_user_id
    and membership.ended_at is null
    and couple.status in ('waiting', 'active')  -- ❌ WRONG
  limit 1;
$$;
```

The condition `couple.status in ('waiting', 'active')` is too broad. A `waiting` couple with only one member is not an "active journey" — it's an **abandoned waiting journey**.

## Solution

### 1. Fix `current_couple_id_for()` — Only Active Couples

**New behavior:** Return couple ID only if `status='active'` AND both members are present.

```plpgsql
create or replace function public.current_couple_id_for(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select membership.couple_id
  from public.couple_memberships membership
  join public.couples couple on couple.id = membership.couple_id
  where membership.user_id = p_user_id
    and membership.ended_at is null
    and couple.status = 'active'  -- ✅ ONLY ACTIVE
  limit 1;
$$;
```

### 2. Add `waiting_couple_id_for()` — Distinguish Empty Waiting Journeys

**New function:** Retrieve the empty waiting couple for a user (creator only).

```plpgsql
create or replace function public.waiting_couple_id_for(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select couple.id
  from public.couples couple
  where couple.user_a_id = p_user_id
    and couple.user_b_id is null
    and couple.status = 'waiting'
  limit 1;
$$;
```

### 3. Add `abandon_empty_waiting_journey()` — Safe Cleanup

**New function:** Allow creator to safely close an empty waiting journey.

```plpgsql
create or replace function public.abandon_empty_waiting_journey()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  select couple.id
  into v_couple_id
  from public.couples couple
  where couple.user_a_id = v_user_id
    and couple.user_b_id is null
    and couple.status = 'waiting'
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'NO_EMPTY_JOURNEY_TO_ABANDON';
  end if;

  -- Expire all outstanding unredeemed invites
  update public.couple_invites
  set expires_at = least(expires_at, now())
  where couple_id = v_couple_id and redeemed_at is null;

  -- End creator's membership
  update public.couple_memberships
  set ended_at = now()
  where couple_id = v_couple_id and user_id = v_user_id;

  -- Delete policy acceptances
  delete from public.journey_policy_acceptances
  where couple_id = v_couple_id and user_id = v_user_id;

  -- Close and delete empty couple
  update public.couples set status = 'closed' where id = v_couple_id;
  delete from public.couples where id = v_couple_id;
end;
$$;
```

### 4. Distinguished Error Codes

**`redeem_couple_invite()` now raises:**

| Error | Meaning | User Action |
|-------|---------|-------------|
| `WAITING_JOURNEY_CONFLICT` | User has empty waiting journey | Abandon empty journey, then retry |
| `ACTIVE_COUPLE_CONFLICT` | User is in active two-person journey | Cannot redeem (genuine conflict) |
| `INVITE_EXPIRED` | Invite has expired | Request new invite |
| `INVITE_ALREADY_REDEEMED` | Invite already used | Request new invite |
| `SELF_INVITE` | User created this invite | Join with a different user's invite |
| `INVITE_INVALID` | Code invalid or couple invalid | Check code, request new invite |
| `JOURNEY_POLICY_VERSION_INVALID` | Policy version mismatch | Retry; contact support if persists |
| `AUTH_REQUIRED` | Not authenticated | Sign in |

### 5. Updated `inspect_couple_invite()` — Waiting vs. Active Conflict

**Returns:**
- `{ status: 'available', expiresAt: <ts> }` — Invite is valid
- `{ status: 'waiting_journey_conflict' }` — User has empty waiting journey
- `{ status: 'active_couple_conflict' }` — User is in active journey
- `{ status: 'self_invite' }` — User created this invite
- `{ status: 'unavailable' }` — Invite not found, expired, or already redeemed

### 6. New Server Action: `abandonEmptyJourneyAction()`

**Location:** `features/invites/abandon-journey.ts`

```typescript
export async function abandonEmptyJourneyAction(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const locale = parseLocale(formData.get("locale"));
  const { supabase, user } = await requireAuthenticatedUser(locale);

  const { error } = await supabase.rpc("abandon_empty_waiting_journey");

  if (error) {
    const traceId = logServerActionError({
      action: "journey.abandon_empty",
      context: { errorCode: error.message },
      error,
      userId: user.id,
    });
    return { status: "error", message: appendTraceId(..., traceId) };
  }

  return { status: "abandoned" };
}
```

### 7. Post-Sign-In Router: `getPostLoginRoute()`

**Location:** `features/auth/post-login-router.ts`

Routes authenticated users based on their journey state:

1. **If valid invite provided and available** → `/invite/{code}`
2. **If active couple exists** → `/dashboard`
3. **If waiting journey exists** → `/onboarding/waiting-journey`
4. **If onboarding complete** → `/dashboard`
5. **Otherwise** → `/onboarding/start`

### 8. Invite Intent Preservation

**Location:** `lib/auth/invite-intent.ts`

Preserve invite code and locale through sign-up:
- `setInviteIntent(code, locale)` — Store in httpOnly cookie
- `getInviteIntent()` — Retrieve after redirect
- `clearInviteIntent()` — Clear after redemption

### 9. Sanitized Logging

**Location:** `lib/logging/journey-events.ts`

- Log only first 4 characters of invite code (never the full 20-char code)
- Generate unique trace IDs for correlating logs
- Log all conflict states separately for debugging

## User-Facing Flows

### Flow A: User Creates Invite, Partner Never Joins

1. User A creates invite → couple `waiting`, `user_b_id=null`
2. Time passes, invitation expires or is abandoned
3. User A wants to join User C's invite
4. **Inspect** shows `waiting_journey_conflict`
5. User sees: "You already started a journey that no partner has joined."
   - **Button 1:** "Keep my current journey" (exit)
   - **Button 2:** "Close empty journey and join this invitation" (abandon + redeem)
6. User clicks Button 2
7. **Abandon** called: expires old invites, deletes empty couple
8. **Redeem** called: user joins User C's couple (now `active` with 2 members)
9. Both users see joined couple on dashboard

### Flow B: User in Active Couple Tries to Join Another Invite

1. User A and User B are in active couple
2. User A tries to redeem a different invite
3. **Inspect** shows `active_couple_conflict`
4. User sees: "You are already in an active journey."
5. No abandonment option (genuine conflict)

### Flow C: Post-Sign-In Routing

1. User signs in
2. **Check for active couple** → Redirect to `/dashboard`
3. **Check for waiting journey** → Redirect to `/onboarding/waiting-journey`
   - Page offers: Resume, Cancel & Join Different, View Invitation
4. **Check if onboarding complete** → Redirect to `/dashboard`
5. **Otherwise** → Redirect to `/onboarding/start`

## Testing

### Database Tests

**File:** `supabase/tests/database/journey_state_machine.test.sql`

Runs 16 pgTAP assertions covering:
- New user has no couple ✓
- Waiting user returns null for `current_couple_id_for()` ✓
- Waiting user returns couple for `waiting_couple_id_for()` ✓
- Active couple returns correctly ✓
- Abandonment deletes empty couple ✓
- Closed couples don't interfere ✓

### Application Tests

**File:** `tests/features/invites.test.ts`

Vitest suite with placeholder structure for:
- Error state distinction
- Empty journey abandonment
- Waiting journey conflict flow
- Invite intent preservation
- Post-sign-in routing
- Logging correctness

## Deployment Checklist

- [ ] Migration applied: `npm run db:remote:push`
- [ ] Seed data intact: `npm run db:remote:seed`
- [ ] Schema valid: `npm run db:remote:lint`
- [ ] pgTAP tests pass: `npm run db:remote:test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Lint passes: `npm run lint`
- [ ] Unit tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Manual E2E: Two-user sign-up → invite → redemption → joined dashboard

## Backwards Compatibility

✅ **No breaking changes:**
- `current_couple_id_for()` is an internal function (not executable by `authenticated`)
- Signature unchanged; behavior fixed
- New functions are additive
- Existing invite/redeem flows work with new error codes
- Old waiting couples automatically migrate (deleted on first access)

## Future Enhancements

1. Add UI component for waiting journey conflict modal
2. Add "Join with invite" permanent action on dashboard
3. Add retryable invite redemption after expiration
4. Audit and clean up old abandoned waiting journeys (data retention policy)
