-- v3 rewrite. Adapts the account/couple/membership/invite design from the
-- pre-v3 schema (proven: hashed opaque codes, transactional redemption,
-- one-current-membership-per-user enforced by a partial unique index,
-- SECURITY DEFINER-only writes, zero client policies on membership/invite
-- tables) onto v3's profiles/spaces/space_members naming.
--
-- Deliberate deviation from the v3 prompt's literal §4 schema: that section
-- puts a single static `invite_code` column directly on `spaces`. Section
-- §7.4 (screens) requires "Revoke invitation" and "Create a new invitation"
-- actions, which a single static code cannot support — revoking or
-- regenerating a code that IS the space's identity would either break the
-- space or require inventing separate semantics anyway. `space_invites` is
-- kept as its own hashed, expiring, revocable table (superset of the
-- single-column design) so the actual specified screens work as described.
--
-- Also drops the pre-v3 journey-deletion policy acceptance gate entirely.
-- The v3 prompt's onboarding screens (§7.3, §7.4) have no consent-checkbox
-- step, so a space activates as soon as a second member joins — no
-- version-gated acceptance table.

create extension if not exists pgcrypto with schema extensions;

revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- profiles ---------------------------------------------------------------
-- locale is intentionally NOT a fixed check-constraint enum. The v3 prompt
-- requires "no two-language assumptions in routing, state, or UI" — a
-- length check lets the supported-locale list grow at the application
-- layer without a migration.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text null check (
    display_name is null or char_length(display_name) between 1 and 80
  ),
  locale text not null default 'en' check (char_length(locale) between 2 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, locale) on table public.profiles to authenticated;

create policy "profile owner can read"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "profile owner can update"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
  v_locale text;
begin
  v_display_name := nullif(
    left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80),
    ''
  );
  v_locale := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'locale', '')), 10), '');

  insert into public.profiles (id, display_name, locale)
  values (new.id, v_display_name, coalesce(v_locale, 'en'))
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- spaces -------------------------------------------------------------------
-- 'paused' supports the settings screen's "Pause the space" action (§7.12),
-- which has no equivalent in the pre-v3 schema.
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spaces enable row level security;
revoke all on table public.spaces from public, anon, authenticated;
grant select on table public.spaces to authenticated;

create trigger spaces_set_updated_at
before update on public.spaces
for each row execute function public.set_updated_at();

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('a', 'b')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz null,
  primary key (space_id, user_id),
  unique (space_id, role)
);

create unique index one_current_space_per_user
on public.space_members (user_id)
where ended_at is null;

alter table public.space_members enable row level security;
revoke all on table public.space_members from public, anon, authenticated;

create or replace function public.is_space_member_for(
  p_space_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.space_members membership
    where membership.space_id = p_space_id
      and membership.user_id = p_user_id
      and membership.ended_at is null
  );
$$;

