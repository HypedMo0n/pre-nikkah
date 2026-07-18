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

create table public.private_accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  preferred_locale text not null default 'en'
    check (preferred_locale in ('en', 'fr')),
  private_display_name text null check (
    private_display_name is null
    or char_length(private_display_name) between 1 and 80
  ),
  relationship_stage text null check (
    relationship_stage is null
    or relationship_stage in (
      'getting_to_know_seriously',
      'families_involved',
      'engaged',
      'preparing_for_nikah',
      'other'
    )
  ),
  onboarding_completed boolean not null default false,
  onboarding_step text null check (
    onboarding_step is null or char_length(onboarding_step) between 1 and 80
  ),
  product_intro_completed boolean not null default false,
  privacy_intro_completed boolean not null default false,
  entry_mode text null check (
    entry_mode is null or entry_mode in ('create', 'join')
  ),
  preferred_pace text not null default 'flexible' check (
    preferred_pace in ('gentle', 'steady', 'flexible')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.private_accounts enable row level security;

revoke all on table public.private_accounts from public, anon, authenticated;
grant select on table public.private_accounts to authenticated;
grant update (
  preferred_locale,
  private_display_name,
  relationship_stage,
  onboarding_completed,
  onboarding_step,
  product_intro_completed,
  privacy_intro_completed,
  entry_mode,
  preferred_pace
)
  on table public.private_accounts to authenticated;

create policy "private account owner can read"
on public.private_accounts
for select
to authenticated
using (id = (select auth.uid()));

create policy "private account owner can update"
on public.private_accounts
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create trigger private_accounts_set_updated_at
before update on public.private_accounts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
  v_preferred_locale text;
  v_entry_mode text;
begin
  v_display_name := nullif(
    left(trim(coalesce(new.raw_user_meta_data ->> 'private_display_name', '')), 80),
    ''
  );

  v_preferred_locale := case
    when new.raw_user_meta_data ->> 'preferred_locale' in ('en', 'fr')
      then new.raw_user_meta_data ->> 'preferred_locale'
    else 'en'
  end;

  v_entry_mode := case
    when new.raw_user_meta_data ->> 'entry_mode' in ('create', 'join')
      then new.raw_user_meta_data ->> 'entry_mode'
    else null
  end;

  insert into public.private_accounts (
    id,
    preferred_locale,
    private_display_name,
    entry_mode
  )
  values (new.id, v_preferred_locale, v_display_name, v_entry_mode)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.private_accounts(id) on delete restrict,
  user_b_id uuid null references public.private_accounts(id) on delete restrict,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couple_members_must_differ
    check (user_b_id is null or user_a_id <> user_b_id),
  constraint couple_status_matches_membership
    check (
      (status = 'waiting' and user_b_id is null)
      or (status = 'active' and user_b_id is not null)
      or status = 'closed'
    )
);

alter table public.couples enable row level security;
revoke all on table public.couples from public, anon, authenticated;
grant select on table public.couples to authenticated;

create trigger couples_set_updated_at
before update on public.couples
for each row execute function public.set_updated_at();

create table public.couple_memberships (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.private_accounts(id) on delete cascade,
  member_role text not null check (member_role in ('a', 'b')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz null,
  primary key (couple_id, user_id),
  unique (couple_id, member_role)
);

create unique index one_current_couple_per_user
on public.couple_memberships (user_id)
where ended_at is null;

alter table public.couple_memberships enable row level security;
revoke all on table public.couple_memberships from public, anon, authenticated;

create or replace function public.current_journey_policy_version()
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select '2026-07-18-v1'::text;
$$;

revoke all on function public.current_journey_policy_version()
  from public, anon, authenticated;
grant execute on function public.current_journey_policy_version()
  to authenticated;

create table public.journey_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.private_accounts(id) on delete cascade,
  policy_version text not null check (
    char_length(policy_version) between 1 and 80
  ),
  accepted_at timestamptz not null default now(),
  unique (couple_id, user_id, policy_version)
);

alter table public.journey_policy_acceptances enable row level security;
revoke all on table public.journey_policy_acceptances
  from public, anon, authenticated;

