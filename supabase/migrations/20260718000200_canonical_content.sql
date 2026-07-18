create or replace function public.valid_question_options(
  p_question_type text,
  p_options jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_option jsonb;
  v_option_id text;
  v_seen_ids text[] := array[]::text[];
begin
  if p_question_type <> 'single' then
    return p_options is null;
  end if;

  if p_options is null
    or jsonb_typeof(p_options) <> 'array'
    or jsonb_array_length(p_options) < 2 then
    return false;
  end if;

  for v_option in select value from jsonb_array_elements(p_options)
  loop
    if jsonb_typeof(v_option) <> 'object'
      or jsonb_typeof(v_option -> 'id') <> 'string'
      or jsonb_typeof(v_option -> 'label') <> 'string'
      or length(trim(v_option ->> 'id')) = 0
      or length(trim(v_option ->> 'label')) = 0
      or length(v_option ->> 'id') > 80
      or length(v_option ->> 'label') > 240 then
      return false;
    end if;

    v_option_id := v_option ->> 'id';
    if v_option_id = any(v_seen_ids) then
      return false;
    end if;
    v_seen_ids := array_append(v_seen_ids, v_option_id);
  end loop;

  return true;
end;
$$;

revoke all on function public.valid_question_options(text, jsonb)
  from public, anon, authenticated;

create table public.topics (
  id uuid primary key,
  slug text unique not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  blurb text not null check (char_length(blurb) between 1 and 500),
  estimated_minutes integer not null check (estimated_minutes between 1 and 60),
  order_index integer not null unique check (order_index >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.topics enable row level security;
revoke all on table public.topics from public, anon, authenticated;
grant select on table public.topics to authenticated;

create policy "authenticated users can read active topics"
on public.topics
for select
to authenticated
using (is_active);

create table public.questions (
  id uuid primary key,
  topic_id uuid not null references public.topics(id) on delete cascade,
  type text not null check (type in ('single', 'scale', 'text')),
  text text not null check (char_length(text) between 1 and 1000),
  helper_text text null check (
    helper_text is null or char_length(helper_text) between 1 and 1000
  ),
  options jsonb null,
  sensitivity text not null check (
    sensitivity in ('standard', 'sensitive', 'professional_discussion')
  ),
  comparison_mode text not null check (
    comparison_mode in (
      'exact',
      'scale_distance',
      'discussion_only',
      'never_compare'
    )
  ),
  can_reveal boolean not null default true,
  order_index integer not null check (order_index >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (topic_id, order_index),
  constraint question_options_match_type
    check (public.valid_question_options(type, options)),
  constraint question_comparison_matches_type check (
    (type = 'single' and comparison_mode in ('exact', 'discussion_only', 'never_compare'))
    or (type = 'scale' and comparison_mode in ('scale_distance', 'discussion_only', 'never_compare'))
    or (type = 'text' and comparison_mode in ('discussion_only', 'never_compare'))
  ),
  constraint never_compared_answers_are_not_revealable check (
    comparison_mode <> 'never_compare' or can_reveal = false
  )
);

create index questions_topic_order_idx
on public.questions (topic_id, order_index)
where is_active;

alter table public.questions enable row level security;
revoke all on table public.questions from public, anon, authenticated;
grant select on table public.questions to authenticated;

create policy "authenticated users can read active questions"
on public.questions
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.topics topic
    where topic.id = topic_id
      and topic.is_active
  )
);

create table public.checklist_definitions (
  id uuid primary key,
  slug text unique not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  label text not null check (char_length(label) between 1 and 240),
  description text null check (
    description is null or char_length(description) between 1 and 1000
  ),
  order_index integer not null unique check (order_index >= 0),
  is_active boolean not null default true
);

alter table public.checklist_definitions enable row level security;
revoke all on table public.checklist_definitions from public, anon, authenticated;
grant select on table public.checklist_definitions to authenticated;

create policy "authenticated users can read active checklist definitions"
on public.checklist_definitions
for select
to authenticated
using (is_active);
