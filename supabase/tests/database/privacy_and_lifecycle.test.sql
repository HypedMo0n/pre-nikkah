begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(35);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member-a@example.test',
    crypt('test-password-a', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Member A","locale":"en"}',
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member-b@example.test',
    crypt('test-password-b', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Member B","locale":"fr"}',
    now(),
    now()
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'outsider@example.test',
    crypt('test-password-c', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Outsider"}',
    now(),
    now()
  );

create temp table test_state (
  key text primary key,
  value text not null
);
grant select, insert, update on table test_state to authenticated;

insert into test_state (key, value)
select 'question_id', question.id::text
from public.questions question
order by question.order_index
limit 1;

insert into test_state (key, value)
select 'option_a', option.key
from public.question_options option
where option.question_id = (select value::uuid from test_state where key = 'question_id')
order by option.order_index
limit 1;

insert into test_state (key, value)
select 'option_b', option.key
from public.question_options option
where option.question_id = (select value::uuid from test_state where key = 'question_id')
  and option.cluster <> (
    select first_option.cluster
    from public.question_options first_option
    where first_option.question_id = (select value::uuid from test_state where key = 'question_id')
    order by first_option.order_index
    limit 1
  )
order by option.order_index
limit 1;

select is((select count(*) from public.profiles), 3::bigint, 'Auth registration creates one private profile per user');
select is((select display_name from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'Member A', 'Display name is copied from safe auth metadata');
select is((select locale from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 'fr', 'Supported locale is copied from auth metadata');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

create temp table created_space as
select * from public.create_space();
grant select on table created_space to authenticated;

insert into test_state (key, value)
select 'space_id', created.space_id::text from created_space created;

insert into test_state (key, value)
select 'invite_code', created.invite_code from created_space created;

select is(
  char_length((select value from test_state where key = 'invite_code')),
  20,
  'A new space returns a twenty-character opaque invite code once'
);

select isnt(
  (
    select space.invite_code_hash
    from public.spaces space
    where space.id = (select value::uuid from test_state where key = 'space_id')
  ),
  (select value from test_state where key = 'invite_code'),
  'The plaintext invitation code is not stored'
);

select is(
  public.get_space_overview() ->> 'status',
  'waiting',
  'The creator sees a waiting space before their partner joins'
);

select throws_ok(
  $$insert into public.answers (space_id, question_id, user_id, option_key)
    values (
      (select value::uuid from test_state where key = 'space_id'),
      (select value::uuid from test_state where key = 'question_id'),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      (select value from test_state where key = 'option_a')
    )$$,
  '42501',
  null,
  'Clients cannot bypass save_answer with a direct answer insert'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);

select is(
  public.inspect_space_invite((select value from test_state where key = 'invite_code')) ->> 'status',
  'available',
  'The intended second member can inspect an available invitation'
);

select is(
  public.redeem_space_invite((select value from test_state where key = 'invite_code')),
  (select value::uuid from test_state where key = 'space_id'),
  'The second member redeems the invitation'
);

select is(
  public.get_space_overview() #>> '{partner,displayName}',
  'Member A',
  'The joined member sees only the partner identity needed by the product'
);

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);

select throws_ok(
  format(
    'select public.redeem_space_invite(%L)',
    (select value from test_state where key = 'invite_code')
  ),
  'P0001',
  'INVITE_ALREADY_USED',
  'A redeemed invitation cannot add a third member'
);

select is(
  (select count(*) from public.spaces),
  0::bigint,
  'An outsider cannot discover an active private space'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select lives_ok(
  format(
    'select public.save_answer(%L, %L, %L, %L, %L)',
    (select value from test_state where key = 'space_id'),
    (select value from test_state where key = 'question_id'),
    (select value from test_state where key = 'option_a'),
    'high',
    'My private context'
  ),
  'The first member can save an answer and a private note through the endpoint'
);

insert into test_state (key, value)
select 'answer_a_id', answer.id::text
from public.answers answer
where answer.space_id = (select value::uuid from test_state where key = 'space_id')
  and answer.question_id = (select value::uuid from test_state where key = 'question_id');

select is((select count(*) from public.answers), 1::bigint, 'A member can read their own exact answer');
select is((select count(*) from public.private_answer_notes), 1::bigint, 'A member can read their own private note');

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);

select is((select count(*) from public.answers), 0::bigint, 'A partner cannot read an unshared exact answer');
select is((select count(*) from public.private_answer_notes), 0::bigint, 'A partner cannot read a private note');
select is(
  (select state from public.comparisons where question_id = (select value::uuid from test_state where key = 'question_id')),
  'pending',
  'The server exposes only a pending comparison before both people answer'
);

select lives_ok(
  format(
    'select public.save_answer(%L, %L, %L, %L, null)',
    (select value from test_state where key = 'space_id'),
    (select value from test_state where key = 'question_id'),
    (select value from test_state where key = 'option_b'),
    'high'
  ),
  'The second member can save their independent answer'
);

select is(
  (select state from public.comparisons where question_id = (select value::uuid from test_state where key = 'question_id')),
  'discuss',
  'Different answer clusters produce a discuss result without exposing either option'
);

select is(
  (
    select cardinality(high_priority_user_ids)
    from public.comparisons
    where question_id = (select value::uuid from test_state where key = 'question_id')
  ),
  2,
  'Both high-importance participants are represented without exposing answer values'
);

select is((select count(*) from public.answers), 1::bigint, 'The second member still sees only their own exact answer');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select lives_ok(
  format(
    'select public.share_answer(%L)',
    (select value from test_state where key = 'answer_a_id')
  ),
  'The owner can explicitly share an exact answer once'
);

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
select is((select count(*) from public.answers), 2::bigint, 'The recipient can read the explicitly shared exact answer');
select is((select count(*) from public.private_answer_notes), 0::bigint, 'Sharing an answer never shares its private note');

select lives_ok(
  format(
    'select public.add_shared_note(%L, %L, %L)',
    (select value from test_state where key = 'space_id'),
    (select value from test_state where key = 'question_id'),
    'A note we chose to share'
  ),
  'A member can intentionally add a shared conversation note'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select is((select count(*) from public.shared_notes), 1::bigint, 'Both members can read an intentionally shared note');

select lives_ok(
  format(
    'select public.mark_question_discussed(%L, %L)',
    (select value from test_state where key = 'space_id'),
    (select value from test_state where key = 'question_id')
  ),
  'A member can mark a comparison as discussed'
);

select is(
  (
    select count(*)
    from public.get_topic_progress(
      (select value::uuid from test_state where key = 'space_id'),
      (select topic_id from public.questions where id = (select value::uuid from test_state where key = 'question_id'))
    )
    where answered_count = 1 and question_count = 6
  ),
  2::bigint,
  'Progress reveals counts for both members but no exact answers'
);

select lives_ok(
  $$select public.set_space_paused(true)$$,
  'Either member can pause the shared space'
);

select throws_ok(
  format(
    'select public.save_answer(%L, %L, %L, %L, null)',
    (select value from test_state where key = 'space_id'),
    (select value from test_state where key = 'question_id'),
    (select value from test_state where key = 'option_a'),
    'medium'
  ),
  'P0001',
  'SPACE_PAUSED',
  'Private answers cannot change while the space is paused'
);

select throws_ok(
  format(
    'select public.add_shared_note(%L, %L, %L)',
    (select value from test_state where key = 'space_id'),
    (select value from test_state where key = 'question_id'),
    'This must not be written while paused'
  ),
  'P0001',
  'SPACE_PAUSED',
  'Shared notes cannot change while the space is paused'
);

select lives_ok(
  $$select public.set_space_paused(false)$$,
  'The space can be resumed without losing its private history'
);

reset role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  format(
    'select public.prepare_account_deletion(%L)',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  'The service deletion endpoint clears the shared space before auth deletion'
);

select is(
  (
    select count(*)
    from public.spaces
    where id = (select value::uuid from test_state where key = 'space_id')
  ),
  0::bigint,
  'Deleting either account removes the shared space and all dependent private data'
);

select * from finish();
rollback;