revoke all on function public.is_space_member_for(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.is_current_user_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_space_member_for(p_space_id, auth.uid());
$$;

revoke all on function public.is_current_user_space_member(uuid)
  from public, anon, authenticated;
grant execute on function public.is_current_user_space_member(uuid)
  to authenticated;

create or replace function public.current_space_id_for(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select membership.space_id
  from public.space_members membership
  join public.spaces space on space.id = membership.space_id
  where membership.user_id = p_user_id
    and membership.ended_at is null
    and space.status in ('waiting', 'active', 'paused')
  limit 1;
$$;

revoke all on function public.current_space_id_for(uuid)
  from public, anon, authenticated;

create or replace function public.current_space_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_space_id_for(auth.uid());
$$;

revoke all on function public.current_space_id() from public, anon, authenticated;
grant execute on function public.current_space_id() to authenticated;

create policy "space members can read their space"
on public.spaces
for select
to authenticated
using (public.is_current_user_space_member(id));

-- space_invites --------------------------------------------------------
create table public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  code_hash text unique not null check (char_length(code_hash) = 64),
  expires_at timestamptz not null,
  redeemed_at timestamptz null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  redeemed_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invite_redemption_is_consistent check (
    (redeemed_at is null and redeemed_by is null)
    or (redeemed_at is not null and redeemed_by is not null)
  )
);

create index space_invites_space_id_idx on public.space_invites (space_id);

alter table public.space_invites enable row level security;
revoke all on table public.space_invites from public, anon, authenticated;

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

  perform 1 from public.profiles profile where profile.id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PROFILE_REQUIRED';
  end if;

  select space.* into v_space
  from public.spaces space
  where space.id = public.current_space_id()
  for update;

  if found then
    if v_space.status <> 'waiting' then
      raise exception using errcode = 'P0001', message = 'ACTIVE_SPACE_CONFLICT';
    end if;
    v_space_id := v_space.id;
  else
    insert into public.spaces (created_by, status)
    values (v_user_id, 'waiting')
    returning id into v_space_id;

    insert into public.space_members (space_id, user_id, role)
    values (v_space_id, v_user_id, 'a');
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

create or replace function public.redeem_space_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_code text := regexp_replace(
    lower(trim(coalesce(p_invite_code, ''))), '[^0-9a-f]', '', 'g'
  );
  v_code_hash text;
  v_invite public.space_invites%rowtype;
  v_space public.spaces%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(v_normalized_code) <> 20 then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;

  v_code_hash := encode(extensions.digest(v_normalized_code, 'sha256'), 'hex');

  select invitation.* into v_invite
  from public.space_invites invitation
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

  if public.current_space_id() is not null then
    raise exception using errcode = 'P0001', message = 'ACTIVE_SPACE_CONFLICT';
  end if;

  select space.* into v_space
  from public.spaces space
  where space.id = v_invite.space_id
  for update;

  if not found or v_space.status <> 'waiting' then
    raise exception using errcode = 'P0001', message = 'INVITE_ALREADY_USED';
  end if;

  begin
    insert into public.space_members (space_id, user_id, role)
    values (v_space.id, v_user_id, 'b');
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'ACTIVE_SPACE_CONFLICT';
  end;

  update public.spaces set status = 'active' where id = v_space.id;
  update public.space_invites
  set redeemed_at = now(), redeemed_by = v_user_id
  where id = v_invite.id;

  return v_space.id;
end;
$$;

revoke all on function public.redeem_space_invite(text) from public, anon, authenticated;
grant execute on function public.redeem_space_invite(text) to authenticated;

create or replace function public.inspect_space_invite(p_invite_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_code text := regexp_replace(
    lower(trim(coalesce(p_invite_code, ''))), '[^0-9a-f]', '', 'g'
  );
  v_invite public.space_invites%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if char_length(v_normalized_code) <> 20 then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select invitation.* into v_invite
  from public.space_invites invitation
  join public.spaces space on space.id = invitation.space_id
  where invitation.code_hash = encode(
      extensions.digest(v_normalized_code, 'sha256'), 'hex'
    )
    and invitation.redeemed_at is null
    and invitation.expires_at > now()
    and space.status = 'waiting';

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;

  if v_invite.created_by = v_user_id then
    return jsonb_build_object('status', 'self_invite');
  end if;

  if public.current_space_id() is not null then
    return jsonb_build_object('status', 'active_space_conflict');
  end if;

  return jsonb_build_object('status', 'available', 'expiresAt', v_invite.expires_at);
end;
$$;

revoke all on function public.inspect_space_invite(text) from public, anon, authenticated;
grant execute on function public.inspect_space_invite(text) to authenticated;

create or replace function public.revoke_space_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  update public.space_invites invitation
  set expires_at = least(invitation.expires_at, now())
  from public.spaces space
  where invitation.id = p_invite_id
    and space.id = invitation.space_id
    and invitation.created_by = v_user_id
    and invitation.redeemed_at is null
    and space.status = 'waiting';

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITE_UNAVAILABLE';
  end if;
end;
$$;

revoke all on function public.revoke_space_invite(uuid) from public, anon, authenticated;
grant execute on function public.revoke_space_invite(uuid) to authenticated;
