-- v3 rewrite: single question kind only (single choice + importance flag).
-- No comparison_mode, no sensitivity tier, no scale/text question types —
-- those are dropped entirely per the v3 data model. Alignment is driven by
-- author-assigned `cluster` values on each option, not a runtime formula.

create table public.topics (
  id uuid primary key,
  slug text unique not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  order_index integer not null unique check (order_index >= 0),
  title text not null check (char_length(title) between 1 and 120),
  subtitle text not null check (char_length(subtitle) between 1 and 240),
  default_importance text null check (
    default_importance is null or default_importance in ('low', 'medium', 'high')
  ),
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

create or replace function public.valid_question_options(p_options jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_option jsonb;
  v_seen_keys text[] := array[]::text[];
  v_option_count integer;
begin
  if p_options is null
    or jsonb_typeof(p_options) <> 'array' then
    return false;
  end if;

  v_option_count := jsonb_array_length(p_options);
  if v_option_count < 3 or v_option_count > 5 then
    return false;
  end if;

  for v_option in select value from jsonb_array_elements(p_options)
  loop
    if jsonb_typeof(v_option) <> 'object'
      or jsonb_typeof(v_option -> 'key') <> 'string'
      or jsonb_typeof(v_option -> 'label') <> 'string'
      or jsonb_typeof(v_option -> 'description') <> 'string'
      or jsonb_typeof(v_option -> 'cluster') <> 'string'
      or length(trim(v_option ->> 'key')) = 0
      or length(trim(v_option ->> 'label')) = 0
      or length(trim(v_option ->> 'description')) = 0
      or length(trim(v_option ->> 'cluster')) = 0
      or length(v_option ->> 'key') > 20
      or length(v_option ->> 'label') > 120
      or length(v_option ->> 'description') > 240
      or length(v_option ->> 'cluster') > 40 then
      return false;
    end if;

    if (v_option ->> 'key') = any(v_seen_keys) then
      return false;
    end if;
    v_seen_keys := array_append(v_seen_keys, v_option ->> 'key');
  end loop;

  return true;
end;
$$;

revoke all on function public.valid_question_options(jsonb)
  from public, anon, authenticated;

create table public.questions (
  id uuid primary key,
  topic_id uuid not null references public.topics(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  order_index integer not null check (order_index >= 0),
  text text not null check (char_length(text) between 1 and 400),
  options jsonb not null,
  importance_default text not null default 'medium'
    check (importance_default in ('low', 'medium', 'high')),
  starter_discuss text not null check (char_length(starter_discuss) between 1 and 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (topic_id, order_index),
  unique (key),
  constraint question_options_valid check (public.valid_question_options(options))
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
    select 1 from public.topics topic
    where topic.id = topic_id and topic.is_active
  )
);
