-- v3 rewrite: the privacy core. answers stays owner-only at the RLS layer,
-- exactly like the pre-v3 schema — no policy ever grants a partner direct
-- table access, revealed or not. Partner visibility has exactly one path:
-- answer_shares, consumed only through get_partner_shared_answer().
--
-- private_note gets no separate column-level RLS grant because it needs
-- none: since answer_shares never grants direct table access to `answers`
-- at all (same zero-client-policy pattern as space_members/space_invites),
-- the only way any answer content ever reaches a partner is through
-- get_partner_shared_answer(), which selects option_key only and never
-- selects private_note. That satisfies "never selectable by anyone but the
-- author, under any circumstance — including via answer_shares" without
-- needing column-level grants layered under RLS.
--
-- Sharing is genuinely irreversible here, unlike the pre-v3 reveal/revoke
-- boolean: answer_shares is insert-only. There is no delete/unshare path
-- in this migration, matching the v3 prompt's explicit "irreversible"
-- confirmation-sheet requirement for the share action.

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  option_key text not null check (char_length(option_key) between 1 and 20),
  importance text not null default 'medium'
    check (importance in ('low', 'medium', 'high')),
  private_note text null check (private_note is null or char_length(private_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id, space_id)
);

create index answers_space_question_idx on public.answers (space_id, question_id);

alter table public.answers enable row level security;
revoke all on table public.answers from public, anon, authenticated;
grant select, insert, update, delete on table public.answers to authenticated;

create policy "answer owner can read"
on public.answers
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "answer owner can insert for current space"
on public.answers
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and space_id = public.current_space_id()
);

create policy "answer owner can update for current space"
on public.answers
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and space_id = public.current_space_id()
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
begin
  if tg_op = 'UPDATE' and (
    new.question_id <> old.question_id
    or new.user_id <> old.user_id
    or new.space_id <> old.space_id
  ) then
    raise exception using errcode = 'P0001', message = 'ANSWER_OWNERSHIP_IMMUTABLE';
  end if;

  if new.space_id <> public.current_space_id_for(new.user_id) then
    raise exception using errcode = 'P0001', message = 'ANSWER_SPACE_INVALID';
  end if;

  select question.* into v_question
  from public.questions question
  join public.topics topic on topic.id = question.topic_id
  where question.id = new.question_id
    and question.is_active
    and topic.is_active;

  if not found then
    raise exception using errcode = 'P0001', message = 'QUESTION_UNAVAILABLE';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_question.options) option
    where option ->> 'key' = new.option_key
  ) then
    raise exception using errcode = 'P0001', message = 'ANSWER_OPTION_INVALID';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_answer_write() from public, anon, authenticated;

create trigger answers_validate_write
before insert or update on public.answers
for each row execute function public.validate_answer_write();

