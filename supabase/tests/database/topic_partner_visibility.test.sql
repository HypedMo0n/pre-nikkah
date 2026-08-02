begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

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

-- Checked as postgres: the helper is deliberately not executable by an
-- authenticated caller, which is asserted at the end of this file.
set local role postgres;
select is(
  public.current_topic_id((select value::uuid from test_state where key = 'space_id')),
  (select value::uuid from test_state where key = 'topic_one'),
  'The first topic the couple has not discussed is the current shared topic'
);
set local role authenticated;

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

-- save_answer returns the comparison state and a partnerReady flag, which for a
-- later topic would disclose whether the partner answered that exact question.
-- Member B has already answered every topic-two question, so an unguarded
-- result here would come back ready.
select is(
  (
    select public.save_answer(
      (select value::uuid from test_state where key = 'space_id'),
      (select question.id from public.questions question
       where question.topic_id = (select value::uuid from test_state where key = 'topic_two')
       order by question.order_index limit 1),
      (select option.key from public.question_options option
       where option.question_id = (
         select question.id from public.questions question
         where question.topic_id = (select value::uuid from test_state where key = 'topic_two')
         order by question.order_index limit 1)
       order by option.order_index limit 1),
      'medium',
      null
    ) ? 'partnerReady'
  ),
  false,
  'save_answer withholds partner readiness for a non-current topic'
);

select ok(
  public.save_answer(
    (select value::uuid from test_state where key = 'space_id'),
    (select question.id from public.questions question
     where question.topic_id = (select value::uuid from test_state where key = 'topic_one')
     order by question.order_index limit 1),
    (select option.key from public.question_options option
     where option.question_id = (
       select question.id from public.questions question
       where question.topic_id = (select value::uuid from test_state where key = 'topic_one')
       order by question.order_index limit 1)
     order by option.order_index limit 1),
    'medium',
    null
  ) ? 'partnerReady',
  'save_answer still reports readiness on the current shared topic'
);

-- Finishing a later topic writes a topic_ready event naming it. Reading that
-- event would name the topic just as the redacted counts would.
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

select is_empty(
  format(
    $$select event.id from public.space_events event
      where event.kind = 'topic_ready'
        and event.payload_json ->> 'topic_id' = %L$$,
    (select value from test_state where key = 'topic_two')
  ),
  'A topic_ready event for a non-current topic is not readable'
);

-- The stage helpers check no membership themselves, so they must not be
-- callable directly; can_read_topic_partner_state is the guarded entry point.
select throws_ok(
  format(
    'select public.is_topic_discussed(%L, %L)',
    (select value from test_state where key = 'space_id'),
    (select value from test_state where key = 'topic_two')
  ),
  '42501',
  null,
  'is_topic_discussed cannot be called directly by an authenticated caller'
);

select throws_ok(
  format(
    'select public.current_topic_id(%L)',
    (select value from test_state where key = 'space_id')
  ),
  '42501',
  null,
  'current_topic_id cannot be called directly by an authenticated caller'
);

select throws_ok(
  format(
    'select public.require_ready_comparison(%L, %L)',
    (select value from test_state where key = 'space_id'),
    (select question.id from public.questions question
     where question.topic_id = (select value::uuid from test_state where key = 'topic_two')
     order by question.order_index limit 1)
  ),
  '42501',
  null,
  'require_ready_comparison cannot be called directly by an authenticated caller'
);

-- Both members have now answered every topic-two question, so its comparisons
-- really are ready. These calls would succeed without the guard, which is
-- exactly what made them an oracle: success meant the partner had answered.
select throws_ok(
  format(
    'select public.mark_question_discussed(%L, %L)',
    (select value from test_state where key = 'space_id'),
    (select question.id from public.questions question
     where question.topic_id = (select value::uuid from test_state where key = 'topic_two')
     order by question.order_index limit 1)
  ),
  'P0001',
  'COMPARISON_NOT_READY',
  'Marking discussed on a hidden topic fails as though the comparison were not ready'
);

select throws_ok(
  format(
    'select public.add_shared_note(%L, %L, %L)',
    (select value from test_state where key = 'space_id'),
    (select question.id from public.questions question
     where question.topic_id = (select value::uuid from test_state where key = 'topic_two')
     order by question.order_index limit 1),
    'a note'
  ),
  'P0001',
  'COMPARISON_NOT_READY',
  'Adding a shared note on a hidden topic fails with the same error'
);

reset role;

-- The journey-wide comparison count was itself differential: answering one
-- chosen question in a hidden topic moved it if and only if the partner had
-- already answered that question.
select hasnt_function(
  'public', 'get_journey_comparison_count',
  'The differential journey comparison count no longer exists'
);

select * from finish();
rollback;
