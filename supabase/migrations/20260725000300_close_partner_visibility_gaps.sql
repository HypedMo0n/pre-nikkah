-- Close the remaining per-topic partner-visibility gaps.
--
-- 20260725000200 redacted the progress RPC and the comparisons table, but three
-- other paths still disclosed, per topic, what the partner had done:
--
--   1. save_answer() returns the comparison state and a partnerReady flag. For a
--      question in a later topic that reveals whether the partner has answered
--      that exact question, which is finer than the counts already redacted.
--   2. save_answer() writes a topic_ready space event carrying the topic id, and
--      the events policy exposed every event to any current member, naming the
--      later topic the partner had just finished.
--   3. is_topic_discussed() and current_topic_id() were granted to authenticated
--      and check no membership themselves, so anyone holding a space UUID, such
--      as a former member, could enumerate that space's discussed and current
--      topics directly.

create or replace function public.save_answer(
  p_space_id uuid,
  p_question_id uuid,
  p_option_key text,
  p_importance text default 'medium',
  p_private_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_answer_id uuid;
  v_comparison public.comparisons%rowtype;
  v_topic_id uuid;
  v_topic_ready boolean;
begin
  if v_user_id is null or not public.is_current_space_member(p_space_id) then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.spaces space
    where space.id = p_space_id
      and space.status in ('waiting', 'active')
  ) then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;
  if p_importance not in ('low', 'medium', 'high') then
    raise exception using errcode = 'P0001', message = 'IMPORTANCE_INVALID';
  end if;
  if not exists (
    select 1 from public.question_options option
    where option.question_id = p_question_id and option.key = p_option_key
  ) then
    raise exception using errcode = 'P0001', message = 'ANSWER_OPTION_INVALID';
  end if;

  insert into public.answers (
    space_id, question_id, user_id, option_key, importance, updated_at
  )
  values (
    p_space_id, p_question_id, v_user_id, p_option_key, p_importance, now()
  )
  on conflict (space_id, question_id, user_id) do update set
    option_key = excluded.option_key,
    importance = excluded.importance,
    updated_at = excluded.updated_at
  returning id into v_answer_id;

  if nullif(trim(coalesce(p_private_note, '')), '') is null then
    delete from public.private_answer_notes
    where answer_id = v_answer_id and user_id = v_user_id;
  else
    insert into public.private_answer_notes (answer_id, user_id, body, updated_at)
    values (v_answer_id, v_user_id, trim(p_private_note), now())
    on conflict (answer_id) do update set
      body = excluded.body,
      updated_at = excluded.updated_at;
  end if;

  v_comparison := public.recompute_comparison_internal(p_space_id, p_question_id);
  select topic_id into v_topic_id from public.questions where id = p_question_id;

  select not exists (
    select 1
    from public.questions question
    where question.topic_id = v_topic_id
      and (
        select count(*)
        from public.answers answer
        where answer.space_id = p_space_id
          and answer.question_id = question.id
      ) < 2
  ) into v_topic_ready;

  if v_topic_ready and not exists (
    select 1
    from public.space_events event
    where event.space_id = p_space_id
      and event.kind = 'topic_ready'
      and event.payload_json ->> 'topic_id' = v_topic_id::text
  ) then
    insert into public.space_events (space_id, actor_id, kind, payload_json)
    values (
      p_space_id,
      v_user_id,
      'topic_ready',
      jsonb_build_object('topic_id', v_topic_id)
    );
  end if;

  -- The comparison state and partnerReady both disclose whether the partner
  -- has answered this exact question, which is finer-grained than the counts
  -- redacted elsewhere. Outside the current or an already discussed topic the
  -- caller gets only their own answer id back; the client already treats the
  -- absent fields as pending / not ready.
  if not public.can_read_topic_partner_state(p_space_id, v_topic_id) then
    return jsonb_build_object('answerId', v_answer_id);
  end if;

  return jsonb_build_object(
    'answerId', v_answer_id,
    'state', v_comparison.state,
    'priority', v_comparison.priority,
    'partnerReady', v_comparison.state <> 'pending'
  );
end;
$$;
-- A topic_ready event names the topic the couple just finished together. That
-- is safe for the current and already discussed topics and disclosing anywhere
-- else, so the same rule gates reading the event. Writing is unchanged, which
-- keeps the existing de-duplication on payload_json ->> 'topic_id' working.
drop policy if exists "current members can read events" on public.space_events;

create policy "members read events for shared or discussed topics"
on public.space_events for select to authenticated
using (
  public.is_current_space_member(space_id)
  and (
    kind <> 'topic_ready'
    or public.can_read_topic_partner_state(
      space_id,
      (payload_json ->> 'topic_id')::uuid
    )
  )
);

-- These two are implementation details of can_read_topic_partner_state, which
-- does check membership. They are SECURITY DEFINER, so that wrapper still calls
-- them fine once the caller can no longer invoke them directly.
revoke execute on function public.is_topic_discussed(uuid, uuid),
  public.current_topic_id(uuid)
  from public, anon, authenticated;
