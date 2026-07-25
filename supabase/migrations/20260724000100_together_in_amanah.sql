create extension if not exists pgcrypto with schema extensions;

revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  invite_code_hash text unique not null check (char_length(invite_code_hash) = 64),
  invite_expires_at timestamptz not null,
  invite_redeemed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'waiting' and invite_redeemed_at is null)
    or status in ('active', 'paused', 'closed')
  )
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('creator', 'partner')),
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (space_id, user_id)
);

create unique index one_current_space_per_user
  on public.space_members (user_id)
  where ended_at is null;

create unique index one_current_role_per_space
  on public.space_members (space_id, role)
  where ended_at is null;

create table public.topics (
  id uuid primary key,
  slug text unique not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  order_index integer unique not null check (order_index between 1 and 12)
);

create table public.topic_translations (
  topic_id uuid not null references public.topics(id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  title text not null check (char_length(title) between 1 and 160),
  subtitle text not null check (char_length(subtitle) between 1 and 500),
  primary key (topic_id, locale)
);

create table public.questions (
  id uuid primary key,
  key text unique not null check (key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  topic_id uuid not null references public.topics(id) on delete cascade,
  order_index integer not null check (order_index between 1 and 12),
  default_importance text not null default 'medium'
    check (default_importance in ('low', 'medium', 'high')),
  unique (topic_id, order_index)
);

create table public.question_translations (
  question_id uuid not null references public.questions(id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  text text not null check (char_length(text) between 1 and 1000),
  starter_aligned text not null check (char_length(starter_aligned) between 1 and 1500),
  starter_discuss text not null check (char_length(starter_discuss) between 1 and 1500),
  primary key (question_id, locale)
);

create table public.question_options (
  question_id uuid not null references public.questions(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9]+$'),
  cluster text not null check (cluster ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  order_index integer not null check (order_index between 1 and 5),
  primary key (question_id, key),
  unique (question_id, order_index)
);

create table public.question_option_translations (
  question_id uuid not null,
  option_key text not null,
  locale text not null check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  label text not null check (char_length(label) between 1 and 240),
  description text not null check (char_length(description) between 1 and 500),
  primary key (question_id, option_key, locale),
  foreign key (question_id, option_key)
    references public.question_options(question_id, key)
    on delete cascade
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_key text not null,
  importance text not null default 'medium'
    check (importance in ('low', 'medium', 'high')),
  updated_at timestamptz not null default now(),
  unique (space_id, question_id, user_id),
  foreign key (question_id, option_key)
    references public.question_options(question_id, key)
);

create index answers_space_question_idx
  on public.answers (space_id, question_id);

create table public.private_answer_notes (
  answer_id uuid primary key references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  updated_at timestamptz not null default now()
);

create table public.answer_shares (
  answer_id uuid not null references public.answers(id) on delete cascade,
  shared_with_user_id uuid not null references public.profiles(id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (answer_id, shared_with_user_id)
);

create table public.comparisons (
  space_id uuid not null references public.spaces(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  state text not null check (state in ('pending', 'aligned', 'discuss')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  high_priority_user_ids uuid[] not null default '{}'::uuid[]
    check (cardinality(high_priority_user_ids) between 0 and 2),
  computed_at timestamptz not null default now(),
  primary key (space_id, question_id)
);

create table public.discussions (
  space_id uuid not null references public.spaces(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  discussed_at timestamptz not null default now(),
  discussed_by uuid not null references public.profiles(id) on delete restrict,
  primary key (space_id, question_id)
);

create table public.shared_notes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create table public.space_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  kind text not null
    check (kind in ('partner_joined', 'topic_ready', 'shared_note_added', 'answer_shared')),
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    jsonb_typeof(payload_json) = 'object'
    and payload_json - 'topic_id' - 'question_id' = '{}'::jsonb
  )
);

create table public.event_reads (
  space_event_id uuid not null references public.space_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (space_event_id, user_id)
);

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
      nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 80), ''),
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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger spaces_set_updated_at
before update on public.spaces
for each row execute function public.set_updated_at();

create or replace function public.is_current_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.space_members member
    where member.space_id = p_space_id
      and member.user_id = auth.uid()
      and member.ended_at is null
  );
$$;

create or replace function public.current_space_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select member.space_id
  from public.space_members member
  join public.spaces space on space.id = member.space_id
  where member.user_id = auth.uid()
    and member.ended_at is null
    and space.status in ('waiting', 'active', 'paused')
  limit 1;
$$;

create or replace function public.can_current_user_read_answer(p_answer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.answers answer
    where answer.id = p_answer_id
      and (
        answer.user_id = auth.uid()
        or exists (
          select 1
          from public.answer_shares share
          where share.answer_id = answer.id
            and share.shared_with_user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.is_current_user_answer_owner(p_answer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.answers answer
    where answer.id = p_answer_id
      and answer.user_id = auth.uid()
  );
$$;

create or replace function public.recompute_comparison_internal(
  p_space_id uuid,
  p_question_id uuid
)
returns public.comparisons
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.comparisons%rowtype;
  v_answer_count integer;
  v_min_key text;
  v_max_key text;
  v_min_cluster text;
  v_max_cluster text;
  v_priority_rank integer;
  v_high_users uuid[];
begin
  select
    count(*)::integer,
    min(answer.option_key),
    max(answer.option_key),
    min(option.cluster),
    max(option.cluster),
    coalesce(max(case answer.importance when 'high' then 3 when 'medium' then 2 else 1 end), 1),
    coalesce(
      array_agg(answer.user_id order by answer.user_id)
        filter (where answer.importance = 'high'),
      '{}'::uuid[]
    )
  into
    v_answer_count,
    v_min_key,
    v_max_key,
    v_min_cluster,
    v_max_cluster,
    v_priority_rank,
    v_high_users
  from public.answers answer
  join public.question_options option
    on option.question_id = answer.question_id
    and option.key = answer.option_key
  where answer.space_id = p_space_id
    and answer.question_id = p_question_id;

  insert into public.comparisons (
    space_id,
    question_id,
    state,
    priority,
    high_priority_user_ids,
    computed_at
  )
  values (
    p_space_id,
    p_question_id,
    case
      when v_answer_count < 2 then 'pending'
      when v_min_key = v_max_key or v_min_cluster = v_max_cluster then 'aligned'
      else 'discuss'
    end,
    case v_priority_rank when 3 then 'high' when 2 then 'medium' else 'low' end,
    v_high_users,
    now()
  )
  on conflict (space_id, question_id) do update set
    state = excluded.state,
    priority = excluded.priority,
    high_priority_user_ids = excluded.high_priority_user_ids,
    computed_at = excluded.computed_at
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.create_space()
returns table (
  space_id uuid,
  invite_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := encode(extensions.gen_random_bytes(10), 'hex');
  v_space_id uuid;
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if public.current_space_id() is not null then
    raise exception using errcode = 'P0001', message = 'CURRENT_SPACE_EXISTS';
  end if;

  insert into public.spaces (
    invite_code_hash,
    invite_expires_at,
    created_by
  )
  values (
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    v_expires_at,
    v_user_id
  )
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, v_user_id, 'creator');

  return query select v_space_id, v_code, v_expires_at;
end;
$$;

create or replace function public.inspect_space_invite(p_invite_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := regexp_replace(lower(trim(coalesce(p_invite_code, ''))), '[^0-9a-f]', '', 'g');
  v_space public.spaces%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_code) <> 20 then
    return jsonb_build_object('status', 'unavailable');
  end if;

  select space.* into v_space
  from public.spaces space
  where space.invite_code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex');

  if not found then
    return jsonb_build_object('status', 'unavailable');
  elsif v_space.created_by = v_user_id then
    return jsonb_build_object('status', 'self_invite');
  elsif v_space.status <> 'waiting' or v_space.invite_redeemed_at is not null then
    return jsonb_build_object('status', 'already_used');
  elsif v_space.invite_expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  elsif public.current_space_id() is not null then
    return jsonb_build_object('status', 'current_space_exists');
  end if;

  return jsonb_build_object('status', 'available', 'expiresAt', v_space.invite_expires_at);
end;
$$;

create or replace function public.redeem_space_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := regexp_replace(lower(trim(coalesce(p_invite_code, ''))), '[^0-9a-f]', '', 'g');
  v_space public.spaces%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if char_length(v_code) <> 20 then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  end if;
  if public.current_space_id() is not null then
    raise exception using errcode = 'P0001', message = 'CURRENT_SPACE_EXISTS';
  end if;

  select space.* into v_space
  from public.spaces space
  where space.invite_code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITE_INVALID';
  elsif v_space.created_by = v_user_id then
    raise exception using errcode = 'P0001', message = 'INVITE_SELF_REDEMPTION';
  elsif v_space.status <> 'waiting' or v_space.invite_redeemed_at is not null then
    raise exception using errcode = 'P0001', message = 'INVITE_ALREADY_USED';
  elsif v_space.invite_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'INVITE_EXPIRED';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_space.id, v_user_id, 'partner');

  update public.spaces
  set status = 'active', invite_redeemed_at = now()
  where id = v_space.id;

  insert into public.space_events (space_id, actor_id, kind)
  values (v_space.id, v_user_id, 'partner_joined');

  return v_space.id;
end;
$$;

create or replace function public.regenerate_space_invite()
returns table (
  invite_code text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid := public.current_space_id();
  v_code text := encode(extensions.gen_random_bytes(10), 'hex');
  v_expires_at timestamptz := now() + interval '7 days';
begin
  if v_user_id is null or v_space_id is null then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.spaces space
    where space.id = v_space_id
      and space.created_by = v_user_id
      and space.status = 'waiting'
      and space.invite_redeemed_at is null
  ) then
    raise exception using errcode = 'P0001', message = 'INVITE_NOT_REGENERATABLE';
  end if;

  update public.spaces
  set
    invite_code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex'),
    invite_expires_at = v_expires_at
  where id = v_space_id;

  return query select v_code, v_expires_at;
end;
$$;

create or replace function public.get_space_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid := public.current_space_id();
  v_space public.spaces%rowtype;
  v_partner_name text;
  v_partner_id uuid;
  v_role text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_space_id is null then
    return jsonb_build_object('status', 'none');
  end if;

  select * into v_space from public.spaces where id = v_space_id;
  select member.role into v_role
  from public.space_members member
  where member.space_id = v_space_id
    and member.user_id = v_user_id
    and member.ended_at is null;
  select member.user_id, profile.display_name
  into v_partner_id, v_partner_name
  from public.space_members member
  join public.profiles profile on profile.id = member.user_id
  where member.space_id = v_space_id
    and member.user_id <> v_user_id
    and member.ended_at is null
  limit 1;

  return jsonb_build_object(
    'status', v_space.status,
    'spaceId', v_space.id,
    'role', v_role,
    'partner', case when v_partner_id is null then null else jsonb_build_object(
      'id', v_partner_id,
      'displayName', v_partner_name
    ) end,
    'inviteExpiresAt', case when v_space.status = 'waiting' then v_space.invite_expires_at else null end
  );
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

  return jsonb_build_object(
    'answerId', v_answer_id,
    'state', v_comparison.state,
    'priority', v_comparison.priority,
    'partnerReady', v_comparison.state <> 'pending'
  );
end;
$$;

create or replace function public.share_answer(p_answer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_answer public.answers%rowtype;
  v_partner_id uuid;
begin
  select answer.* into v_answer
  from public.answers answer
  where answer.id = p_answer_id and answer.user_id = v_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'ANSWER_NOT_OWNED';
  end if;
  if not exists (
    select 1
    from public.spaces space
    where space.id = v_answer.space_id
      and space.status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;

  select member.user_id into v_partner_id
  from public.space_members member
  where member.space_id = v_answer.space_id
    and member.user_id <> v_user_id
    and member.ended_at is null
  limit 1;
  if v_partner_id is null then
    raise exception using errcode = 'P0001', message = 'PARTNER_REQUIRED';
  end if;

  insert into public.answer_shares (answer_id, shared_with_user_id)
  values (p_answer_id, v_partner_id)
  on conflict do nothing;

  if not exists (
    select 1 from public.space_events event
    where event.space_id = v_answer.space_id
      and event.kind = 'answer_shared'
      and event.payload_json ->> 'question_id' = v_answer.question_id::text
      and event.actor_id = v_user_id
  ) then
    insert into public.space_events (space_id, actor_id, kind, payload_json)
    values (
      v_answer.space_id,
      v_user_id,
      'answer_shared',
      jsonb_build_object('question_id', v_answer.question_id)
    );
  end if;
end;
$$;

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
    (select count(*) from public.questions question where question.topic_id = p_topic_id)
  from public.space_members member
  left join public.answers answer
    on answer.space_id = member.space_id
    and answer.user_id = member.user_id
    and answer.question_id in (
      select question.id from public.questions question where question.topic_id = p_topic_id
    )
  where member.space_id = p_space_id
    and member.ended_at is null
  group by member.user_id;
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

create or replace function public.mark_space_event_read(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space_id uuid;
begin
  select event.space_id into v_space_id
  from public.space_events event
  where event.id = p_event_id;
  if v_space_id is null or not public.is_current_space_member(v_space_id) then
    raise exception using errcode = 'P0001', message = 'EVENT_NOT_AVAILABLE';
  end if;
  insert into public.event_reads (space_event_id, user_id)
  values (p_event_id, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function public.close_space()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space_id uuid := public.current_space_id();
begin
  if v_space_id is null then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;
  update public.spaces set status = 'closed' where id = v_space_id;
  update public.space_members set ended_at = now()
  where space_id = v_space_id and ended_at is null;
end;
$$;

create or replace function public.set_space_paused(p_paused boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_space_id uuid := public.current_space_id();
begin
  if v_space_id is null then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;
  if not exists (
    select 1 from public.spaces
    where id = v_space_id and status in ('active', 'paused')
  ) then
    raise exception using errcode = 'P0001', message = 'SPACE_NOT_ACTIVE';
  end if;
  update public.spaces
  set status = case when p_paused then 'paused' else 'active' end
  where id = v_space_id;
end;
$$;

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;
  delete from public.spaces space
  where exists (
    select 1 from public.space_members member
    where member.space_id = space.id and member.user_id = p_user_id
  );
  delete from public.profiles where id = p_user_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.topics enable row level security;
alter table public.topic_translations enable row level security;
alter table public.questions enable row level security;
alter table public.question_translations enable row level security;
alter table public.question_options enable row level security;
alter table public.question_option_translations enable row level security;
alter table public.answers enable row level security;
alter table public.private_answer_notes enable row level security;
alter table public.answer_shares enable row level security;
alter table public.comparisons enable row level security;
alter table public.discussions enable row level security;
alter table public.shared_notes enable row level security;
alter table public.space_events enable row level security;
alter table public.event_reads enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.spaces, public.space_members, public.topics,
  public.topic_translations, public.questions, public.question_translations,
  public.question_options, public.question_option_translations,
  public.answers, public.private_answer_notes, public.answer_shares,
  public.comparisons, public.discussions, public.shared_notes,
  public.space_events, public.event_reads to authenticated;

create policy "profile owner can read"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "profile owner can update"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "current members can read spaces"
on public.spaces for select to authenticated
using (public.is_current_space_member(id));

create policy "current members can read memberships"
on public.space_members for select to authenticated
using (public.is_current_space_member(space_id));

create policy "authenticated users can read topics"
on public.topics for select to authenticated using (true);

create policy "authenticated users can read topic translations"
on public.topic_translations for select to authenticated using (true);

create policy "authenticated users can read questions"
on public.questions for select to authenticated using (true);

create policy "authenticated users can read question translations"
on public.question_translations for select to authenticated using (true);

create policy "authenticated users can read question options"
on public.question_options for select to authenticated using (true);

create policy "authenticated users can read option translations"
on public.question_option_translations for select to authenticated using (true);

create policy "owner or explicit recipient can read answer"
on public.answers for select to authenticated
using (public.can_current_user_read_answer(id));

create policy "private note owner can read"
on public.private_answer_notes for select to authenticated
using (user_id = (select auth.uid()));

create policy "share participants can read"
on public.answer_shares for select to authenticated
using (
  shared_with_user_id = (select auth.uid())
  or public.is_current_user_answer_owner(answer_id)
);

create policy "current members can read comparisons"
on public.comparisons for select to authenticated
using (public.is_current_space_member(space_id));

create policy "current members can read discussions"
on public.discussions for select to authenticated
using (public.is_current_space_member(space_id));

create policy "current members can read shared notes"
on public.shared_notes for select to authenticated
using (public.is_current_space_member(space_id));

create policy "current members can read events"
on public.space_events for select to authenticated
using (public.is_current_space_member(space_id));

create policy "event read owner can read"
on public.event_reads for select to authenticated
using (user_id = (select auth.uid()));

revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_current_space_member(uuid),
  public.current_space_id(),
  public.can_current_user_read_answer(uuid),
  public.is_current_user_answer_owner(uuid),
  public.create_space(),
  public.inspect_space_invite(text),
  public.redeem_space_invite(text),
  public.regenerate_space_invite(),
  public.get_space_overview(),
  public.save_answer(uuid, uuid, text, text, text),
  public.share_answer(uuid),
  public.get_topic_progress(uuid, uuid),
  public.mark_question_discussed(uuid, uuid),
  public.add_shared_note(uuid, uuid, text),
  public.mark_space_event_read(uuid),
  public.close_space(),
  public.set_space_paused(boolean)
to authenticated;

grant execute on function public.prepare_account_deletion(uuid) to service_role;
