begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

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
    'a2000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'comparison-a@example.test',
    crypt('temporary-password-a', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'comparison-b@example.test',
    crypt('temporary-password-b', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

create temp table comparison_state (
  key text primary key,
  value text not null
);
grant select on table comparison_state to authenticated;

select set_config(
  'request.jwt.claim.sub',
  'a2000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into comparison_state (key, value)
select 'invite_code', invitation.invite_code
from public.create_couple_invite(public.current_journey_policy_version()) invitation;

insert into comparison_state (key, value)
select 'couple_id', public.current_couple_id()::text;

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b2000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select public.redeem_couple_invite(
  (select value from comparison_state where key = 'invite_code'),
  public.current_journey_policy_version()
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'a2000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

insert into public.answers (question_id, user_id, couple_id, value)
values
  (
    '10000000-0000-4000-8000-000000000101',
    'a2000000-0000-4000-8000-000000000001',
    (select value::uuid from comparison_state where key = 'couple_id'),
    to_jsonb('mostly_consistent'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    'a2000000-0000-4000-8000-000000000001',
    (select value::uuid from comparison_state where key = 'couple_id'),
    '1'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000105',
    'a2000000-0000-4000-8000-000000000001',
    (select value::uuid from comparison_state where key = 'couple_id'),
    to_jsonb('A private text response from participant A.'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000203',
    'a2000000-0000-4000-8000-000000000001',
    (select value::uuid from comparison_state where key = 'couple_id'),
    to_jsonb('none'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000307',
    'a2000000-0000-4000-8000-000000000001',
    (select value::uuid from comparison_state where key = 'couple_id'),
    to_jsonb('Private context A.'::text)
  );

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b2000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

insert into public.answers (question_id, user_id, couple_id, value)
values
  (
    '10000000-0000-4000-8000-000000000101',
    'b2000000-0000-4000-8000-000000000002',
    (select value::uuid from comparison_state where key = 'couple_id'),
    to_jsonb('mostly_consistent'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    'b2000000-0000-4000-8000-000000000002',
    (select value::uuid from comparison_state where key = 'couple_id'),
    '1'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000104',
    'b2000000-0000-4000-8000-000000000002',
    (select value::uuid from comparison_state where key = 'couple_id'),
    '3'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000105',
    'b2000000-0000-4000-8000-000000000002',
    (select value::uuid from comparison_state where key = 'couple_id'),
    to_jsonb('A different private text response from participant B.'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000203',
    'b2000000-0000-4000-8000-000000000002',
    (select value::uuid from comparison_state where key = 'couple_id'),
    to_jsonb('needs_plan'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000307',
    'b2000000-0000-4000-8000-000000000002',
    (select value::uuid from comparison_state where key = 'couple_id'),
    to_jsonb('Private context B.'::text)
  );

select is(
  (select bucket from public.get_question_comparison('10000000-0000-4000-8000-000000000101')),
  'aligned',
  'Matching stable single-option IDs are aligned'
);

select is(
  (select bucket from public.get_question_comparison('10000000-0000-4000-8000-000000000102')),
  'aligned',
  'Scale distance zero is aligned'
);

select ok(
  (
    select bucket = 'worth_discussing'
      and partner_answer is null
    from public.get_question_comparison('10000000-0000-4000-8000-000000000105')
  ),
  'Text responses use a neutral discussion bucket without comparing wording'
);

select is(
  (select status from public.get_question_comparison('10000000-0000-4000-8000-000000000103')),
  'waiting_for_you',
  'A missing requesting-user answer returns waiting_for_you'
);

select is(
  (select status from public.get_question_comparison('10000000-0000-4000-8000-000000000104')),
  'waiting_for_partner',
  'A missing partner answer returns waiting_for_partner'
);

select is(
  (select bucket from public.get_question_comparison('10000000-0000-4000-8000-000000000203')),
  'worth_discussing',
  'A sensitive single-choice discussion-only question is never scored as a concern'
);

select ok(
  (
    select bucket = 'worth_discussing'
      and partner_answer is null
      and not partner_answer_revealed
    from public.get_question_comparison('10000000-0000-4000-8000-000000000307')
  ),
  'Never-compare mode returns a neutral prompt without a partner value'
);

select throws_ok(
  format(
    'insert into public.answers (question_id, user_id, couple_id, value) values (%L, %L, %L, to_jsonb(%L::text))',
    '10000000-0000-4000-8000-000000000106',
    'b2000000-0000-4000-8000-000000000002',
    (select value from comparison_state where key = 'couple_id'),
    'invalid_option_id'
  ),
  'P0001',
  'ANSWER_VALUE_INVALID',
  'An invalid single-option ID is rejected'
);

select throws_ok(
  format(
    'insert into public.answers (question_id, user_id, couple_id, value) values (%L, %L, %L, %L::jsonb)',
    '10000000-0000-4000-8000-000000000407',
    'b2000000-0000-4000-8000-000000000002',
    (select value from comparison_state where key = 'couple_id'),
    '6'
  ),
  'P0001',
  'ANSWER_VALUE_INVALID',
  'An invalid scale value is rejected'
);

update public.answers
set value = to_jsonb('very_structured'::text)
where question_id = '10000000-0000-4000-8000-000000000101';

select is(
  (select bucket from public.get_question_comparison('10000000-0000-4000-8000-000000000101')),
  'worth_discussing',
  'Different stable single-option IDs are worth discussing'
);

update public.answers set value = '2'::jsonb
where question_id = '10000000-0000-4000-8000-000000000102';
select is((select bucket from public.get_question_comparison('10000000-0000-4000-8000-000000000102')), 'aligned', 'Scale distance one is aligned');

update public.answers set value = '3'::jsonb
where question_id = '10000000-0000-4000-8000-000000000102';
select is((select bucket from public.get_question_comparison('10000000-0000-4000-8000-000000000102')), 'worth_discussing', 'Scale distance two is worth discussing');

update public.answers set value = '4'::jsonb
where question_id = '10000000-0000-4000-8000-000000000102';
select is((select bucket from public.get_question_comparison('10000000-0000-4000-8000-000000000102')), 'possible_concern', 'Scale distance three is a possible concern');

update public.answers set value = '5'::jsonb
where question_id = '10000000-0000-4000-8000-000000000102';
select is((select bucket from public.get_question_comparison('10000000-0000-4000-8000-000000000102')), 'possible_concern', 'Scale distance four is a possible concern');

select * from finish();
rollback;
