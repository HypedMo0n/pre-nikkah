-- Add the free-text normalization helper as a forward migration.
--
-- trim() strips ordinary spaces only, so a textarea submitting just tabs or
-- newlines survived it: the value stayed non-empty, satisfied the char_length
-- constraints, and counted as real content. normalize_body() covers the whole
-- whitespace class, and every place that accepts free text goes through it.
--
-- This lives in its own migration rather than in 20260724000100 because a
-- database that has already recorded that version skips it on the next push.
-- The helper would then never be created, while 20260725000100 and
-- 20260725000200 -- which are new versions and do get applied -- call it, and
-- every disclosure, answer, private-note and shared-note write would fail with
-- `function public.normalize_body(text) does not exist`. Production is on v2
-- and unaffected, but the repository ships db:remote:push for exactly the kind
-- of long-lived v3 database this would break.
--
-- The three functions below are redefined here for the same reason: on a
-- database that already has 20260724000100, this migration is the only chance
-- to move them onto the helper.

create or replace function public.normalize_body(p_text text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(coalesce(p_text, ''), '^\s+|\s+$', '', 'g');
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(
      nullif(left(public.normalize_body(new.raw_user_meta_data ->> 'display_name'), 80), ''),
      nullif(left(split_part(coalesce(new.email, ''), '@', 1), 80), ''),
      'Member'
    ),
    case
      when coalesce(new.raw_user_meta_data ->> 'locale', '') ~ '^[a-z]{2}(?:-[A-Z]{2})?$'
        then new.raw_user_meta_data ->> 'locale'
      else 'en'
    end
  )
  on conflict (id) do nothing;
  return new;
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

  return jsonb_build_object(
    'answerId', v_answer_id,
    'state', v_comparison.state,
    'priority', v_comparison.priority,
    'partnerReady', v_comparison.state <> 'pending'
  );
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
  if not exists (
    select 1
    from public.comparisons comparison
    where comparison.space_id = p_space_id
      and comparison.question_id = p_question_id
      and comparison.state in ('aligned', 'discuss')
  ) then
    raise exception using errcode = 'P0001', message = 'COMPARISON_NOT_READY';
  end if;
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
