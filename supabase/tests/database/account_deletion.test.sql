begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

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
    'a1000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'deletion-a@example.test',
    crypt('temporary-password-a', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'deletion-b@example.test',
    crypt('temporary-password-b', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'c1000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'waiting-deletion@example.test',
    crypt('temporary-password-c', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

create temp table deletion_state (
  key text primary key,
  value text not null
);
grant select, insert on table deletion_state to authenticated;

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into deletion_state (key, value)
select 'invite_code', invitation.invite_code
from public.create_couple_invite(public.current_journey_policy_version()) invitation;

insert into deletion_state (key, value)
select 'couple_id', public.current_couple_id()::text;

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select public.redeem_couple_invite(
  (select value from deletion_state where key = 'invite_code'),
  public.current_journey_policy_version()
);

reset role;
select is(
  (
    select status
    from public.couples
    where id = (select value::uuid from deletion_state where key = 'couple_id')
  ),
  'active',
  'Deletion fixture begins with an active accepted journey'
);

select set_config(
  'request.jwt.claim.sub',
  'a1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

insert into public.answers (question_id, user_id, couple_id, value, revealed)
values (
  '10000000-0000-4000-8000-000000000101',
  'a1000000-0000-4000-8000-000000000001',
  (select value::uuid from deletion_state where key = 'couple_id'),
  to_jsonb('mostly_consistent'::text),
  true
);

insert into public.guided_discussions (
  couple_id,
  topic_id,
  question_id,
  status,
  shared_note
)
values (
  (select value::uuid from deletion_state where key = 'couple_id'),
  '00000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  'discussed',
  'A shared note that must be removed.'
);

insert into public.couple_checklist_items (
  couple_id,
  checklist_definition_id,
  done
)
values (
  (select value::uuid from deletion_state where key = 'couple_id'),
  '20000000-0000-4000-8000-000000000001',
  true
);

insert into public.topic_progress (couple_id, topic_id, user_id)
values (
  (select value::uuid from deletion_state where key = 'couple_id'),
  '00000000-0000-4000-8000-000000000101',
  'a1000000-0000-4000-8000-000000000001'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

insert into public.answers (question_id, user_id, couple_id, value)
values (
  '10000000-0000-4000-8000-000000000101',
  'b1000000-0000-4000-8000-000000000002',
  (select value::uuid from deletion_state where key = 'couple_id'),
  to_jsonb('private_and_evolving'::text)
);

insert into public.topic_progress (couple_id, topic_id, user_id)
values (
  (select value::uuid from deletion_state where key = 'couple_id'),
  '00000000-0000-4000-8000-000000000101',
  'b1000000-0000-4000-8000-000000000002'
);

reset role;

select is(
  (select count(*) from public.answers where couple_id = (select value::uuid from deletion_state where key = 'couple_id')),
  2::bigint,
  'Both participants have journey-scoped answers before deletion'
);

select is(
  (select count(*) from public.answer_reveal_events),
  1::bigint,
  'The fixture includes answer-specific reveal audit data'
);

select is(
  (select count(*) from public.journey_policy_acceptances where couple_id = (select value::uuid from deletion_state where key = 'couple_id')),
  2::bigint,
  'The fixture includes both journey-policy acceptances'
);

set local role service_role;
select public.prepare_account_deletion(
  'a1000000-0000-4000-8000-000000000001'
);
reset role;

select is((select count(*) from public.couples where id = (select value::uuid from deletion_state where key = 'couple_id')), 0::bigint, 'Account deletion removes the couple journey');
select is((select count(*) from public.answers where couple_id = (select value::uuid from deletion_state where key = 'couple_id')), 0::bigint, 'Account deletion removes both participants answers');
select is((select count(*) from public.answer_reveal_events), 0::bigint, 'Account deletion removes reveal audit data');
select is((select count(*) from public.guided_discussions), 0::bigint, 'Account deletion removes shared notes');
select is((select count(*) from public.couple_checklist_items), 0::bigint, 'Account deletion removes checklist state');
select is((select count(*) from public.topic_progress where couple_id = (select value::uuid from deletion_state where key = 'couple_id')), 0::bigint, 'Account deletion removes topic progress');
select is((select count(*) from public.couple_memberships where couple_id = (select value::uuid from deletion_state where key = 'couple_id')), 0::bigint, 'Account deletion removes active memberships');
select is((select count(*) from public.journey_policy_acceptances where couple_id = (select value::uuid from deletion_state where key = 'couple_id')), 0::bigint, 'Account deletion removes policy acceptances');
select is((select count(*) from public.couple_invites where couple_id = (select value::uuid from deletion_state where key = 'couple_id')), 0::bigint, 'Account deletion invalidates journey invitations');
select is((select count(*) from public.private_accounts where id = 'b1000000-0000-4000-8000-000000000002'), 1::bigint, 'The remaining participant keeps only their private account');
select is((select count(*) from public.private_accounts where id = 'a1000000-0000-4000-8000-000000000001'), 1::bigint, 'The private account remains until the Auth Admin deletion step');
select is((select count(*) from public.journey_closure_notices where user_id = 'b1000000-0000-4000-8000-000000000002' and reason = 'partner_account_deleted'), 1::bigint, 'The remaining participant receives one content-free journey-ended notice');

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select is(
  public.get_connection_overview() ->> 'status',
  'not_connected',
  'The remaining participant cannot access the deleted journey'
);
reset role;

delete from auth.users
where id = 'a1000000-0000-4000-8000-000000000001';

select is((select count(*) from auth.users where id = 'a1000000-0000-4000-8000-000000000001'), 0::bigint, 'The Auth identity deletion step removes the requesting Auth user');
select is((select count(*) from public.private_accounts where id = 'a1000000-0000-4000-8000-000000000001'), 0::bigint, 'Deleting the Auth identity cascades the requesting private account');

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

insert into deletion_state (key, value)
select 'waiting_invite_id', invitation.invite_id::text
from public.create_couple_invite(public.current_journey_policy_version()) invitation;

reset role;
select is(
  (select count(*) from public.couple_invites where id = (select value::uuid from deletion_state where key = 'waiting_invite_id')),
  1::bigint,
  'A separate deletion fixture has an outstanding unused invitation'
);

set local role service_role;
select public.prepare_account_deletion(
  'c1000000-0000-4000-8000-000000000003'
);
reset role;

select is(
  (select count(*) from public.couple_invites where id = (select value::uuid from deletion_state where key = 'waiting_invite_id')),
  0::bigint,
  'Deleting a waiting owner permanently invalidates the outstanding invitation'
);

select is(
  (
    select count(*)
    from public.couples
    where user_a_id = 'c1000000-0000-4000-8000-000000000003'
       or user_b_id = 'c1000000-0000-4000-8000-000000000003'
  ),
  0::bigint,
  'Deleting a waiting owner removes the waiting journey'
);

delete from auth.users
where id = 'c1000000-0000-4000-8000-000000000003';

select is(
  (select count(*) from public.private_accounts where id = 'c1000000-0000-4000-8000-000000000003'),
  0::bigint,
  'The Auth deletion step removes the waiting owner private account'
);

select * from finish();
rollback;
