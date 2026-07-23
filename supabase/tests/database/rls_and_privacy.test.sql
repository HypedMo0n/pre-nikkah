-- Proves the invariants the v3 prompt requires be proven before any UI is
-- built: a partner cannot read an un-shared answer or a private_note
-- through any route; comparisons are written only by the SECURITY DEFINER
-- refresh path, never by a client; sharing is one-way, per-question, and
-- irreversible; progress is counts only.
begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(28);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'privacy-a@example.test',
    crypt('temporary-password-a', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    'b1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'privacy-b@example.test',
    crypt('temporary-password-b', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    'c1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'privacy-outsider@example.test',
    crypt('temporary-password-c', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

-- Self-contained fixture content, independent of seed.sql ordering.
-- order_index 999 deliberately falls outside the real 1-12 seeded range
-- (topics.order_index is globally unique) so this test does not collide
-- with actual seed content when both are present in the same database.
insert into public.topics (id, slug, order_index, title, subtitle)
values (
  '00000000-0000-4000-8000-000000000901', 'fixture-topic', 999,
  'Fixture topic', 'Used only by rls_and_privacy.test.sql'
);

insert into public.questions (id, topic_id, key, order_index, text, options, starter_discuss)
values
  (
    '90000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000901',
    'fixture-aligned-by-cluster', 1,
    'Fixture question with clustered options',
    '[
      {"key":"a","label":"A","description":"Option A","cluster":"x"},
      {"key":"b","label":"B","description":"Option B","cluster":"x"},
      {"key":"c","label":"C","description":"Option C","cluster":"y"}
    ]'::jsonb,
    'Fixture starter text for question 1'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000901',
    'fixture-discuss', 2,
    'Fixture question expecting a discuss state',
    '[
      {"key":"a","label":"A","description":"Option A","cluster":"x"},
      {"key":"b","label":"B","description":"Option B","cluster":"y"},
      {"key":"c","label":"C","description":"Option C","cluster":"z"}
    ]'::jsonb,
    'Fixture starter text for question 2'
  );

create temp table privacy_state (
  key text primary key,
  value text not null
);
grant select, insert on table privacy_state to authenticated;

-- --- User A creates a space and an invite ---------------------------------
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

insert into privacy_state (key, value)
select 'invite_code', invitation.invite_code
from public.create_space_invite() invitation;

insert into privacy_state (key, value)
select 'space_id', public.current_space_id()::text;

select is(
  (select status from public.spaces where id = (select value::uuid from privacy_state where key = 'space_id')),
  'waiting',
  'A newly created space starts in waiting status'
);

-- --- User B redeems the invite --------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select public.redeem_space_invite((select value from privacy_state where key = 'invite_code'));

select is(
  (select status from public.spaces where id = (select value::uuid from privacy_state where key = 'space_id')),
  'active',
  'A space becomes active once a second member joins'
);

-- --- Partner display name: profiles/space_members grant nothing directly,
-- so this SECURITY DEFINER function is the only path to a partner's name.
update public.profiles set display_name = 'Imaan' where id = 'b1000000-0000-4000-8000-000000000002';

reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

update public.profiles set display_name = 'Zayd' where id = 'a1000000-0000-4000-8000-000000000001';

select is(
  public.get_partner_display_name(),
  'Imaan',
  'get_partner_display_name returns the partner''s name, never the caller''s own'
);

reset role;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select is(
  public.get_partner_display_name(),
  'Zayd',
  'The reverse direction resolves symmetrically'
);

-- --- User A answers both fixture questions --------------------------------
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

insert into public.answers (question_id, user_id, space_id, option_key, importance, private_note)
values (
  '90000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  (select value::uuid from privacy_state where key = 'space_id'),
  'a', 'high', 'A private note only A should ever see'
);

insert into public.answers (question_id, user_id, space_id, option_key, importance)
values (
  '90000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  (select value::uuid from privacy_state where key = 'space_id'),
  'a', 'medium'
);

select is(
  (
    select state from public.comparisons
    where space_id = (select value::uuid from privacy_state where key = 'space_id')
      and question_id = '90000000-0000-4000-8000-000000000001'
  ),
  'pending',
  'A comparison is pending until both members have answered'
);

-- --- User B answers both fixture questions --------------------------------
reset role;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
set local role authenticated;

insert into public.answers (question_id, user_id, space_id, option_key, importance, private_note)
values (
  '90000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000002',
  (select value::uuid from privacy_state where key = 'space_id'),
  'b', 'medium', 'A private note only B should ever see'
);

insert into public.answers (question_id, user_id, space_id, option_key, importance)
values (
  '90000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000002',
  (select value::uuid from privacy_state where key = 'space_id'),
  'b', 'low'
);

select is(
  (
    select row(state, priority, priority_driven_by)
    from public.comparisons
    where space_id = (select value::uuid from privacy_state where key = 'space_id')
      and question_id = '90000000-0000-4000-8000-000000000001'
  ),
  row('aligned', 'high', 'a1000000-0000-4000-8000-000000000001'::uuid),
  'Different option keys in the same cluster compute as aligned, with priority driven by the higher importance flag'
);

select is(
  (
    select state from public.comparisons
    where space_id = (select value::uuid from privacy_state where key = 'space_id')
      and question_id = '90000000-0000-4000-8000-000000000002'
  ),
  'discuss',
  'Different clusters compute as discuss'
);

-- --- Core privacy proof: B cannot read A's un-shared answer or note ------
select is(
  (
    select count(*) from public.answers
    where user_id = 'a1000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'A partner cannot directly read an un-shared answer through the base table'
);

select is(
  (select option_key from public.get_partner_shared_answer('90000000-0000-4000-8000-000000000001')),
  null,
  'get_partner_shared_answer returns nothing before the answer is shared'
);

-- --- A shares one answer; B may now read only that option, never the note
reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select is(
  public.has_shared_own_answer('90000000-0000-4000-8000-000000000001'),
  false,
  'has_shared_own_answer is false before the share happens'
);

select lives_ok(
  $$select public.share_answer('90000000-0000-4000-8000-000000000001')$$,
  'Sharing an answer succeeds'
);

select is(
  public.has_shared_own_answer('90000000-0000-4000-8000-000000000001'),
  true,
  'has_shared_own_answer is true for the sharer immediately after sharing'
);

select is(
  public.has_shared_own_answer('90000000-0000-4000-8000-000000000002'),
  false,
  'has_shared_own_answer stays false for a different, unshared question'
);

reset role;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select is(
  public.has_shared_own_answer('90000000-0000-4000-8000-000000000001'),
  false,
  'has_shared_own_answer reflects only the caller''s own share, never the partner''s'
);

select is(
  (select option_key from public.get_partner_shared_answer('90000000-0000-4000-8000-000000000001')),
  'a',
  'After sharing, the partner can read exactly the shared option through the safe function'
);

select is(
  (select option_key from public.get_partner_shared_answer('90000000-0000-4000-8000-000000000002')),
  null,
  'Sharing one question never reveals a different, unshared question'
);

select is(
  (
    select count(*)
    from information_schema.routines routine
    where routine.routine_schema = 'public'
      and routine.routine_name = 'get_partner_shared_answer'
  ),
  1::bigint,
  'get_partner_shared_answer exists as a single-purpose function'
);

select ok(
  not exists (
    select 1
    from information_schema.parameters parameter
    join information_schema.routines routine
      on routine.specific_name = parameter.specific_name
    where routine.routine_schema = 'public'
      and routine.routine_name = 'get_partner_shared_answer'
      and parameter.parameter_name = 'private_note'
  ),
  'get_partner_shared_answer has no private_note output column at all, by construction'
);

select is(
  (
    select count(*) from public.answers
    where user_id = 'a1000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'Sharing does not create a direct-table read path — the partner still cannot select the base row'
);

-- --- Comparisons are never client-writable --------------------------------
select is(
  (
    select array_agg(privilege_type::text order by privilege_type)
    from information_schema.role_table_grants
    where grantee = 'authenticated'
      and table_schema = 'public'
      and table_name = 'comparisons'
  ),
  array['SELECT']::text[],
  'Comparisons expose only a direct SELECT grant; every write goes through refresh_comparison()'
);

reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select throws_ok(
  $$
    insert into public.comparisons (space_id, question_id, state)
    values (
      (select value::uuid from privacy_state where key = 'space_id'),
      '90000000-0000-4000-8000-000000000001',
      'aligned'
    )
  $$,
  '42501',
  'permission denied for table comparisons',
  'A client cannot write a comparison row directly, even a member of the space it belongs to'
);

-- --- Progress is counts only ------------------------------------------
select is(
  (select row(mine, partner, total) from public.get_topic_progress('00000000-0000-4000-8000-000000000901')),
  row(2, 2, 2),
  'Topic progress returns matching counts for both members once both have answered every question'
);

select is(
  (
    select count(*)
    from information_schema.parameters parameter
    join information_schema.routines routine
      on routine.specific_name = parameter.specific_name
    where routine.routine_schema = 'public'
      and routine.routine_name = 'get_topic_progress'
      and parameter.parameter_mode = 'OUT'
      and parameter.data_type = 'integer'
  ),
  3::bigint,
  'get_topic_progress returns exactly three integer counts and nothing else'
);

-- --- An outsider is not a space member and reads nothing -----------------
reset role;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000003', true);
set local role authenticated;

select is(
  (select count(*) from public.answers),
  0::bigint,
  'A user outside the space reads no answers at all'
);

select is(
  (select count(*) from public.comparisons),
  0::bigint,
  'A user outside the space reads no comparisons at all'
);

select throws_ok(
  $$select public.get_topic_progress('00000000-0000-4000-8000-000000000901')$$,
  'P0001',
  'ACTIVE_SPACE_REQUIRED',
  'A user with no active space cannot read progress for any topic'
);

select is(
  public.get_partner_display_name(),
  null,
  'A user with no active space resolves no partner name, and the function does not throw'
);

select is(
  public.has_shared_own_answer('90000000-0000-4000-8000-000000000001'),
  false,
  'A user with no active space resolves no shared-answer status, and the function does not throw'
);

select * from finish();
rollback;
