create or replace function public.abandon_empty_waiting_journey()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select couple.id
  into v_couple_id
  from public.couples couple
  join public.couple_memberships membership on membership.couple_id = couple.id
  where membership.user_id = v_user_id
    and couple.status = 'waiting'
    and couple.user_a_id = v_user_id
    and couple.user_b_id is null
    and not exists (select 1 from public.answers answer where answer.couple_id = couple.id)
    and not exists (select 1 from public.topic_progress progress where progress.couple_id = couple.id)
    and not exists (select 1 from public.guided_discussions discussion where discussion.couple_id = couple.id)
    and not exists (select 1 from public.couple_checklist_items item where item.couple_id = couple.id)
    and not exists (select 1 from public.couple_invites invite where invite.couple_id = couple.id and invite.redeemed_at is not null)
  limit 1;

  if v_couple_id is null then
    raise exception 'No empty waiting journey is available to abandon' using errcode = 'P0001';
  end if;

  delete from public.couples where id = v_couple_id;
end;
$$;

revoke all on function public.abandon_empty_waiting_journey() from public, anon, authenticated;
grant execute on function public.abandon_empty_waiting_journey() to authenticated;
