-- Fix current_couple_id_for() to only return ACTIVE journeys with both members
-- Previously: returned both 'waiting' and 'active' statuses, conflating abandoned
-- empty journeys with genuine active two-person journeys.
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
    and couple.status = 'active'
  limit 1;
$$;

revoke all on function public.current_couple_id_for(uuid)
  from public, anon, authenticated;

-- New function: get waiting journey for user (creator only)
-- Returns the empty 'waiting' couple if user is user_a and no user_b has joined.
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

revoke all on function public.waiting_couple_id_for(uuid)
  from public, anon, authenticated;

-- New function: safely abandon empty waiting journey
-- Allows the creator of a waiting journey (user_a with no user_b) to:
-- - Expire all outstanding invites
-- - End their membership
-- - Delete policy acceptances
-- - Close and delete the empty couple
--
-- Raises:
--   AUTH_REQUIRED if not authenticated
--   NO_EMPTY_JOURNEY_TO_ABANDON if user has no empty waiting journey
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

  -- Lock the couple row for exclusive access during cleanup
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

  -- Expire all outstanding unredeemed invites for this couple
  update public.couple_invites
  set expires_at = least(expires_at, now())
  where couple_id = v_couple_id
    and redeemed_at is null;

  -- End the creator's membership
  update public.couple_memberships
  set ended_at = now()
  where couple_id = v_couple_id
    and user_id = v_user_id;

  -- Delete policy acceptances for this empty journey
  delete from public.journey_policy_acceptances
  where couple_id = v_couple_id
    and user_id = v_user_id;

  -- Mark couple as closed, then delete (cascades to all couple_invites)
  update public.couples
  set status = 'closed'
  where id = v_couple_id;

  delete from public.couples
  where id = v_couple_id;
end;
$$;

revoke all on function public.abandon_empty_waiting_journey()
  from public, anon, authenticated;
grant execute on function public.abandon_empty_waiting_journey() to authenticated;

-- Update inspect_couple_invite() to distinguish waiting vs. active conflicts
-- Returns:
--   { status: 'available', expiresAt: <timestamp> } if invite is valid
--   { status: 'unavailable' } if invite not found, expired, or already redeemed
--   { status: 'self_invite' } if invite was created by the current user
--   { status: 'active_couple_conflict' } if user is in an active two-person journey
--   { status: 'waiting_journey_conflict' } if user has an empty waiting journey
create or replace function public.inspect_couple_invite(p_invite_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_code text := regexp_replace(
    lower(trim(coalesce(p_invite_code, ''))),
    '[^0-9a-f]',
    '',
    'g'
  );
  v_invite public.couple_invites%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(v_normalized_code) <> 20 then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- Check if invite exists, is unredeemed, unexpired, and couple is waiting
  select invitation.*
  into v_invite
  from public.couple_invites invitation
  join public.couples couple on couple.id = invitation.couple_id
  where invitation.code_hash = encode(
      extensions.digest(v_normalized_code, 'sha256'),
      'hex'
    )
    and invitation.redeemed_at is null
    and invitation.expires_at > now()
    and couple.status = 'waiting'
    and couple.user_b_id is null;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- User cannot redeem their own invite
  if v_invite.created_by = v_user_id then
    return jsonb_build_object('status', 'self_invite');
  end if;

  -- Check for active journey (both members present)
  if public.current_couple_id() is not null then
    return jsonb_build_object('status', 'active_couple_conflict');
  end if;

  -- Check for waiting journey (only user_a, no partner yet)
  -- User must abandon this before joining another invite
  if public.waiting_couple_id_for(v_user_id) is not null then
    return jsonb_build_object('status', 'waiting_journey_conflict');
  end if;

  return jsonb_build_object(
    'status', 'available',
    'expiresAt', v_invite.expires_at
  );
end;
$$;

revoke all on function public.inspect_couple_invite(text)
  from public, anon, authenticated;
grant execute on function public.inspect_couple_invite(text) to authenticated;

-- Update redeem_couple_invite() to handle waiting journey migration
-- Distinguishes:
--   WAITING_JOURNEY_CONFLICT: user must abandon their empty waiting journey first
--   ACTIVE_COUPLE_CONFLICT: user is in an active two-person journey (cannot redeem)
--   INVITE_EXPIRED: invite has expired
--   INVITE_ALREADY_REDEEMED: invite has been redeemed
--   SELF_INVITE: user cannot redeem their own invite
--   INVITE_INVALID: code is invalid or couple state invalid
--   JOURNEY_POLICY_VERSION_INVALID: policy version mismatch
--   AUTH_REQUIRED: not authenticated
create or replace function public.redeem_couple_invite(
  p_invite_code text,
  p_policy_version text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_code text := regexp_replace(
    lower(trim(coalesce(p_invite_code, ''))),
    '[^0-9a-f]',
    '',
    'g'
  );
  v_code_hash text;
  v_invite public.couple_invites%rowtype;
  v_couple public.couples%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_policy_version is distinct from public.current_journey_policy_version() then
    raise exception using errcode = 'P0001', message = 'JOURNEY_POLICY_VERSION_INVALID';
  end if;

  if char_length(v_normalized_code) <> 20 then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;

  v_code_hash := encode(
    extensions.digest(v_normalized_code, 'sha256'),
    'hex'
  );

  select invitation.*
  into v_invite
  from public.couple_invites invitation
  where invitation.code_hash = v_code_hash
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;

  -- Check redemption state before expiration to distinguish errors
  if v_invite.redeemed_at is not null then
    raise exception using errcode = 'P0001', message = 'INVITE_ALREADY_REDEEMED';
  end if;

  if v_invite.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'INVITE_EXPIRED';
  end if;

  if v_invite.created_by = v_user_id then
    raise exception using errcode = 'P0001', message = 'SELF_INVITE';
  end if;

  -- Check for active journey (genuine two-person journey in progress)
  if public.current_couple_id() is not null then
    raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_CONFLICT';
  end if;

  -- Check for waiting journey (empty journey needing abandonment)
  if public.waiting_couple_id_for(v_user_id) is not null then
    raise exception using errcode = 'P0001', message = 'WAITING_JOURNEY_CONFLICT';
  end if;

  -- Lock the couple and verify it is still in valid state
  select couple.*
  into v_couple
  from public.couples couple
  where couple.id = v_invite.couple_id
  for update;

  if not found
    or v_couple.status <> 'waiting'
    or v_couple.user_b_id is not null then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;

  -- Insert user_b membership
  begin
    insert into public.couple_memberships (couple_id, user_id, member_role)
    values (v_couple.id, v_user_id, 'b');
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_CONFLICT';
  end;

  -- Record policy acceptance for user_b
  insert into public.journey_policy_acceptances (
    couple_id,
    user_id,
    policy_version
  )
  values (
    v_couple.id,
    v_user_id,
    p_policy_version
  );

  -- Activate the couple (both members now present)
  update public.couples
  set user_b_id = v_user_id,
      status = 'active'
  where id = v_couple.id;

  -- Mark invite as redeemed
  update public.couple_invites
  set redeemed_at = now(),
      redeemed_by = v_user_id
  where id = v_invite.id;

  return v_couple.id;
end;
$$;

revoke all on function public.redeem_couple_invite(text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_couple_invite(text, text) to authenticated;
