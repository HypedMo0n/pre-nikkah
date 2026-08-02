-- Enforce alpha-scope item (d) at the data layer.
--
-- The presentation layer already collapses per-topic partner state outside the
-- couple's current shared topic, but the API returned it anyway to any
-- authenticated member calling Supabase directly. Five paths disclosed it:
--
--   1. get_topic_progress(space, topic) returned each member's exact
--      answered_count for any topic in the caller's space. Looping it over
--      every topic recovered precisely the signal the screens hide.
--   2. A non-pending comparisons row exists only once both partners have
--      answered a question, and the table was readable for every topic, so
--      counting rows per topic recovered the same thing.
--   3. save_answer() returns the comparison state and a partnerReady flag,
--      which for a later topic discloses whether the partner answered that
--      exact question — finer than the counts in 1 and 2.
--   4. save_answer() writes a topic_ready space event carrying the topic id,
--      and the events policy exposed every event to any current member.
--   5. mark_question_discussed() and add_shared_note() raise
--      COMPARISON_NOT_READY unless the partner has answered, so calling them
--      was the same oracle by success or failure.
--
-- The rule enforced here matches the one the UI applies: partner-derived state
-- is visible for the current shared topic, and for topics the couple has
-- already discussed together, which is mutual knowledge. Everywhere else it is
-- withheld, so learning that a partner has not started a specific sensitive
-- topic is not possible through the API either.
--
-- No journey-wide comparison total is offered to replace what the narrowed
-- comparisons policy hides from the dashboard. Any such total is differential:
-- read it, answer one chosen question in a hidden topic, read it again, and it
-- moves if and only if the partner had already answered that question. The
-- dashboard counts the comparisons it can actually read instead.

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

-- Whether the caller may see partner-derived state for one topic. The guarded
-- entry point: the two helpers above check no membership themselves, so they
-- are never granted to authenticated and this wrapper is the only way in.
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

-- The preamble shared by the two comparison-dependent mutations below. Both
-- need the same four checks in the same order, and the third and fourth must
-- raise the same error: if a hidden topic failed differently from an unready
-- comparison, success versus failure would itself disclose whether the partner
-- had answered that specific question. Keeping it in one place is what stops
-- the two from drifting apart into exactly that distinction.
create or replace function public.require_ready_comparison(
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
  -- Locked: both callers write after this returns, so an unlocked snapshot
  -- would let a concurrent set_space_paused() commit in between and the
  -- discussion or shared note would still land past the pause boundary. Only
  -- the space is locked here, so this cannot form a cycle with the functions
  -- that take an answer before a space.
  perform 1 from public.spaces space
  where space.id = p_space_id and space.status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;
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
end;
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
  v_previous_option text;
  v_space_status text;
  v_comparison public.comparisons%rowtype;
  v_topic_id uuid;
  v_topic_ready boolean;
begin
  if v_user_id is null or not public.is_current_space_member(p_space_id) then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
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

  -- Read before the upsert overwrites it. A share names an answer, not the
  -- value it held when it was shared, so editing a shared answer would push
  -- the newly chosen option to the partner on the strength of a decision made
  -- about a different one. Locked so a concurrent share_answer() cannot insert
  -- its row after the retraction below has run.
  select answer.option_key into v_previous_option
  from public.answers answer
  where answer.space_id = p_space_id
    and answer.question_id = p_question_id
    and answer.user_id = v_user_id
  for update;

  -- The pause boundary, checked under a lock and after the answer, not before
  -- it. Unlocked, set_space_paused() could commit between the check and the
  -- upsert, and the answer, its recomputed comparison and its topic_ready
  -- event would all land after the pause took effect. The answer is locked
  -- first because share_answer() and revoke_answer() take them in that order;
  -- validating the space at the top of this function instead would reverse it.
  select space.status into v_space_status
  from public.spaces space
  where space.id = p_space_id
  for update;

  if v_space_status is null or v_space_status not in ('waiting', 'active') then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
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

  -- Any change to the answer retracts every share of it, so the revised
  -- version has to be shared explicitly, exactly like the first one. This is
  -- the same rule save_disclosure_attestation() applies to reveals when the
  -- body changes. Importance is deliberately not included: it reaches the
  -- partner through the comparison, never as the exact option.
  if v_previous_option is not null
     and v_previous_option is distinct from p_option_key then
    delete from public.answer_shares where answer_id = v_answer_id;

    -- And its activity event, exactly as revoke_answer() does. Left behind it
    -- would report a share the partner can no longer read, and would suppress
    -- the event for a later share of the revised answer.
    delete from public.space_events event
    where event.space_id = p_space_id
      and event.kind = 'answer_shared'
      and event.actor_id = v_user_id
      and event.payload_json ->> 'question_id' = p_question_id::text;
  end if;

  if nullif(public.normalize_body(p_private_note), '') is null then
    delete from public.private_answer_notes
    where answer_id = v_answer_id and user_id = v_user_id;
  else
    insert into public.private_answer_notes (answer_id, user_id, body, updated_at)
    values (v_answer_id, v_user_id, public.normalize_body(p_private_note), now())
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
  perform public.require_ready_comparison(p_space_id, p_question_id);

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
  perform public.require_ready_comparison(p_space_id, p_question_id);

  if char_length(public.normalize_body(p_body)) not between 1 and 5000 then
    raise exception using errcode = 'P0001', message = 'SHARED_NOTE_INVALID';
  end if;

  insert into public.shared_notes (space_id, question_id, author_id, body)
  values (p_space_id, p_question_id, auth.uid(), public.normalize_body(p_body))
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

-- is_topic_discussed, current_topic_id and require_ready_comparison check no
-- membership of their own, so they are never exposed directly: anyone holding a
-- space UUID, such as a former member, could otherwise enumerate that space's
-- discussed and current topics. can_read_topic_partner_state is the guarded
-- entry point, and it is SECURITY DEFINER, so it still calls them fine.
revoke all on function public.is_topic_discussed(uuid, uuid),
  public.current_topic_id(uuid),
  public.require_ready_comparison(uuid, uuid),
  public.can_read_topic_partner_state(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.can_read_topic_partner_state(uuid, uuid)
  to authenticated;
