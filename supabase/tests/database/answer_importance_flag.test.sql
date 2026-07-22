-- Proves the columns added by
-- supabase/migrations/20260721000100_answer_importance_flag.sql exist,
-- accept only their approved values, default correctly when omitted, round
-- trip through the same upsert shape the application uses, and remain
-- subject to the same owner-only privacy boundary as the rest of the
-- answers row (no separate, looser visibility rule for these columns).
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'f1000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'importance-a@example.test',
    crypt('temporary-password-a', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'f2000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'importance-b@example.test',
    crypt('temporary-password-b', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

create temp table importance_state (
  key text primary key,
  value text not null
);
grant select, insert on table importance_state to authenticated;

select set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into importance_state (key, value)
select 'invite_code', invitation.invite_code
from public.create_couple_invite(public.current_journey_policy_version()) invitation;

insert into importance_state (key, value)
select 'couple_id', public.current_couple_id()::text;

reset role;
select set_config(
  'request.jwt.claim.sub',
  'f2000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select public.redeem_couple_invite(
  (select value from importance_state where key = 'invite_code'),
  public.current_journey_policy_version()
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

-- Question 301 lives in topic 00000000-0000-4000-8000-000000000103
-- (family-boundaries-and-involvement), the acceptance-criterion topic.
insert into public.answers (question_id, user_id, couple_id, value, importance, discussion_preference)
values (
  '10000000-0000-4000-8000-000000000301',
  'f1000000-0000-4000-8000-000000000001',
  (select value::uuid from importance_state where key = 'couple_id'),
  '2'::jsonb,
  'essential',
  'together'
);

select is(
  (
    select answer.importance
    from public.answers answer
    where answer.question_id = '10000000-0000-4000-8000-000000000301'
      and answer.user_id = 'f1000000-0000-4000-8000-000000000001'
  ),
  'essential',
  'An explicit importance value round-trips on insert'
);

select is(
  (
    select answer.discussion_preference
    from public.answers answer
    where answer.question_id = '10000000-0000-4000-8000-000000000301'
      and answer.user_id = 'f1000000-0000-4000-8000-000000000001'
  ),
  'together',
  'An explicit discussion_preference value round-trips on insert'
);

-- Same upsert shape features/answers/save-action.ts uses in production.
insert into public.answers (question_id, user_id, couple_id, value, importance)
values (
  '10000000-0000-4000-8000-000000000301',
  'f1000000-0000-4000-8000-000000000001',
  (select value::uuid from importance_state where key = 'couple_id'),
  '3'::jsonb,
  'non_negotiable'
)
on conflict (question_id, user_id, couple_id)
do update set value = excluded.value, importance = excluded.importance;

select is(
  (
    select answer.importance
    from public.answers answer
    where answer.question_id = '10000000-0000-4000-8000-000000000301'
      and answer.user_id = 'f1000000-0000-4000-8000-000000000001'
  ),
  'non_negotiable',
  'importance round-trips through the same upsert conflict target the save action uses'
);

insert into public.answers (question_id, user_id, couple_id, value)
values (
  '10000000-0000-4000-8000-000000000302',
  'f1000000-0000-4000-8000-000000000001',
  (select value::uuid from importance_state where key = 'couple_id'),
  to_jsonb('both_agree'::text)
);

select is(
  (
    select answer.importance
    from public.answers answer
    where answer.question_id = '10000000-0000-4000-8000-000000000302'
      and answer.user_id = 'f1000000-0000-4000-8000-000000000001'
  ),
  'flexible',
  'importance defaults to flexible when omitted'
);

select is(
  (
    select answer.discussion_preference
    from public.answers answer
    where answer.question_id = '10000000-0000-4000-8000-000000000302'
      and answer.user_id = 'f1000000-0000-4000-8000-000000000001'
  ),
  null,
  'discussion_preference defaults to null when omitted'
);

select throws_ok(
  $$
    insert into public.answers (question_id, user_id, couple_id, value, importance)
    values (
      '10000000-0000-4000-8000-000000000304',
      'f1000000-0000-4000-8000-000000000001',
      (select value::uuid from importance_state where key = 'couple_id'),
      to_jsonb('We would talk with them directly.'::text),
      'not_a_real_value'
    )
  $$,
  '23514',
  'An out-of-range importance value is rejected'
);

select throws_ok(
  $$
    insert into public.answers (question_id, user_id, couple_id, value, discussion_preference)
    values (
      '10000000-0000-4000-8000-000000000305',
      'f1000000-0000-4000-8000-000000000001',
      (select value::uuid from importance_state where key = 'couple_id'),
      to_jsonb('depends_on_need'::text),
      'not_a_real_value'
    )
  $$,
  '23514',
  'An out-of-range discussion_preference value is rejected'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'f2000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.answers answer
    where answer.user_id = 'f1000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'A partner cannot directly read another user importance or discussion_preference (same owner-only boundary as the rest of the row)'
);

reset role;

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'answers'
      and column_name in ('importance', 'discussion_preference')
  ),
  2::bigint,
  'The answers table exposes both the importance and discussion_preference columns'
);

select * from finish();
rollback;
