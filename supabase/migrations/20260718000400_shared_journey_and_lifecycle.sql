create table public.guided_discussions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'discussing', 'discussed')),
  shared_note text null check (
    shared_note is null or char_length(shared_note) <= 5000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, question_id)
);

alter table public.guided_discussions enable row level security;
revoke all on table public.guided_discussions from public, anon, authenticated;
grant select, insert, update on table public.guided_discussions to authenticated;

create policy "couple members can read shared discussions"
on public.guided_discussions
for select
to authenticated
using (public.is_current_user_couple_member(couple_id));

create policy "current couple members can create shared discussions"
on public.guided_discussions
for insert
to authenticated
with check (couple_id = public.current_couple_id());

create policy "current couple members can update shared discussions"
on public.guided_discussions
for update
to authenticated
using (couple_id = public.current_couple_id())
with check (couple_id = public.current_couple_id());

create or replace function public.validate_guided_discussion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and (
    new.couple_id <> old.couple_id
    or new.topic_id <> old.topic_id
    or new.question_id <> old.question_id
  ) then
    raise exception using errcode = 'P0001', message = 'DISCUSSION_OWNERSHIP_IMMUTABLE';
  end if;

  if new.couple_id <> public.current_couple_id_for(auth.uid()) then
    raise exception using errcode = 'P0001', message = 'DISCUSSION_COUPLE_INVALID';
  end if;

  if not exists (
    select 1
    from public.questions question
    join public.topics topic on topic.id = question.topic_id
    where question.id = new.question_id
      and question.topic_id = new.topic_id
      and question.is_active
      and topic.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'QUESTION_UNAVAILABLE';
  end if;

  new.shared_note := nullif(trim(coalesce(new.shared_note, '')), '');
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_guided_discussion()
  from public, anon, authenticated;

create trigger guided_discussions_validate
before insert or update on public.guided_discussions
for each row execute function public.validate_guided_discussion();

create table public.couple_checklist_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  checklist_definition_id uuid not null
    references public.checklist_definitions(id),
  done boolean not null default false,
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (couple_id, checklist_definition_id),
  constraint checklist_timestamp_matches_state check (
    (done and completed_at is not null)
    or (not done and completed_at is null)
  )
);

alter table public.couple_checklist_items enable row level security;
revoke all on table public.couple_checklist_items from public, anon, authenticated;
grant select, insert, update on table public.couple_checklist_items to authenticated;

create policy "couple members can read checklist state"
on public.couple_checklist_items
for select
to authenticated
using (public.is_current_user_couple_member(couple_id));

create policy "current couple members can create checklist state"
on public.couple_checklist_items
for insert
to authenticated
with check (couple_id = public.current_couple_id());

create policy "current couple members can update checklist state"
on public.couple_checklist_items
for update
to authenticated
using (couple_id = public.current_couple_id())
with check (couple_id = public.current_couple_id());

create or replace function public.validate_checklist_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and (
    new.couple_id <> old.couple_id
    or new.checklist_definition_id <> old.checklist_definition_id
  ) then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_OWNERSHIP_IMMUTABLE';
  end if;

  if new.couple_id <> public.current_couple_id_for(auth.uid()) then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_COUPLE_INVALID';
  end if;

  if not exists (
    select 1
    from public.checklist_definitions definition
    where definition.id = new.checklist_definition_id
      and definition.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_ITEM_UNAVAILABLE';
  end if;

  if tg_op = 'INSERT' then
    if new.done then
      new.completed_at := now();
    else
      new.completed_at := null;
    end if;
  elsif new.done then
    if not old.done then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_checklist_item()
  from public, anon, authenticated;

create trigger couple_checklist_items_validate
before insert or update on public.couple_checklist_items
for each row execute function public.validate_checklist_item();

create table public.journey_closure_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.private_accounts(id) on delete cascade,
  reason text not null check (reason in ('closed', 'partner_account_deleted')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz null
);

alter table public.journey_closure_notices enable row level security;
revoke all on table public.journey_closure_notices from public, anon, authenticated;
grant select on table public.journey_closure_notices to authenticated;
grant update (acknowledged_at) on table public.journey_closure_notices to authenticated;

create policy "notice owner can read"
on public.journey_closure_notices
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "notice owner can acknowledge"
on public.journey_closure_notices
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.close_couple_journey()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_couple_id uuid;
  v_partner_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;

  v_couple_id := public.current_couple_id();
  if v_couple_id is null then
    raise exception using errcode = 'P0001', message = 'ACTIVE_COUPLE_REQUIRED';
  end if;

  select case
    when couple.user_a_id = v_user_id then couple.user_b_id
    else couple.user_a_id
  end
  into v_partner_id
  from public.couples couple
  where couple.id = v_couple_id
  for update;

  update public.couples
  set status = 'closed'
  where id = v_couple_id;

  update public.couple_memberships
  set ended_at = coalesce(ended_at, now())
  where couple_id = v_couple_id;

  delete from public.guided_discussions where couple_id = v_couple_id;
  delete from public.couple_checklist_items where couple_id = v_couple_id;

  if v_partner_id is not null then
    insert into public.journey_closure_notices (user_id, reason)
    values (v_partner_id, 'closed');
  end if;
end;
$$;

revoke all on function public.close_couple_journey()
  from public, anon, authenticated;
grant execute on function public.close_couple_journey() to authenticated;

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_couple record;
  v_partner_id uuid;
begin
  if p_user_id is null then
    raise exception using errcode = 'P0001', message = 'ACCOUNT_ID_REQUIRED';
  end if;

  for v_couple in
    select couple.id, couple.user_a_id, couple.user_b_id
    from public.couples couple
    where couple.user_a_id = p_user_id
      or couple.user_b_id = p_user_id
    for update of couple
  loop
    v_partner_id := case
      when v_couple.user_a_id = p_user_id then v_couple.user_b_id
      else v_couple.user_a_id
    end;

    update public.couples
    set status = 'closed'
    where id = v_couple.id;

    delete from public.guided_discussions where couple_id = v_couple.id;
    delete from public.couple_checklist_items where couple_id = v_couple.id;

    if v_partner_id is not null and v_partner_id <> p_user_id then
      insert into public.journey_closure_notices (user_id, reason)
      values (v_partner_id, 'partner_account_deleted');
    end if;

    delete from public.couples where id = v_couple.id;
  end loop;

  delete from public.private_accounts where id = p_user_id;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
