-- v3 rewrite: The Path (§7.10) needs mine/partner/total/discussed counts
-- for all twelve topics on every Home render. Looping get_topic_progress()
-- twelve times per load works but is wasteful; this is the same
-- counts-only aggregate, computed once for every active topic in a single
-- call.
create or replace function public.get_all_topic_progress()
returns table (topic_id uuid, mine integer, partner integer, total integer, discussed integer)
language plpgsql
stable
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

  return query
  select
    topic.id,
    (
      select count(*)::integer from public.answers answer
      where answer.space_id = v_space_id
        and answer.user_id = v_user_id
        and answer.question_id in (
          select question.id from public.questions question
          where question.topic_id = topic.id and question.is_active
        )
    ),
    coalesce((
      select count(*)::integer from public.answers answer
      where answer.space_id = v_space_id
        and answer.user_id = v_partner_id
        and answer.question_id in (
          select question.id from public.questions question
          where question.topic_id = topic.id and question.is_active
        )
    ), 0),
    (
      select count(*)::integer from public.questions question
      where question.topic_id = topic.id and question.is_active
    ),
    (
      select count(*)::integer from public.discussions discussion
      where discussion.space_id = v_space_id
        and discussion.question_id in (
          select question.id from public.questions question
          where question.topic_id = topic.id and question.is_active
        )
    )
  from public.topics topic
  where topic.is_active
  order by topic.order_index;
end;
$$;

revoke all on function public.get_all_topic_progress() from public, anon, authenticated;
grant execute on function public.get_all_topic_progress() to authenticated;
