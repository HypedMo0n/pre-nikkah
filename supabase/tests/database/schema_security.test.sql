begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

create temp table application_security_definer_functions (
  function_name name primary key
);

insert into application_security_definer_functions (function_name)
values
  ('handle_new_auth_user'),
  ('is_space_member_for'),
  ('is_current_user_space_member'),
  ('current_space_id_for'),
  ('current_space_id'),
  ('get_or_create_current_space'),
  ('create_space_invite'),
  ('redeem_space_invite'),
  ('inspect_space_invite'),
  ('revoke_space_invite'),
  ('validate_answer_write'),
  ('share_answer'),
  ('get_partner_shared_answer'),
  ('refresh_comparison'),
  ('answers_refresh_comparison'),
  ('get_topic_progress'),
  ('emit_partner_joined_event'),
  ('emit_note_added_event'),
  ('emit_answer_shared_event'),
  ('emit_topic_finished_event'),
  ('pause_space'),
  ('resume_space'),
  ('unlink_partner'),
  ('prepare_account_deletion');

select is(
  (
    select count(*)
    from pg_class class
    join pg_namespace namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relkind = 'r'
  ),
  13::bigint,
  'The public schema contains exactly the thirteen approved tables'
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
  13::bigint,
  'RLS is enabled on every public table'
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
  23::bigint,
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
  13::bigint,
  'Authenticated clients can execute only the thirteen approved application privileged endpoints'
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
      and table_name in ('topics', 'questions')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
  ),
  0::bigint,
  'Canonical content has no authenticated client write grants'
);

select * from finish();
rollback;
