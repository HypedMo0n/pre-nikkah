-- Remove the differential aggregate, and stop the comparison-dependent
-- mutations acting as readiness oracles.
--
-- get_journey_comparison_count() was added in 20260725000200 so the dashboard
-- total would not under-report once the comparisons policy narrowed. That was a
-- mistake: it counts across every topic, so a member could read it, answer one
-- chosen question in a hidden topic, and read it again. The total moves if and
-- only if the partner had already answered that question, which reconstructs
-- exactly the question-by-question progress the redaction hides. It is dropped
-- rather than coarsened, and the dashboard counts the comparisons it can
-- actually read. Answering inside a hidden topic then changes nothing the
-- caller can observe.
--
-- mark_question_discussed() and add_shared_note() raise COMPARISON_NOT_READY
-- unless the partner has answered, so calling them was the same oracle by
-- success or failure. Both now fail with that identical error when the topic is
-- not visible, so the two cases cannot be told apart.

drop function if exists public.get_journey_comparison_count();

create or replace function public.mark_question_discussed(
  p_space_id uuid,
  p_question_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_current_space_member(p_space_id) then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.spaces space
    where space.id = p_space_id
      and space.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;
  -- A hidden topic must fail exactly as an unready comparison does, otherwise
  -- success versus failure becomes an oracle for whether the partner has
  -- answered that specific question outside the current shared topic.
  if not public.can_read_topic_partner_state(
    p_space_id,
    (select question.topic_id from public.questions question
     where question.id = p_question_id)
  ) then
    raise exception using errcode = 'P0001', message = 'COMPARISON_NOT_READY';
  end if;

  if not exists (
    select 1
    from public.comparisons comparison
    where comparison.space_id = p_space_id
      and comparison.question_id = p_question_id
      and comparison.state in ('aligned', 'discuss')
  ) then
    raise exception using errcode = 'P0001', message = 'COMPARISON_NOT_READY';
  end if;
  insert into public.discussions (space_id, question_id, discussed_by, discussed_at)
  values (p_space_id, p_question_id, auth.uid(), now())
  on conflict (space_id, question_id) do update set
    discussed_at = excluded.discussed_at,
    discussed_by = excluded.discussed_by;
end;
$$;
create or replace function public.add_shared_note(
  p_space_id uuid,
  p_question_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_note_id uuid;
begin
  if not public.is_current_space_member(p_space_id) then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.spaces space
    where space.id = p_space_id
      and space.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;
  -- A hidden topic must fail exactly as an unready comparison does, otherwise
  -- success versus failure becomes an oracle for whether the partner has
  -- answered that specific question outside the current shared topic.
  if not public.can_read_topic_partner_state(
    p_space_id,
    (select question.topic_id from public.questions question
     where question.id = p_question_id)
  ) then
    raise exception using errcode = 'P0001', message = 'COMPARISON_NOT_READY';
  end if;

  if not exists (
    select 1
    from public.comparisons comparison
    where comparison.space_id = p_space_id
      and comparison.question_id = p_question_id
      and comparison.state in ('aligned', 'discuss')
  ) then
    raise exception using errcode = 'P0001', message = 'COMPARISON_NOT_READY';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception using errcode = 'P0001', message = 'SHARED_NOTE_INVALID';
  end if;

  insert into public.shared_notes (space_id, question_id, author_id, body)
  values (p_space_id, p_question_id, auth.uid(), trim(p_body))
  returning id into v_note_id;

  insert into public.space_events (space_id, actor_id, kind, payload_json)
  values (
    p_space_id,
    auth.uid(),
    'shared_note_added',
    jsonb_build_object('question_id', p_question_id)
  );
  return v_note_id;
end;
$$;