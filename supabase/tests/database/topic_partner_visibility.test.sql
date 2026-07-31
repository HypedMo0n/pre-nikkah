begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'member-a@example.test',
    crypt('test-password-a', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Member A","locale":"en"}', now(), now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'member-b@example.test',
    crypt('test-password-b', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Member B","locale":"en"}', now(), now()
  );

create temp table test_state (key text primary key, value text not null);
grant select, insert, update on table test_state to authenticated;

-- Topic one is the current shared topic; topic two is a later one that the
-- partner has quietly worked ahead on.
insert into test_state (key, value)
select 'topic_one', topic.id::text from public.topics topic
order by topic.order_index limit 1;

insert into test_state (key, value)
select 'topic_two', topic.id::text from public.topics topic
order by topic.order_index offset 1 limit 1;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

create temp table created_space as select * from public.create_space();
grant select on table created_space to authenticated;
insert into test_state (key, value)
select 'space_id', created.space_id::text from created_space created;
insert into test_state (key, value)
select 'invite_code', created.invite_code from created_space created;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
select lives_ok(
  format('select public.redeem_space_invite(%L)', (select value from test_state where key = 'invite_code')),
  'The partner joins the space'
);

-- Member B answers every question in topic two, a topic the couple has not
-- reached together.
do $$
declare
  v_question record;
begin
  for v_question in
    select question.id, option.key
    from public.questions question
    join public.question_options option on option.question_id = question.id
    where question.topic_id = (select value::uuid from test_state where key = 'topic_two')
      and option.order_index = 1
  loop
    perform public.save_answer(
      (select value::uuid from test_state where key = 'space_id'),
      v_question.id,
      v_question.key,
      'medium',
      null
    );
  end loop;
end;
$$;

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select is(
  public.current_topic_id((select value::uuid from test_state where key = 'space_id')),
  (select value::uuid from test_state where key = 'topic_one'),
  'The first topic the couple has not discussed is the current shared topic'
);

select ok(
  public.can_read_topic_partner_state(
    (select value::uuid from test_state where key = 'space_id'),
    (select value::uuid from test_state where key = 'topic_one')
  ),
  'Partner state is readable for the current shared topic'
);

select ok(
  not public.can_read_topic_partner_state(
    (select value::uuid from test_state where key = 'space_id'),
    (select value::uuid from test_state where key = 'topic_two')
  ),
  'Partner state is withheld for a topic the couple has not reached'
);

-- The load-bearing assertion: calling the RPC directly for a later topic must
-- not reveal that the partner has worked ahead on it.
select is(
  (
    select count(*)
    from public.get_topic_progress(
      (select value::uuid from test_state where key = 'space_id'),
      (select value::uuid from test_state where key = 'topic_two')
    ) progress_row
    where progress_row.user_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  0::bigint,
  'The progress RPC returns no partner row for a non-current topic'
);

select isnt_empty(
  format(
    $$select 1 from public.get_topic_progress(%L, %L)
      where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$,
    (select value from test_state where key = 'space_id'),
    (select value from test_state where key = 'topic_two')
  ),
  'The caller still sees their own progress on every topic'
);

select is(
  (
    select count(*)
    from public.get_topic_progress(
      (select value::uuid from test_state where key = 'space_id'),
      (select value::uuid from test_state where key = 'topic_one')
    ) progress_row
  ),
  2::bigint,
  'Both members are returned for the current shared topic'
);

-- Comparison rows disclose that both partners answered, so the same rule
-- applies to reading them directly.
select is_empty(
  format(
    $$select comparison.question_id
      from public.comparisons comparison
      join public.questions question on question.id = comparison.question_id
      where question.topic_id = %L$$,
    (select value from test_state where key = 'topic_two')
  ),
  'Comparisons for a non-current topic are not readable'
);

select throws_ok(
  format(
    'select public.get_topic_progress(%L, %L)',
    '00000000-0000-4000-8000-00000000dead',
    (select value from test_state where key = 'topic_one')
  ),
  'P0001',
  'SPACE_REQUIRED',
  'The progress RPC still refuses a space the caller is not in'
);

reset role;

select * from finish();
rollback;
