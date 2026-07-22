-- Proves abandon_empty_waiting_journey() (as replaced by
-- supabase/migrations/20260722000100_idempotent_abandon_empty_waiting_journey.sql)
-- is idempotent: calling it when there is nothing eligible to abandon is a
-- successful no-op rather than a raised exception, in every "not eligible"
-- case the application can reach it through, while still only ever
-- deleting the calling user's own empty solo-waiting journey.
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
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'abandon-a@example.test', crypt('temporary-password-a', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'abandon-b@example.test', crypt('temporary-password-b', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e3000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'abandon-c@example.test', crypt('temporary-password-c', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e4000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'abandon-d@example.test', crypt('temporary-password-d', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('e5000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'abandon-e@example.test', crypt('temporary-password-e', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

create temp table abandon_state (
  key text primary key,
  value text not null
);
grant select, insert on table abandon_state to authenticated;

select ok(
  not has_function_privilege('anon', 'public.abandon_empty_waiting_journey()', 'execute'),
  'Anonymous clients cannot execute journey abandonment; idempotency does not loosen authorization'
);

-- User A: has never created or joined any journey. Nothing to abandon.
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.abandon_empty_waiting_journey()$$,
  'Abandoning with no journey at all is a successful no-op, not an error'
);

-- Users B and C: B creates a solo waiting journey with nothing else attached.
reset role;
select set_config('request.jwt.claim.sub', 'e2000000-0000-4000-8000-000000000002', true);
set local role authenticated;

insert into abandon_state (key, value)
select 'empty_invite_code', invitation.invite_code
from public.create_couple_invite(public.current_journey_policy_version()) invitation;

insert into abandon_state (key, value)
select 'couple_id', public.current_couple_id()::text;

select lives_ok(
  $$select public.abandon_empty_waiting_journey()$$,
  'Abandoning a genuinely empty solo-waiting journey succeeds'
);

select is(
  (
    select count(*)
    from public.couples couple
    where couple.id = (select value::uuid from abandon_state where key = 'couple_id')
  ),
  0::bigint,
  'The empty solo-waiting journey is actually deleted'
);

select lives_ok(
  $$select public.abandon_empty_waiting_journey()$$,
  'Calling abandon again immediately after, with nothing left, is still a no-op rather than an error'
);

-- Users D and E: D creates an invite, E redeems it, producing a genuinely
-- active (not empty-waiting) couple. Abandoning while active must be a
-- no-op that leaves the active journey untouched.
reset role;
select set_config('request.jwt.claim.sub', 'e4000000-0000-4000-8000-000000000004', true);
set local role authenticated;

insert into abandon_state (key, value)
select 'active_invite_code', invitation.invite_code
from public.create_couple_invite(public.current_journey_policy_version()) invitation;

insert into abandon_state (key, value)
select 'active_couple_id', public.current_couple_id()::text;

reset role;
select set_config('request.jwt.claim.sub', 'e5000000-0000-4000-8000-000000000005', true);
set local role authenticated;

select public.redeem_couple_invite(
  (select value from abandon_state where key = 'active_invite_code'),
  public.current_journey_policy_version()
);

reset role;
select set_config('request.jwt.claim.sub', 'e4000000-0000-4000-8000-000000000004', true);
set local role authenticated;

select lives_ok(
  $$select public.abandon_empty_waiting_journey()$$,
  'Abandoning while the journey is active (not a solo-waiting state) is a no-op, not an error'
);

select is(
  (
    select couple.status
    from public.couples couple
    where couple.id = (select value::uuid from abandon_state where key = 'active_couple_id')
  ),
  'active',
  'An active journey is never deleted by journey abandonment'
);

-- User C: a solo-waiting journey that already has an answer attached is
-- not "empty" and must not be deleted, even though it is still waiting.
reset role;
select set_config('request.jwt.claim.sub', 'e3000000-0000-4000-8000-000000000003', true);
set local role authenticated;

insert into abandon_state (key, value)
select 'nonempty_invite_code', invitation.invite_code
from public.create_couple_invite(public.current_journey_policy_version()) invitation;

insert into abandon_state (key, value)
select 'nonempty_couple_id', public.current_couple_id()::text;

insert into public.answers (question_id, user_id, couple_id, value)
values (
  '10000000-0000-4000-8000-000000000101',
  'e3000000-0000-4000-8000-000000000003',
  (select value::uuid from abandon_state where key = 'nonempty_couple_id'),
  to_jsonb('mostly_consistent'::text)
);

select lives_ok(
  $$select public.abandon_empty_waiting_journey()$$,
  'Abandoning a solo-waiting journey that already has an answer is a no-op, not an error'
);

select is(
  (
    select count(*)
    from public.couples couple
    where couple.id = (select value::uuid from abandon_state where key = 'nonempty_couple_id')
  ),
  1::bigint,
  'A non-empty waiting journey is never deleted by journey abandonment'
);

select * from finish();
rollback;
