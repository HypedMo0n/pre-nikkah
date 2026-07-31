-- Two review findings on the disclosure engine.
--
-- save_disclosure_attestation() accepted a whitespace-only body. The table
-- constraint only requires one character, so ' ' was stored, counted as an
-- attested required category by get_disclosure_overview(), and revealed as
-- blank content. The body is now trimmed and an empty result rejected.
--
-- reveal_disclosure_attestation() checked spaces.status without locking the
-- row, so a concurrent set_space_paused() could commit between the check and
-- the insert, leaving the content revealed into a paused space. The status is
-- now read `for update`, which orders the two operations against each other.

create or replace function public.save_disclosure_attestation(
  p_category_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid := public.current_space_id();
  v_id uuid;
  v_existing public.disclosure_attestations%rowtype;
  v_body text := trim(coalesce(p_body, ''));
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_space_id is null then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;
  -- char_length(body) >= 1 accepts a single space, which would count the
  -- category as attested in get_disclosure_overview() while disclosing nothing.
  if v_body = '' then
    raise exception using errcode = 'P0001', message = 'DISCLOSURE_BODY_REQUIRED';
  end if;
  if not exists (
    select 1 from public.disclosure_categories category
    where category.id = p_category_id and category.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'CATEGORY_NOT_FOUND';
  end if;

  -- Locked because reveal_disclosure_attestation() locks the same row. Without
  -- it, a reveal could read the pre-edit row, this edit could then update the
  -- body and delete the reveals, and the reveal could still insert afterwards,
  -- publishing the revised fact without a confirmation for that revision.
  select * into v_existing
  from public.disclosure_attestations
  where space_id = v_space_id
    and category_id = p_category_id
    and user_id = v_user_id
  for update;

  if not found then
    insert into public.disclosure_attestations (
      space_id, category_id, user_id, body
    )
    values (v_space_id, p_category_id, v_user_id, v_body)
    returning id into v_id;
    return v_id;
  end if;

  -- Editing the body after a reveal would otherwise push the new text to the
  -- partner through get_revealed_disclosures() without a second confirmation,
  -- since the reveal keys on the attestation rather than on its content. Any
  -- change to the fact retracts every reveal of it, so the revised version has
  -- to be revealed explicitly, exactly like the first one.
  if v_existing.body is distinct from v_body then
    update public.disclosure_attestations
    set body = v_body,
        updated_at = now()
    where id = v_existing.id;

    delete from public.disclosure_reveals
    where attestation_id = v_existing.id;
  end if;

  return v_existing.id;
end;
$$;
create or replace function public.reveal_disclosure_attestation(
  p_attestation_id uuid,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attestation public.disclosure_attestations%rowtype;
  v_partner_id uuid;
  v_space_status text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_confirmation is distinct from 'CONFIRM_DISCLOSURE_REVEAL' then
    raise exception using errcode = 'P0001', message = 'REVEAL_NOT_CONFIRMED';
  end if;

  -- Locked for the same reason save_disclosure_attestation() locks: the two
  -- must not interleave, or a reveal can attach to a body that was edited
  -- after this row was read.
  select * into v_attestation
  from public.disclosure_attestations
  where id = p_attestation_id and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ATTESTATION_NOT_FOUND';
  end if;

  -- Pausing leaves memberships open and only changes spaces.status, so a
  -- membership check alone would let a paused journey keep disclosing. This
  -- mirrors share_answer(), which refuses to share an answer while paused;
  -- an attestation is more sensitive, not less.
  -- Locked, not merely read: set_space_paused() updates this row, so an
  -- unlocked check could observe 'active', the pause could commit, and the
  -- reveal would still insert afterwards and publish the content into a space
  -- that is by then paused.
  select space.status into v_space_status
  from public.spaces space
  where space.id = v_attestation.space_id
  for update;

  if v_space_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;

  select member.user_id into v_partner_id
  from public.space_members member
  where member.space_id = v_attestation.space_id
    and member.user_id <> v_user_id
    and member.ended_at is null
  limit 1;

  if v_partner_id is null then
    raise exception using errcode = 'P0001', message = 'PARTNER_REQUIRED';
  end if;

  insert into public.disclosure_reveals (attestation_id, revealed_to_user_id)
  values (p_attestation_id, v_partner_id)
  on conflict do nothing;
end;
$$;