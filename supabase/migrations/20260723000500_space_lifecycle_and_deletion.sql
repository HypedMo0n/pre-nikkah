-- v3 rewrite: settings-screen space lifecycle (§7.12 "Pause the space",
-- "Unlink partner") and account deletion, adapted from the pre-v3
-- close_couple_journey()/prepare_account_deletion() pattern.
--
-- Interpretation worth flagging: the v3 prompt lists "Pause the space" and
-- "Unlink partner" as two distinct settings actions but does not define
-- their data-retention semantics. This migration treats "pause" as the
-- soft, reversible action (status flips to 'paused' and back; nothing is
-- deleted) and "unlink" as the hard, destructive one — closing the space
-- and ending both memberships, mirroring the pre-v3 app's only closure
-- action. That is a judgment call, not a literal spec requirement, and
-- should be confirmed when the settings screen itself is built.

create or replace function public.pause_space()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  v_space_id := public.current_space_id();
  if v_space_id is null then
    raise exception using errcode = 'P0001', message = 'ACTIVE_SPACE_REQUIRED';
  end if;

  update public.spaces
  set status = 'paused'
  where id = v_space_id and status = 'active';
end;
$$;

revoke all on function public.pause_space() from public, anon, authenticated;
grant execute on function public.pause_space() to authenticated;

create or replace function public.resume_space()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  v_space_id := public.current_space_id();
  if v_space_id is null then
    raise exception using errcode = 'P0001', message = 'ACTIVE_SPACE_REQUIRED';
  end if;

  update public.spaces
  set status = 'active'
  where id = v_space_id and status = 'paused';
end;
$$;

revoke all on function public.resume_space() from public, anon, authenticated;
grant execute on function public.resume_space() to authenticated;

create or replace function public.unlink_partner()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid;
  v_partner_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  v_space_id := public.current_space_id();
  if v_space_id is null then
    raise exception using errcode = 'P0001', message = 'ACTIVE_SPACE_REQUIRED';
  end if;

  select membership.user_id into v_partner_id
  from public.space_members membership
  where membership.space_id = v_space_id
    and membership.user_id <> v_user_id
    and membership.ended_at is null;

  update public.space_members
  set ended_at = now()
  where space_id = v_space_id and ended_at is null;

  update public.spaces
  set status = 'closed'
  where id = v_space_id;

  if v_partner_id is not null then
    insert into public.space_events (space_id, actor_id, kind, payload_json)
    values (v_space_id, v_user_id, 'space_closed', '{}'::jsonb);
  end if;

  -- The space row owns every space-scoped record through cascading keys
  -- (answers, answer_shares, comparisons, discussions, shared_notes,
  -- space_events, space_invites, space_members).
  delete from public.spaces where id = v_space_id;
end;
$$;

revoke all on function public.unlink_partner() from public, anon, authenticated;
grant execute on function public.unlink_partner() to authenticated;

-- Account deletion --------------------------------------------------------
create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space record;
  v_partner_id uuid;
begin
  if p_user_id is null then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ID_REQUIRED';
  end if;

  for v_space in
    select space.id
    from public.spaces space
    join public.space_members membership
      on membership.space_id = space.id and membership.user_id = p_user_id
    where membership.ended_at is null
  loop
    select membership.user_id into v_partner_id
    from public.space_members membership
    where membership.space_id = v_space.id
      and membership.user_id <> p_user_id
      and membership.ended_at is null;

    update public.space_members
    set ended_at = now()
    where space_id = v_space.id and ended_at is null;

    update public.spaces set status = 'closed' where id = v_space.id;

    if v_partner_id is not null then
      insert into public.space_events (space_id, actor_id, kind, payload_json)
      values (v_space.id, p_user_id, 'space_closed', '{}'::jsonb);
    end if;

    -- Deleting the space removes both users' space-scoped content,
    -- including the remaining partner's answers for that closed space.
    delete from public.spaces where id = v_space.id;
  end loop;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
