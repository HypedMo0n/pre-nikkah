-- Acquire the disclosure locks in one consistent order.
--
-- 20260725000600 added the space lock to save_disclosure_attestation() at the
-- top of the function, but reveal_disclosure_attestation() locks the
-- attestation first and the space second. A save and a reveal of the same
-- attestation could therefore each hold one row while waiting for the other,
-- and Postgres would break the cycle by aborting one of them.
--
-- Both functions now take the attestation first and the space second. Any
-- future function touching both rows must use that order too.

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
  v_has_existing boolean;
  v_body text := trim(coalesce(p_body, ''));
  v_space_status text;
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

  -- Captured immediately: FOUND is rewritten by the next SELECT INTO, and the
  -- space lock below sits between this lookup and the branch that uses it.
  v_has_existing := found;

  -- Second, and only ever second: reveal_disclosure_attestation() locks the
  -- attestation before the space, so this function must do the same. Reversing
  -- the two here let a concurrent save and reveal deadlock.
  -- Pausing stops answer saves, so it stops disclosure saves too, otherwise a
  -- paused member could still move the partner-visible partnerAttested count.
  -- 'waiting' is allowed, matching save_answer: a person may record their own
  -- facts before a partner has joined.
  select space.status into v_space_status
  from public.spaces space
  where space.id = v_space_id
  for update;

  if v_space_status is null or v_space_status not in ('waiting', 'active') then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;

  if not v_has_existing then
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