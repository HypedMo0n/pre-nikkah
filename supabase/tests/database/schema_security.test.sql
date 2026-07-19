begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

create temp table application_security_definer_functions (
  function_name name primary key
);

insert into application_security_definer_functions (function_name)
values
  ('handle_new_auth_user'),
  ('validate_journey_policy_acceptance'),
  ('validate_couple_activation'),
  ('is_couple_member_for'),
  ('is_current_user_couple_member'),
  ('current_couple_id_for'),
  ('current_couple_id'),
  ('create_couple_invite'),
  ('redeem_couple_invite'),
  ('inspect_couple_invite'),
  ('revoke_couple_invite'),
  ('validate_answer_write'),
  ('log_answer_reveal_event'),
  ('validate_topic_progress'),
  ('get_connection_overview'),
  ('get_question_comparison'),
  ('get_topic_comparison_summary'),
  ('validate_guided_discussion'),
  ('validate_checklist_item'),
  ('close_couple_journey'),
  ('prepare_account_deletion');

select is(
  (
    select count(*)
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relkind = 'r'
  ),
  14::bigint,
  'The public schema contains exactly the approved fourteen tables'
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
  14::bigint,
  'RLS is enabled on every public table'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'private_accounts'
      and column_name = any(array[
        'preferred_locale',
        'private_display_name',
        'relationship_stage',
        'onboarding_completed',
        'onboarding_step',
        'product_intro_completed',
        'privacy_intro_completed',
        'entry_mode'
      ])
  ),
  8::bigint,
  'Private accounts contain every approved onboarding field'
);

select is(
  (
    select count(*)
    from pg_constraint constraint_record
    join pg_class class on class.oid = constraint_record.conrelid
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'private_accounts'
      and constraint_record.contype = 'c'
      and pg_get_constraintdef(constraint_record.oid) like '%preferred_locale%'
      and pg_get_constraintdef(constraint_record.oid) like '%''en''%'
      and pg_get_constraintdef(constraint_record.oid) like '%''fr''%'
  ),
  1::bigint,
  'Preferred locale is constrained to English and French'
);

select is(
  (
    select count(*)
    from pg_constraint constraint_record
    join pg_class class on class.oid = constraint_record.conrelid
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'private_accounts'
      and constraint_record.contype = 'c'
      and pg_get_constraintdef(constraint_record.oid) like '%entry_mode%'
      and pg_get_constraintdef(constraint_record.oid) like '%''create''%'
      and pg_get_constraintdef(constraint_record.oid) like '%''join''%'
  ),
  1::bigint,
  'Entry mode is constrained to create or join'
);

select is(
  (
    select count(*)
    from pg_constraint constraint_record
    join pg_class class on class.oid = constraint_record.conrelid
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'journey_policy_acceptances'
      and constraint_record.contype = 'u'
  ),
  1::bigint,
  'Journey policy acceptance is unique per couple, user, and policy version'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'couple_invites'
      and column_name in ('invite_code', 'code')
  ),
  0::bigint,
  'No plaintext invite-code column exists'
);

select is(
  (
    select count(*)
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    join application_security_definer_functions application_function
      on application_function.function_name = procedure.proname
    where namespace.nspname = 'public'
      and procedure.prosecdef
  ),
  21::bigint,
  'The application privileged-function inventory has the expected size'
);

select is(
  (
    select count(*)
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    join application_security_definer_functions application_function
      on application_function.function_name = procedure.proname
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
  'Every application SECURITY DEFINER function has an approved fixed search path'
);

select is(
  (
    select count(*)
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    join application_security_definer_functions application_function
      on application_function.function_name = procedure.proname
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and has_function_privilege('anon', procedure.oid, 'execute')
  ),
  0::bigint,
  'Anonymous clients cannot execute any application SECURITY DEFINER function'
);

select is(
  (
    select count(*)
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    join application_security_definer_functions application_function
      on application_function.function_name = procedure.proname
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and has_function_privilege('authenticated', procedure.oid, 'execute')
  ),
  10::bigint,
  'Authenticated clients can execute only the ten approved application privileged endpoints'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_account_deletion(uuid)',
    'execute'
  ),
  'Only the server service role receives the account-deletion preparation function'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_account_deletion(uuid)',
    'execute'
  ),
  'Authenticated clients cannot invoke account deletion preparation directly'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name in ('topics', 'questions', 'checklist_definitions')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ),
  0::bigint,
  'Canonical content has no authenticated client write grants'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name = 'journey_policy_acceptances'
  ),
  0::bigint,
  'Journey policy acceptances are writable only inside protected functions'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name = 'answer_reveal_events'
  ),
  0::bigint,
  'Reveal audit records are not directly client-readable or writable'
);

select is(
  (
    select array_agg(privilege_type::text order by privilege_type)
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'couples'
  ),
  array['SELECT']::text[],
  'Couple records expose only a direct SELECT grant controlled by RLS'
);

select ok(
  not has_schema_privilege('anon', 'public', 'create')
    and not has_schema_privilege('authenticated', 'public', 'create'),
  'Client roles cannot create objects in the public schema'
);

select * from finish();
rollback;
