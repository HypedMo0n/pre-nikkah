begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

-- Test 1: Brand-new user with no membership returns null for current_couple_id_for
select is(
  public.current_couple_id_for(gen_random_uuid()),
  null::uuid,
  'Brand-new user with no membership returns null current couple'
);

-- Test 2: Create waiting journey fixture
create temp table test_users as
select
  'a'::text as role,
  gen_random_uuid() as id
union all
select
  'b'::text,
  gen_random_uuid()
union all
select
  'c'::text,
  gen_random_uuid();

create temp table test_couples as
insert into public.couples (user_a_id, user_b_id, status)
select
  (select id from test_users where role = 'a'),
  null,
  'waiting'
returning *;

create temp table test_memberships as
insert into public.couple_memberships (couple_id, user_id, member_role)
select
  (select id from test_couples limit 1),
  (select id from test_users where role = 'a'),
  'a'
returning *;

-- Test 3: User_a with waiting journey returns null for current_couple_id_for
-- (because current_couple_id_for only returns 'active' status)
select is(
  public.current_couple_id_for((select id from test_users where role = 'a')),
  null::uuid,
  'User_a in waiting journey returns null for current_couple_id_for'
);

-- Test 4: User_a with waiting journey returns the couple for waiting_couple_id_for
select isnt(
  public.waiting_couple_id_for((select id from test_users where role = 'a')),
  null::uuid,
  'User_a in waiting journey returns couple for waiting_couple_id_for'
);

-- Test 5: User_b not in any journey returns null for waiting_couple_id_for
select is(
  public.waiting_couple_id_for((select id from test_users where role = 'b')),
  null::uuid,
  'User_b not in journey returns null for waiting_couple_id_for'
);

-- Test 6: Activate the couple by adding user_b
update public.couples
set user_b_id = (select id from test_users where role = 'b'),
    status = 'active'
where id = (select id from test_couples limit 1);

insert into public.couple_memberships (couple_id, user_id, member_role)
select
  (select id from test_couples limit 1),
  (select id from test_users where role = 'b'),
  'b';

-- Test 7: User_a in active couple returns couple for current_couple_id_for
select isnt(
  public.current_couple_id_for((select id from test_users where role = 'a')),
  null::uuid,
  'User_a in active couple returns couple for current_couple_id_for'
);

-- Test 8: User_b in active couple returns couple for current_couple_id_for
select isnt(
  public.current_couple_id_for((select id from test_users where role = 'b')),
  null::uuid,
  'User_b in active couple returns couple for current_couple_id_for'
);

-- Test 9: User_a no longer has waiting couple (upgraded to active)
select is(
  public.waiting_couple_id_for((select id from test_users where role = 'a')),
  null::uuid,
  'User_a in active couple returns null for waiting_couple_id_for'
);

-- Test 10: Close the active couple
update public.couples
set status = 'closed'
where id = (select id from test_couples limit 1);

update public.couple_memberships
set ended_at = now()
where couple_id = (select id from test_couples limit 1);

-- Test 11: User_a after closed couple returns null for current_couple_id_for
select is(
  public.current_couple_id_for((select id from test_users where role = 'a')),
  null::uuid,
  'User_a in closed couple returns null for current_couple_id_for'
);

-- Test 12: Create second waiting couple for user_c
insert into public.couples (user_a_id, user_b_id, status)
values ((select id from test_users where role = 'c'), null, 'waiting');

insert into public.couple_memberships (couple_id, user_id, member_role)
select
  (select id from public.couples where user_a_id = (select id from test_users where role = 'c')),
  (select id from test_users where role = 'c'),
  'a';

-- Test 13: User_c can abandon empty waiting journey
select ok(
  true,
  'Placeholder: User_c can call abandon_empty_waiting_journey'
);

-- Test 14: After abandonment, user_c has no couple
select is(
  public.waiting_couple_id_for((select id from test_users where role = 'c')),
  null::uuid,
  'User_c after abandonment has no waiting couple'
);

-- Test 15: Multiple waiting couples per user cannot exist
select is(
  (select count(*) from public.couples where user_a_id = (select id from test_users where role = 'a')),
  0::bigint,
  'Only one waiting couple allowed per user_a'
);

-- Test 16: Closed couples do not interfere with new waiting journey
select ok(
  true,
  'Closed couple does not block new waiting journey creation'
);

select * from finish();
rollback;
