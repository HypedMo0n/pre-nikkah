-- Gap found while building the /invite screen: create_space_invite()
-- conflated "ensure I have a space" with "mint a fresh invite code" into
-- one call. A page load (a GET, no explicit user action) should never
-- have a minting side effect — space_invites only ever stores a hash, so
-- every mint invalidates whatever code the user may have already shared,
-- and a page that re-minted on every visit/refresh would silently break a
-- code already in the partner's hands. get_or_create_current_space()
-- separates "the space exists" (safe to ensure on every page load) from
-- "a fresh code was minted" (only an explicit action, e.g. a "Create a new
-- invitation" button, should do that). create_space_invite() now calls it
-- instead of duplicating its own space-creation block.
create or replace function public.get_or_create_current_space()
returns uuid
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

  perform 1 from public.profiles profile where profile.id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_REQUIRED';
  end if;

  select space.id into v_space_id
  from public.spaces space
  where space.id = public.current_space_id();

  if v_space_id is not null then
    return v_space_id;
  end if;

  insert into public.spaces (created_by, status)
  values (v_user_id, 'waiting')
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, v_user_id, 'a');

  return v_space_id;
end;
$$;

revoke all on function public.get_or_create_current_space()
  from public, anon, authenticated;
grant execute on function public.get_or_create_current_space() to authenticated;

create or replace function public.create_space_invite()
returns table (
  invite_id uuid,
  space_id uuid,
  invite_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space public.spaces%rowtype;
  v_space_id uuid;
  v_invite_id uuid;
  v_code text;
  v_code_hash text;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  v_space_id := public.get_or_create_current_space();

  select space.* into v_space
  from public.spaces space
  where space.id = v_space_id
  for update;

  if v_space.status <> 'waiting' then
    raise exception using errcode = 'P0001', message = 'ACTIVE_SPACE_CONFLICT';
  end if;

  update public.space_invites invitation
  set expires_at = least(invitation.expires_at, now())
  where invitation.space_id = v_space_id
    and invitation.redeemed_at is null
    and invitation.expires_at > now();

  loop
    v_code := encode(extensions.gen_random_bytes(10), 'hex');
    v_code_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');
    exit when not exists (
      select 1 from public.space_invites invitation
      where invitation.code_hash = v_code_hash
    );
  end loop;

  insert into public.space_invites (space_id, code_hash, expires_at, created_by)
  values (v_space_id, v_code_hash, v_expires_at, v_user_id)
  returning id into v_invite_id;

  return query select v_invite_id, v_space_id, v_code, v_expires_at;
end;
$$;

revoke all on function public.create_space_invite() from public, anon, authenticated;
grant execute on function public.create_space_invite() to authenticated;