-- answer_shares ----------------------------------------------------------
create table public.answer_shares (
  answer_id uuid not null references public.answers(id) on delete cascade,
  shared_with_user_id uuid not null references public.profiles(id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (answer_id, shared_with_user_id)
);

alter table public.answer_shares enable row level security;
revoke all on table public.answer_shares from public, anon, authenticated;

create or replace function public.share_answer(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid;
  v_partner_id uuid;
  v_answer_id uuid;
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

  if v_partner_id is null then
    raise exception using errcode = 'P0001', message = 'PARTNER_REQUIRED';
  end if;

  select answer.id into v_answer_id
  from public.answers answer
  where answer.question_id = p_question_id
    and answer.user_id = v_user_id
    and answer.space_id = v_space_id;

  if v_answer_id is null then
    raise exception using errcode = 'P0001', message = 'ANSWER_REQUIRED';
  end if;

  insert into public.answer_shares (answer_id, shared_with_user_id)
  values (v_answer_id, v_partner_id)
  on conflict (answer_id, shared_with_user_id) do nothing;
end;
$$;

revoke all on function public.share_answer(uuid) from public, anon, authenticated;
grant execute on function public.share_answer(uuid) to authenticated;

create or replace function public.get_partner_shared_answer(p_question_id uuid)
returns table (option_key text, shared_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select answer.option_key, share.shared_at
  from public.answer_shares share
  join public.answers answer on answer.id = share.answer_id
  where share.shared_with_user_id = auth.uid()
    and answer.question_id = p_question_id
    and answer.space_id = public.current_space_id();
$$;

revoke all on function public.get_partner_shared_answer(uuid)
  from public, anon, authenticated;
grant execute on function public.get_partner_shared_answer(uuid) to authenticated;

-- comparisons --------------------------------------------------------------
-- priority_driven_by names the partner whose importance flag drove the
-- priority, per the v3 prompt's "This one matters a lot to Val" framing
-- (the prompt's alternative, anonymized "one of you" phrasing, was not
-- picked — the prompt itself calls named disclosure "the single most
-- actionable signal in the product" and asks for one consistent choice).
-- It is a user id, never answer content, so it is safe to expose directly
-- through the same RLS a comparisons row already carries.
create table public.comparisons (
  space_id uuid not null references public.spaces(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  state text not null check (state in ('pending', 'aligned', 'discuss')),
  priority text null check (priority is null or priority in ('low', 'medium', 'high')),
  priority_driven_by uuid null references public.profiles(id) on delete set null,
  computed_at timestamptz not null default now(),
  primary key (space_id, question_id)
);

alter table public.comparisons enable row level security;
revoke all on table public.comparisons from public, anon, authenticated;
grant select on table public.comparisons to authenticated;

create policy "space members can read comparisons"
on public.comparisons
for select
to authenticated
using (public.is_current_user_space_member(space_id));

create or replace function public.refresh_comparison(p_space_id uuid, p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_answer_a public.answers%rowtype;
  v_answer_b public.answers%rowtype;
  v_answer_count integer;
  v_question public.questions%rowtype;
  v_cluster_a text;
  v_cluster_b text;
  v_state text;
  v_priority text;
  v_driven_by uuid;
  v_rank_a integer;
  v_rank_b integer;
begin
  select count(*) into v_answer_count
  from public.answers answer
  where answer.space_id = p_space_id and answer.question_id = p_question_id;

  if v_answer_count < 2 then
    insert into public.comparisons (space_id, question_id, state, priority, priority_driven_by, computed_at)
    values (p_space_id, p_question_id, 'pending', null, null, now())
    on conflict (space_id, question_id)
    do update set state = 'pending', priority = null, priority_driven_by = null, computed_at = now();
    return;
  end if;

  select answer.* into v_answer_a
  from public.answers answer
  where answer.space_id = p_space_id and answer.question_id = p_question_id
  order by answer.user_id
  limit 1;

  select answer.* into v_answer_b
  from public.answers answer
  where answer.space_id = p_space_id and answer.question_id = p_question_id
    and answer.user_id <> v_answer_a.user_id
  limit 1;

  select question.* into v_question
  from public.questions question
  where question.id = p_question_id;

  select option ->> 'cluster' into v_cluster_a
  from jsonb_array_elements(v_question.options) option
  where option ->> 'key' = v_answer_a.option_key;

  select option ->> 'cluster' into v_cluster_b
  from jsonb_array_elements(v_question.options) option
  where option ->> 'key' = v_answer_b.option_key;

  v_state := case
    when v_answer_a.option_key = v_answer_b.option_key then 'aligned'
    when v_cluster_a = v_cluster_b then 'aligned'
    else 'discuss'
  end;

  v_rank_a := case v_answer_a.importance when 'high' then 3 when 'medium' then 2 else 1 end;
  v_rank_b := case v_answer_b.importance when 'high' then 3 when 'medium' then 2 else 1 end;

  if v_rank_a = v_rank_b then
    v_priority := v_answer_a.importance;
    v_driven_by := null;
  elsif v_rank_a > v_rank_b then
    v_priority := v_answer_a.importance;
    v_driven_by := v_answer_a.user_id;
  else
    v_priority := v_answer_b.importance;
    v_driven_by := v_answer_b.user_id;
  end if;

  insert into public.comparisons (
    space_id, question_id, state, priority, priority_driven_by, computed_at
  )
  values (p_space_id, p_question_id, v_state, v_priority, v_driven_by, now())
  on conflict (space_id, question_id)
  do update set
    state = excluded.state,
    priority = excluded.priority,
    priority_driven_by = excluded.priority_driven_by,
    computed_at = excluded.computed_at;
end;
$$;

revoke all on function public.refresh_comparison(uuid, uuid) from public, anon, authenticated;

create or replace function public.answers_refresh_comparison()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_comparison(old.space_id, old.question_id);
    return old;
  end if;

  perform public.refresh_comparison(new.space_id, new.question_id);
  return new;
end;
$$;

revoke all on function public.answers_refresh_comparison() from public, anon, authenticated;

create trigger answers_refresh_comparison_trigger
after insert or update or delete on public.answers
for each row execute function public.answers_refresh_comparison();

-- Progress: counts only, never question identity or answer content.
create or replace function public.get_topic_progress(p_topic_id uuid)
returns table (mine integer, partner integer, total integer)
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
    (
      select count(*)::integer from public.answers answer
      where answer.space_id = v_space_id
        and answer.user_id = v_user_id
        and answer.question_id in (
          select question.id from public.questions question
          where question.topic_id = p_topic_id and question.is_active
        )
    ),
    coalesce((
      select count(*)::integer from public.answers answer
      where answer.space_id = v_space_id
        and answer.user_id = v_partner_id
        and answer.question_id in (
          select question.id from public.questions question
          where question.topic_id = p_topic_id and question.is_active
        )
    ), 0),
    (
      select count(*)::integer from public.questions question
      where question.topic_id = p_topic_id and question.is_active
    );
end;
$$;

revoke all on function public.get_topic_progress(uuid) from public, anon, authenticated;
grant execute on function public.get_topic_progress(uuid) to authenticated;
