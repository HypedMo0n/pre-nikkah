-- v3 rewrite: per-question discussed marker, a real multi-entry shared
-- note list (replacing the pre-v3 single mutable shared_note field), and
-- the space_events/event_reads notification model the pre-v3 schema had
-- no equivalent of at all. Events carry only a kind and a non-content
-- reference (topic/question id, actor id) — never answer content.

create table public.discussions (
  space_id uuid not null references public.spaces(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  discussed_at timestamptz not null default now(),
  discussed_by uuid not null references public.profiles(id) on delete cascade,
  primary key (space_id, question_id)
);

alter table public.discussions enable row level security;
revoke all on table public.discussions from public, anon, authenticated;
grant select, insert on table public.discussions to authenticated;

create policy "space members can read discussions"
on public.discussions
for select
to authenticated
using (public.is_current_user_space_member(space_id));

create policy "space members can mark a question discussed"
on public.discussions
for insert
to authenticated
with check (
  space_id = public.current_space_id()
  and discussed_by = (select auth.uid())
);

create table public.shared_notes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index shared_notes_space_question_idx
on public.shared_notes (space_id, question_id, created_at);

alter table public.shared_notes enable row level security;
revoke all on table public.shared_notes from public, anon, authenticated;
grant select, insert on table public.shared_notes to authenticated;

create policy "space members can read shared notes"
on public.shared_notes
for select
to authenticated
using (public.is_current_user_space_member(space_id));

create policy "space members can add a shared note"
on public.shared_notes
for insert
to authenticated
with check (
  space_id = public.current_space_id()
  and author_id = (select auth.uid())
);

-- space_events / event_reads ------------------------------------------
create table public.space_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  actor_id uuid null references public.profiles(id) on delete set null,
  kind text not null check (
    kind in (
      'partner_joined', 'topic_finished', 'note_added', 'answer_shared', 'space_closed'
    )
  ),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index space_events_space_id_idx on public.space_events (space_id, created_at);

alter table public.space_events enable row level security;
revoke all on table public.space_events from public, anon, authenticated;
grant select on table public.space_events to authenticated;

create policy "space members can read events"
on public.space_events
for select
to authenticated
using (public.is_current_user_space_member(space_id));

create table public.event_reads (
  space_event_id uuid not null references public.space_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (space_event_id, user_id)
);

alter table public.event_reads enable row level security;
revoke all on table public.event_reads from public, anon, authenticated;
grant select, insert on table public.event_reads to authenticated;

create policy "user can read their own read receipts"
on public.event_reads
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "user can mark their own event read"
on public.event_reads
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.space_events event
    where event.id = space_event_id
      and public.is_current_user_space_member(event.space_id)
  )
);

-- Emit partner_joined when the second member joins a space.
create or replace function public.emit_partner_joined_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_other_member_id uuid;
begin
  select membership.user_id into v_other_member_id
  from public.space_members membership
  where membership.space_id = new.space_id
    and membership.user_id <> new.user_id
    and membership.ended_at is null;

  if v_other_member_id is not null then
    insert into public.space_events (space_id, actor_id, kind, payload_json)
    values (new.space_id, new.user_id, 'partner_joined', '{}'::jsonb);
  end if;

  return new;
end;
$$;

revoke all on function public.emit_partner_joined_event() from public, anon, authenticated;

create trigger space_members_emit_partner_joined
after insert on public.space_members
for each row execute function public.emit_partner_joined_event();

create or replace function public.emit_note_added_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.space_events (space_id, actor_id, kind, payload_json)
  values (new.space_id, new.author_id, 'note_added', jsonb_build_object('question_id', new.question_id));
  return new;
end;
$$;

revoke all on function public.emit_note_added_event() from public, anon, authenticated;

create trigger shared_notes_emit_event
after insert on public.shared_notes
for each row execute function public.emit_note_added_event();

create or replace function public.emit_answer_shared_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space_id uuid;
  v_question_id uuid;
  v_author_id uuid;
begin
  select answer.space_id, answer.question_id, answer.user_id
  into v_space_id, v_question_id, v_author_id
  from public.answers answer
  where answer.id = new.answer_id;

  insert into public.space_events (space_id, actor_id, kind, payload_json)
  values (v_space_id, v_author_id, 'answer_shared', jsonb_build_object('question_id', v_question_id));

  return new;
end;
$$;

revoke all on function public.emit_answer_shared_event() from public, anon, authenticated;

create trigger answer_shares_emit_event
after insert on public.answer_shares
for each row execute function public.emit_answer_shared_event();

-- Emit topic_finished the moment an INSERT completes the user's last
-- unanswered question in a topic. UPDATE never changes the answered
-- count for an already-existing row, so only INSERT can be the
-- completing action — this guards against re-firing on every edit.
create or replace function public.emit_topic_finished_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_topic_id uuid;
  v_total integer;
  v_answered integer;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select question.topic_id into v_topic_id
  from public.questions question
  where question.id = new.question_id;

  select count(*)::integer into v_total
  from public.questions question
  where question.topic_id = v_topic_id and question.is_active;

  select count(*)::integer into v_answered
  from public.answers answer
  where answer.space_id = new.space_id
    and answer.user_id = new.user_id
    and answer.question_id in (
      select question.id from public.questions question
      where question.topic_id = v_topic_id and question.is_active
    );

  if v_total > 0 and v_answered = v_total then
    insert into public.space_events (space_id, actor_id, kind, payload_json)
    values (new.space_id, new.user_id, 'topic_finished', jsonb_build_object('topic_id', v_topic_id));
  end if;

  return new;
end;
$$;

revoke all on function public.emit_topic_finished_event() from public, anon, authenticated;

create trigger answers_emit_topic_finished
after insert on public.answers
for each row execute function public.emit_topic_finished_event();
