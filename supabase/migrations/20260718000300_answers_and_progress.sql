create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.private_accounts(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  value jsonb not null,
  revealed boolean not null default false,
  revealed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id, couple_id),
  constraint answer_reveal_timestamp_matches_state check (
    (revealed and revealed_at is not null)
    or (not revealed and revealed_at is null)
  )
);

create index answers_couple_question_idx
on public.answers (couple_id, question_id);

alter table public.answers enable row level security;
revoke all on table public.answers from public, anon, authenticated;
grant select, insert, update, delete on table public.answers to authenticated;

create policy "answer owner can read"
on public.answers
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "answer owner can insert for current journey"
on public.answers
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and couple_id = public.current_couple_id()
);

create policy "answer owner can update for current journey"
on public.answers
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and couple_id = public.current_couple_id()
);

create policy "answer owner can delete"
on public.answers
for delete
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.validate_answer_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question public.questions%rowtype;
  v_text_value text;
  v_scale_value numeric;
begin
  if tg_op = 'UPDATE' and (
    new.question_id <> old.question_id
    or new.user_id <> old.user_id
    or new.couple_id <> old.couple_id
  ) then
    raise exception using errcode = 'P0001', message = 'ANSWER_OWNERSHIP_IMMUTABLE';
  end if;

  if new.couple_id <> public.current_couple_id_for(new.user_id) then
    raise exception using errcode = 'P0001', message = 'ANSWER_COUPLE_INVALID';
  end if;

  select question.*
  into v_question
  from public.questions question
  join public.topics topic on topic.id = question.topic_id
  where question.id = new.question_id
    and question.is_active
    and topic.is_active;

  if not found then
    raise exception using errcode = 'P0001', message = 'QUESTION_UNAVAILABLE';
  end if;

  case v_question.type
    when 'single' then
      if jsonb_typeof(new.value) <> 'string' then
        raise exception using errcode = 'P0001', message = 'ANSWER_VALUE_INVALID';
      end if;
      v_text_value := new.value #>> '{}';
      if not exists (
        select 1
        from jsonb_array_elements(v_question.options) option
        where option ->> 'id' = v_text_value
      ) then
        raise exception using errcode = 'P0001', message = 'ANSWER_VALUE_INVALID';
      end if;
    when 'scale' then
      if jsonb_typeof(new.value) <> 'number' then
        raise exception using errcode = 'P0001', message = 'ANSWER_VALUE_INVALID';
      end if;
      v_scale_value := (new.value #>> '{}')::numeric;
      if v_scale_value <> trunc(v_scale_value)
        or v_scale_value < 1
        or v_scale_value > 5 then
        raise exception using errcode = 'P0001', message = 'ANSWER_VALUE_INVALID';
      end if;
    when 'text' then
      if jsonb_typeof(new.value) <> 'string' then
        raise exception using errcode = 'P0001', message = 'ANSWER_VALUE_INVALID';
      end if;
      v_text_value := new.value #>> '{}';
      if char_length(trim(v_text_value)) = 0
        or char_length(v_text_value) > 4000 then
        raise exception using errcode = 'P0001', message = 'ANSWER_VALUE_INVALID';
      end if;
    else
      raise exception using errcode = 'P0001', message = 'QUESTION_UNAVAILABLE';
  end case;

  if new.revealed and not v_question.can_reveal then
    raise exception using errcode = 'P0001', message = 'ANSWER_REVEAL_NOT_ALLOWED';
  end if;

  if tg_op = 'INSERT' then
    if new.revealed then
      new.revealed_at := now();
    else
      new.revealed_at := null;
    end if;
  elsif new.value is distinct from old.value then
    new.revealed := false;
    new.revealed_at := null;
  elsif new.revealed then
    if not old.revealed then
      new.revealed_at := now();
    else
      new.revealed_at := old.revealed_at;
    end if;
  else
    new.revealed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_answer_write()
  from public, anon, authenticated;

create trigger answers_validate_write
before insert or update on public.answers
for each row execute function public.validate_answer_write();

create table public.answer_reveal_events (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.private_accounts(id) on delete cascade,
  action text not null check (action in ('revealed', 'revoked')),
  created_at timestamptz not null default now()
);

alter table public.answer_reveal_events enable row level security;
revoke all on table public.answer_reveal_events from public, anon, authenticated;

create or replace function public.log_answer_reveal_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.revealed then
    insert into public.answer_reveal_events (answer_id, user_id, action)
    values (new.id, new.user_id, 'revealed');
  elsif tg_op = 'UPDATE' and new.revealed is distinct from old.revealed then
    insert into public.answer_reveal_events (answer_id, user_id, action)
    values (
      new.id,
      new.user_id,
      case when new.revealed then 'revealed' else 'revoked' end
    );
  end if;
  return new;
end;
$$;

revoke all on function public.log_answer_reveal_event()
  from public, anon, authenticated;

create trigger answers_log_reveal_event
after insert or update on public.answers
for each row execute function public.log_answer_reveal_event();

create table public.topic_progress (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  user_id uuid not null references public.private_accounts(id) on delete cascade,
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (couple_id, topic_id, user_id)
);

alter table public.topic_progress enable row level security;
revoke all on table public.topic_progress from public, anon, authenticated;
grant select, insert, update, delete on table public.topic_progress to authenticated;

create policy "couple members can read topic completion"
on public.topic_progress
for select
to authenticated
using (public.is_current_user_couple_member(couple_id));

create policy "user can insert own topic completion"
on public.topic_progress
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and couple_id = public.current_couple_id()
);

create policy "user can update own topic completion"
on public.topic_progress
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and couple_id = public.current_couple_id()
);

create policy "user can delete own topic completion"
on public.topic_progress
for delete
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.validate_topic_progress()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_missing_count integer;
begin
  if tg_op = 'UPDATE' and (
    new.couple_id <> old.couple_id
    or new.topic_id <> old.topic_id
    or new.user_id <> old.user_id
  ) then
    raise exception using errcode = 'P0001', message = 'PROGRESS_OWNERSHIP_IMMUTABLE';
  end if;

  if new.couple_id <> public.current_couple_id_for(new.user_id) then
    raise exception using errcode = 'P0001', message = 'PROGRESS_COUPLE_INVALID';
  end if;

  if not exists (
    select 1
    from public.topics topic
    where topic.id = new.topic_id
      and topic.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'TOPIC_UNAVAILABLE';
  end if;

  if new.completed_at is not null then
    select count(*)::integer
    into v_missing_count
    from public.questions question
    where question.topic_id = new.topic_id
      and question.is_active
      and not exists (
        select 1
        from public.answers answer
        where answer.question_id = question.id
          and answer.user_id = new.user_id
          and answer.couple_id = new.couple_id
      );

    if v_missing_count > 0 then
      raise exception using errcode = 'P0001', message = 'TOPIC_ANSWERS_INCOMPLETE';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_topic_progress()
  from public, anon, authenticated;

create trigger topic_progress_validate
before insert or update on public.topic_progress
for each row execute function public.validate_topic_progress();
