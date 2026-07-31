-- Enforce alpha-scope item (d) at the data layer.
--
-- The presentation layer already collapses per-topic partner state outside the
-- couple's current shared topic, but two API paths returned it anyway to any
-- authenticated member calling Supabase directly:
--
--   1. get_topic_progress(space, topic) is SECURITY DEFINER, executable by
--      `authenticated`, and returned each member's exact answered_count for any
--      topic in the caller's space. Looping it over every topic recovered
--      precisely the signal the screens hide.
--   2. A non-pending comparisons row exists only once both partners have
--      answered a question, and the table was readable by any current member
--      for every topic, so counting rows per topic recovered the same thing.
--
-- The rule enforced here matches the one the UI applies: partner-derived state
-- is visible for the current shared topic, and for topics the couple has
-- already discussed together, which is mutual knowledge. Everywhere else it is
-- withheld, so learning that a partner has not started a specific sensitive
-- topic is not possible through the API either.

-- A topic counts as discussed once every one of its questions has been
-- marked discussed in this space. Mirrors the `discussed` stage in
-- features/v3/progress.ts.
create or replace function public.is_topic_discussed(
  p_space_id uuid,
  p_topic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.questions question
    where question.topic_id = p_topic_id
  )
  and not exists (
    select 1
    from public.questions question
    where question.topic_id = p_topic_id
      and not exists (
        select 1
        from public.discussions discussion
        where discussion.space_id = p_space_id
          and discussion.question_id = question.id
      )
  );
$$;

-- The couple's current shared topic: the first they have not finished
-- together. Single definition, mirroring getCurrentTopicId in
-- features/v3/progress.ts, so the rule cannot drift between the API and the UI.
create or replace function public.current_topic_id(p_space_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select topic.id
  from public.topics topic
  where not public.is_topic_discussed(p_space_id, topic.id)
  order by topic.order_index
  limit 1;
$$;

-- Whether the caller may see partner-derived state for one topic.
create or replace function public.can_read_topic_partner_state(
  p_space_id uuid,
  p_topic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_current_space_member(p_space_id)
    and (
      p_topic_id = public.current_topic_id(p_space_id)
      or public.is_topic_discussed(p_space_id, p_topic_id)
    );
$$;

-- Returns the caller's own count for every topic, and the other member's count
-- only where the rule above permits it. The caller's own progress is never
-- withheld: the redaction is about the partner, not about the user.
create or replace function public.get_topic_progress(
  p_space_id uuid,
  p_topic_id uuid
)
returns table (
  user_id uuid,
  answered_count bigint,
  question_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_current_space_member(p_space_id) then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;

  return query
  select
    member.user_id,
    count(answer.id),
    (select count(*) from public.questions question
     where question.topic_id = p_topic_id)
  from public.space_members member
  left join public.answers answer
    on answer.space_id = member.space_id
    and answer.user_id = member.user_id
    and answer.question_id in (
      select question.id from public.questions question
      where question.topic_id = p_topic_id
    )
  where member.space_id = p_space_id
    and member.ended_at is null
    and (
      member.user_id = auth.uid()
      or public.can_read_topic_partner_state(p_space_id, p_topic_id)
    )
  group by member.user_id;
end;
$$;

-- A whole-journey total stays permitted: it says the couple is making progress
-- without attributing any of it to a named topic. It exists because narrowing
-- the comparisons policy below would otherwise make the dashboard's count
-- silently under-report.
create or replace function public.get_journey_comparison_count()
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)
  from public.comparisons comparison
  where comparison.space_id = public.current_space_id()
    and comparison.state <> 'pending';
$$;

-- A non-pending comparison discloses that the partner answered that question,
-- so the same topic rule applies to reading the row.
drop policy if exists "current members can read comparisons" on public.comparisons;

create policy "members read comparisons for shared or discussed topics"
on public.comparisons for select to authenticated
using (
  public.can_read_topic_partner_state(
    space_id,
    (select question.topic_id from public.questions question
     where question.id = question_id)
  )
);

revoke all on function public.is_topic_discussed(uuid, uuid),
  public.current_topic_id(uuid),
  public.can_read_topic_partner_state(uuid, uuid),
  public.get_journey_comparison_count()
  from public, anon, authenticated;

grant execute on function public.is_topic_discussed(uuid, uuid),
  public.current_topic_id(uuid),
  public.can_read_topic_partner_state(uuid, uuid),
  public.get_journey_comparison_count()
  to authenticated;
