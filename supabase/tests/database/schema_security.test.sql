begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

select is(
  (
    select count(*)
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relkind = 'r'
  ),
  21::bigint,
  'The public schema contains only the approved v3 tables'
);

select is(
  (
    select count(*)
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relkind = 'r'
      and class.relrowsecurity
  ),
  21::bigint,
  'RLS is enabled on every public table'
);

select is((select count(*) from public.topics), 12::bigint, 'All twelve topics are installed');
select is((select count(*) from public.questions), 72::bigint, 'All seventy-two questions are installed');

select is(
  (
    select count(*)
    from public.topics topic
    left join public.topic_translations translation
      on translation.topic_id = topic.id and translation.locale = 'en'
    where translation.topic_id is null
  ),
  0::bigint,
  'Every topic has an English translation'
);

select is(
  (
    select count(*)
    from public.questions question
    left join public.question_translations translation
      on translation.question_id = question.id and translation.locale = 'en'
    where translation.question_id is null
  ),
  0::bigint,
  'Every question has an English translation and authored conversation starters'
);

select is(
  (
    select count(*)
    from (
      select question.id
      from public.questions question
      left join public.question_options option on option.question_id = question.id
      group by question.id
      having count(option.key) not between 3 and 5
    ) invalid_question
  ),
  0::bigint,
  'Every question has between three and five structured options'
);

select is(
  (
    select count(*)
    from public.question_options option
    left join public.question_option_translations translation
      on translation.question_id = option.question_id
      and translation.option_key = option.key
      and translation.locale = 'en'
    where translation.question_id is null
  ),
  0::bigint,
  'Every answer option has an English label and description'
);

select is(
  (
    select count(*)
    from public.questions question
    join public.topics topic on topic.id = question.topic_id
    where topic.slug = 'dealbreakers'
      and question.default_importance <> 'high'
  ),
  0::bigint,
  'Dealbreaker questions default to high importance'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'spaces'
      and column_name in ('invite_code', 'code', 'plaintext_invite')
  ),
  0::bigint,
  'Plaintext invitation codes are never stored'
);

select is(
  (
    select count(*)
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and not exists (
        select 1
        from unnest(coalesce(procedure.proconfig, '{}'::text[])) setting
        where setting in (
          'search_path=public, pg_temp',
          'search_path=public, extensions, pg_temp'
        )
      )
  ),
  0::bigint,
  'Every SECURITY DEFINER function has a fixed approved search path'
);

select is(
  (
    select count(*)
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and has_function_privilege('anon', procedure.oid, 'execute')
  ),
  0::bigint,
  'Anonymous clients cannot execute privileged application functions'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.recompute_comparison_internal(uuid,uuid)',
    'execute'
  ),
  'Authenticated clients cannot forge comparison results'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_account_deletion(uuid)',
    'execute'
  ),
  'Authenticated clients cannot invoke service account deletion'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name in (
        'spaces',
        'space_members',
        'answers',
        'private_answer_notes',
        'answer_shares',
        'comparisons',
        'discussions',
        'shared_notes',
        'space_events',
        'event_reads'
      )
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ),
  0::bigint,
  'Sensitive state can only be mutated through protected endpoints'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name in (
        'topics',
        'topic_translations',
        'questions',
        'question_translations',
        'question_options',
        'question_option_translations'
      )
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ),
  0::bigint,
  'Canonical question content is immutable to clients'
);

select * from finish();
rollback;