create or replace function public.validate_journey_policy_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.policy_version <> public.current_journey_policy_version() then
    raise exception using errcode = 'P0001', message = 'JOURNEY_POLICY_VERSION_INVALID';
  end if;

  if not exists (
    select 1
    from public.couple_memberships membership
    where membership.couple_id = new.couple_id
      and membership.user_id = new.user_id
      and membership.ended_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'JOURNEY_POLICY_MEMBER_REQUIRED';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_journey_policy_acceptance()
  from public, anon, authenticated;

create trigger journey_policy_acceptances_validate
before insert or update on public.journey_policy_acceptances
for each row execute function public.validate_journey_policy_acceptance();

create or replace function public.validate_couple_activation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acceptance_count integer;
begin
  if new.status = 'active' and (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
    or old.user_b_id is distinct from new.user_b_id
  ) then
    select count(distinct acceptance.user_id)::integer
    into v_acceptance_count
    from public.journey_policy_acceptances acceptance
    where acceptance.couple_id = new.id
      and acceptance.policy_version = public.current_journey_policy_version()
      and acceptance.user_id in (new.user_a_id, new.user_b_id);

    if new.user_b_id is null or v_acceptance_count <> 2 then
      raise exception using errcode = 'P0001', message = 'JOURNEY_POLICY_ACCEPTANCE_REQUIRED';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_couple_activation()
  from public, anon, authenticated;

create trigger couples_validate_activation
before insert or update on public.couples
for each row execute function public.validate_couple_activation();

create or replace function public.is_couple_member_for(
  p_couple_id uuid,
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
    from public.couple_memberships membership
    where membership.couple_id = p_couple_id
      and membership.user_id = p_user_id
  );
$$;

revoke all on function public.is_couple_member_for(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.is_current_user_couple_member(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_couple_member_for(p_couple_id, auth.uid());
$$;

revoke all on function public.is_current_user_couple_member(uuid)
  from public, anon, authenticated;
grant execute on function public.is_current_user_couple_member(uuid)
  to authenticated;

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
    and couple.status in ('waiting', 'active')
  limit 1;
$$;

revoke all on function public.current_couple_id_for(uuid)
  from public, anon, authenticated;

create or replace function public.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_couple_id_for(auth.uid());
$$;

revoke all on function public.current_couple_id()
  from public, anon, authenticated;
grant execute on function public.current_couple_id() to authenticated;

create policy "couple members can read their journey"
on public.couples
for select
to authenticated
using (public.is_current_user_couple_member(id));

create table public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  code_hash text unique not null check (char_length(code_hash) = 64),
  expires_at timestamptz not null,
  redeemed_at timestamptz null,
  created_by uuid not null references public.private_accounts(id) on delete cascade,
  redeemed_by uuid null references public.private_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invite_redemption_is_consistent check (
    (redeemed_at is null and redeemed_by is null)
    or (redeemed_at is not null and redeemed_by is not null)
  )
);

create index couple_invites_couple_id_idx on public.couple_invites (couple_id);

alter table public.couple_invites enable row level security;
revoke all on table public.couple_invites from public, anon, authenticated;

create or replace function public.create_couple_invite(p_policy_version text)
returns table (
  invite_id uuid,
  couple_id uuid,
  invite_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple public.couples%rowtype;
  v_couple_id uuid;
  v_invite_id uuid;
  v_code text;
  v_code_hash text;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  if p_policy_version is distinct from public.current_journey_policy_version() then
    raise exception using errcode = 'P0001', message = 'JOURNEY_POLICY_VERSION_INVALID';
  end if;

  perform 1
  from public.private_accounts account
  where account.id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'PRIVATE_ACCOUNT_REQUIRED';
  end if;

  select couple.*
  into v_couple
  from public.couples couple
  where couple.id = public.current_couple_id()
  for update;

  if found then
    if v_couple.status <> 'waiting'
      or v_couple.user_a_id <> v_user_id
      or v_couple.user_b_id is not null then
      raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_CONFLICT';
    end if;
    v_couple_id := v_couple.id;
  else
    insert into public.couples (user_a_id, status)
    values (v_user_id, 'waiting')
    returning id into v_couple_id;

    insert into public.couple_memberships (couple_id, user_id, member_role)
    values (v_couple_id, v_user_id, 'a');
  end if;

  insert into public.journey_policy_acceptances (
    couple_id,
    user_id,
    policy_version,
    accepted_at
  )
  values (
    v_couple_id,
    v_user_id,
    p_policy_version,
    now()
  )
  on conflict (couple_id, user_id, policy_version)
  do update set accepted_at = excluded.accepted_at;

  update public.couple_invites invitation
  set expires_at = least(invitation.expires_at, now())
  where invitation.couple_id = v_couple_id
    and invitation.redeemed_at is null
    and invitation.expires_at > now();

  loop
    -- Twenty hexadecimal characters provide an 80-bit opaque token that can
    -- also be grouped into a human-readable invite code without storing a
    -- second secret.
    v_code := encode(extensions.gen_random_bytes(10), 'hex');
    v_code_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');
    exit when not exists (
      select 1
      from public.couple_invites invitation
      where invitation.code_hash = v_code_hash
    );
  end loop;

  insert into public.couple_invites (
    couple_id,
    code_hash,
    expires_at,
    created_by
  )
  values (
    v_couple_id,
    v_code_hash,
    v_expires_at,
    v_user_id
  )
  returning id into v_invite_id;

  return query
  select v_invite_id, v_couple_id, v_code, v_expires_at;
end;
$$;

revoke all on function public.create_couple_invite(text)
  from public, anon, authenticated;
grant execute on function public.create_couple_invite(text) to authenticated;

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

  if public.current_couple_id() is not null then
    raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_CONFLICT';
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
  set redeemed_at = now(),
      redeemed_by = v_user_id
  where id = v_invite.id;

  return v_couple.id;
end;
$$;

revoke all on function public.redeem_couple_invite(text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_couple_invite(text, text) to authenticated;

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

  if v_invite.created_by = v_user_id then
    return jsonb_build_object('status', 'self_invite');
  end if;

  if public.current_couple_id() is not null then
    return jsonb_build_object('status', 'active_couple_conflict');
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

create or replace function public.revoke_couple_invite(p_invite_id uuid)
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

  update public.couple_invites invitation
  set expires_at = least(invitation.expires_at, now())
  from public.couples couple
  where invitation.id = p_invite_id
    and couple.id = invitation.couple_id
    and invitation.created_by = v_user_id
    and invitation.redeemed_at is null
    and couple.status = 'waiting'
    and couple.user_a_id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITE_UNAVAILABLE';
  end if;
end;
$$;

revoke all on function public.revoke_couple_invite(uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_couple_invite(uuid) to authenticated;
