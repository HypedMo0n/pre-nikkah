-- Fixes two related issues:
-- 1. inspect_couple_invite collapsed expired / already-used / malformed
--    codes into a single "unavailable" status, producing a misleading
--    generic message even when the real reason was knowable.
-- 2. Both inspect_couple_invite and redeem_couple_invite used
--    current_couple_id(), which matches a user's own "waiting" journey as
--    well as a truly "active" one, mislabeling an empty waiting journey as
--    an active-couple conflict. These are now distinguished explicitly.

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
  v_couple public.couples%rowtype;
  v_own_waiting_couple_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(v_normalized_code) <> 20 then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select invitation.*
  into v_invite
  from public.couple_invites invitation
  where invitation.code_hash = encode(
      extensions.digest(v_normalized_code, 'sha256'),
      'hex'
    );

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_invite.created_by = v_user_id then
    return jsonb_build_object('status', 'self_invite');
  end if;

  if v_invite.redeemed_at is not null then
    return jsonb_build_object('status', 'already_used');
  end if;

  if v_invite.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select couple.*
  into v_couple
  from public.couples couple
  where couple.id = v_invite.couple_id;

  if not found or v_couple.status <> 'waiting' or v_couple.user_b_id is not null then
    return jsonb_build_object('status', 'already_used');
  end if;

  -- Distinguish "already truly connected" from "has their own separate,
  -- empty waiting journey" — these previously shared one conflated status.
  if exists (
    select 1
    from public.couple_memberships membership
    join public.couples own_couple on own_couple.id = membership.couple_id
    where membership.user_id = v_user_id
      and membership.ended_at is null
      and own_couple.status = 'active'
  ) then
    return jsonb_build_object('status', 'active_couple_conflict');
  end if;

  select own_couple.id
  into v_own_waiting_couple_id
  from public.couple_memberships membership
  join public.couples own_couple on own_couple.id = membership.couple_id
  where membership.user_id = v_user_id
    and membership.ended_at is null
    and own_couple.status = 'waiting'
  limit 1;

  if v_own_waiting_couple_id is not null then
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

  if v_invite.redeemed_at is not null then
    raise exception using errcode = 'P0001', message = 'INVITE_ALREADY_USED';
  end if;

  if v_invite.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'INVITE_EXPIRED';
  end if;

  if v_invite.created_by = v_user_id then
    raise exception using errcode = 'P0001', message = 'INVITE_SELF_REDEMPTION';
  end if;

  -- Truly active (already matched with a partner) is a hard block.
  if exists (
    select 1
    from public.couple_memberships membership
    join public.couples own_couple on own_couple.id = membership.couple_id
    where membership.user_id = v_user_id
      and membership.ended_at is null
      and own_couple.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_CONFLICT';
  end if;

  -- Their own separate, empty waiting journey is a distinct, recoverable
  -- case, not the same failure as an active-couple conflict.
  if exists (
    select 1
    from public.couple_memberships membership
    join public.couples own_couple on own_couple.id = membership.couple_id
    where membership.user_id = v_user_id
      and membership.ended_at is null
      and own_couple.status = 'waiting'
  ) then
    raise exception using errcode = 'P0001', message = 'WAITING_JOURNEY_CONFLICT';
  end if;

  select couple.*
  into v_couple
  from public.couples couple
  where couple.id = v_invite.couple_id
  for update;

  if not found
    or v_couple.status <> 'waiting'
    or v_couple.user_b_id is not null then
    raise exception using errcode = 'P0001', message = 'INVITE_ALREADY_USED';
  end if;

  begin
    insert into public.couple_memberships (couple_id, user_id, member_role)
    values (v_couple.id, v_user_id, 'b');
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_CONFLICT';
  end;

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

  update public.couples
  set user_b_id = v_user_id,
      status = 'active'
  where id = v_couple.id;

  update public.couple_invites
  set redeemed_at = now(), redeemed_by = v_user_id
  where id = v_invite.id;

  return v_couple.id;
end;
$$;

revoke all on function public.redeem_couple_invite(text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_couple_invite(text, text) to authenticated;
