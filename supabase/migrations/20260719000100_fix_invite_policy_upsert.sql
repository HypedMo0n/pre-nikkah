-- Replace the invite creator without an ambiguous ON CONFLICT target. The
-- function returns a `couple_id` output column, so an unqualified conflict
-- target with the same name can be interpreted as either a PL/pgSQL variable
-- or a table column by PostgreSQL's function checker.
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
  on conflict do nothing;

  update public.journey_policy_acceptances acceptance
  set accepted_at = now()
  where acceptance.couple_id = v_couple_id
    and acceptance.user_id = v_user_id
    and acceptance.policy_version = p_policy_version;

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
