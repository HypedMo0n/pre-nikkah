-- Restore per-answer revoke, and stop a share outliving the relationship.
--
-- docs/product/alpha-scope.md fixes three properties of the answer-privacy
-- model as not revisable without an explicit product decision: per-answer
-- reveal/revoke, never_compare, and sensitivity-based visibility. The v3
-- rewrite dropped all three. The decision taken was to restore revoke and to
-- record the other two as deliberately superseded, because revoke is the one
-- carrying user-safety weight: without it a person who shares an answer about
-- finances, family or faith and then thinks better of it has no way back short
-- of deleting their account.
--
-- Two things are needed for revoke to actually mean anything.

-- 1. The revoke itself.
--
-- Deliberately not guarded by space status or by membership. share_answer()
-- refuses while paused, and that asymmetry is the point: pausing, closing or
-- being unlinked must never be able to trap a disclosure in the partner's
-- view. Withdrawing consent is always allowed; only granting it is gated.
create or replace function public.revoke_answer(p_answer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_answer public.answers%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  -- Locked so a concurrent share_answer() cannot read the answer, have this
  -- revoke delete every share, and then insert its own share afterwards,
  -- leaving the answer shared after the owner asked for it not to be.
  select answer.* into v_answer
  from public.answers answer
  where answer.id = p_answer_id and answer.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ANSWER_NOT_OWNED';
  end if;

  delete from public.answer_shares where answer_id = p_answer_id;
end;
$$;

-- share_answer() takes the same lock, so the two order against each other
-- rather than interleaving. Answer first, then space, matching every other
-- function that touches both.
create or replace function public.share_answer(p_answer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_answer public.answers%rowtype;
  v_partner_id uuid;
begin
  select answer.* into v_answer
  from public.answers answer
  where answer.id = p_answer_id and answer.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ANSWER_NOT_OWNED';
  end if;
  if not exists (
    select 1
    from public.spaces space
    where space.id = v_answer.space_id
      and space.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;

  select member.user_id into v_partner_id
  from public.space_members member
  where member.space_id = v_answer.space_id
    and member.user_id <> v_user_id
    and member.ended_at is null
  limit 1;
  if v_partner_id is null then
    raise exception using errcode = 'P0001', message = 'PARTNER_REQUIRED';
  end if;

  insert into public.answer_shares (answer_id, shared_with_user_id)
  values (p_answer_id, v_partner_id)
  on conflict do nothing;

  if not exists (
    select 1 from public.space_events event
    where event.space_id = v_answer.space_id
      and event.kind = 'answer_shared'
      and event.payload_json ->> 'question_id' = v_answer.question_id::text
      and event.actor_id = v_user_id
  ) then
    insert into public.space_events (space_id, actor_id, kind, payload_json)
    values (
      v_answer.space_id,
      v_user_id,
      'answer_shared',
      jsonb_build_object('question_id', v_answer.question_id)
    );
  end if;
end;
$$;

-- 2. A share must not outlive the relationship.
--
-- close_space() ends memberships and marks the space closed; it deletes no
-- answer_shares rows. Authorizing on the share alone therefore let a former
-- partner keep reading every answer ever shared with them, indefinitely, with
-- no way for the author to notice or intervene. This is the same defect that
-- get_revealed_disclosures() carries a membership check for, and answers had
-- gone without one. Revoke would otherwise be the only remedy for a state the
-- author never agreed to.
create or replace function public.can_current_user_read_answer(p_answer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.answers answer
    where answer.id = p_answer_id
      and (
        answer.user_id = auth.uid()
        or (
          public.is_current_space_member(answer.space_id)
          and exists (
            select 1
            from public.answer_shares share
            where share.answer_id = answer.id
              and share.shared_with_user_id = auth.uid()
          )
        )
      )
  );
$$;

revoke all on function public.revoke_answer(uuid) from public, anon, authenticated;
grant execute on function public.revoke_answer(uuid) to authenticated;
