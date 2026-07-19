begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(41);

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
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member-a@example.test',
    crypt('test-password-a', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"private_display_name":"Member A"}',
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
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"private_display_name":"Member B"}',
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
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'expired-owner@example.test',
    crypt('test-password-d', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'expired-redeemer@example.test',
    crypt('test-password-e', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

create temp table test_state (
  key text primary key,
  value text not null
);

grant select on table test_state to authenticated;

select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.create_couple_invite('outdated-policy')$$,
  'P0001',
  'JOURNEY_POLICY_VERSION_INVALID',
  'Invite creation requires acceptance of the current journey-deletion policy'
);

insert into test_state (key, value)
select 'invite_code', invite.invite_code
from public.create_couple_invite(public.current_journey_policy_version()) invite;

select is(
  (
    select count(*)
    from public.journey_policy_acceptances acceptance
    where acceptance.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and acceptance.policy_version = public.current_journey_policy_version()
  ),
  1::bigint,
  'Invite creation records the creator policy version and acceptance timestamp'
);

insert into test_state (key, value)
select 'couple_id', couple.id::text
from public.couples couple
where couple.user_a_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

select isnt(
  (select invitation.code_hash
   from public.couple_invites invitation
   where invitation.couple_id = (select value::uuid from test_state where key = 'couple_id')),
  (select value from test_state where key = 'invite_code'),
  'Invitation plaintext is never stored as its hash'
);

select throws_ok(
  format(
    'select public.redeem_couple_invite(%L, public.current_journey_policy_version())',
    (select value from test_state where key = 'invite_code')
  ),
  'P0001',
  'INVITE_SELF_REDEMPTION',
  'A user cannot redeem their own invitation'
);

select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  true
);

select is(
  public.inspect_couple_invite(
    (select value from test_state where key = 'invite_code')
  ) ->> 'status',
  'available',
  'An authenticated prospective partner can inspect an available opaque invitation'
);

select lives_ok(
  format(
    'select public.redeem_couple_invite(%L, public.current_journey_policy_version())',
    (select value from test_state where key = 'invite_code')
  ),
  'A connected partner can redeem a valid invitation once'
);

select is(
  (
    select count(*)
    from public.journey_policy_acceptances acceptance
    where acceptance.couple_id = (select value::uuid from test_state where key = 'couple_id')
      and acceptance.policy_version = public.current_journey_policy_version()
  ),
  2::bigint,
  'Both participants accept the current journey-deletion policy'
);

select is(
  (
    select couple.status
    from public.couples couple
    where couple.id = (select value::uuid from test_state where key = 'couple_id')
  ),
  'active',
  'A couple becomes active only after both policy acceptances exist'
);

select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  true
);

select throws_ok(
  format(
    'select public.redeem_couple_invite(%L, public.current_journey_policy_version())',
    (select value from test_state where key = 'invite_code')
  ),
  'P0001',
  'INVITE_ALREADY_USED',
  'A redeemed invitation cannot be reused'
);

select is(
  public.inspect_couple_invite(
    (select value from test_state where key = 'invite_code')
  ) ->> 'status',
  'unavailable',
  'Inspection does not expose details about a used invitation'
);

select set_config(
  'request.jwt.claim.sub',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
  true
);

insert into test_state (key, value)
select 'expired_code', invite.invite_code
from public.create_couple_invite(public.current_journey_policy_version()) invite;

insert into test_state (key, value)
select 'expired_invite_id', invitation.id::text
from public.couple_invites invitation
where invitation.created_by = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
  and invitation.redeemed_at is null;

select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  true
);

select throws_ok(
  format(
    'select public.redeem_couple_invite(%L, public.current_journey_policy_version())',
    (select value from test_state where key = 'expired_code')
  ),
  'P0001',
  'ACTIVE_COUPLE_CONFLICT',
  'A user in an active couple cannot redeem another valid invitation'
);

select throws_ok(
  $$
    update public.couples
    set user_b_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
        status = 'active'
    where user_a_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
  $$,
  'P0001',
  'JOURNEY_POLICY_ACCEPTANCE_REQUIRED',
  'A journey cannot become active before both current policy acceptances exist'
);

select set_config(
  'request.jwt.claim.sub',
  'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
  true
);

select lives_ok(
  format(
    'select public.revoke_couple_invite(%L)',
    (select value from test_state where key = 'expired_invite_id')
  ),
  'An invitation creator can revoke an unused invitation'
);

select set_config(
  'request.jwt.claim.sub',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5',
  true
);

select throws_ok(
  format(
    'select public.redeem_couple_invite(%L, public.current_journey_policy_version())',
    (select value from test_state where key = 'expired_code')
  ),
  'P0001',
  'INVITE_EXPIRED',
  'An expired invitation cannot be redeemed'
);

select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  true
);

select throws_ok(
  'select * from public.create_couple_invite(public.current_journey_policy_version())',
  'P0001',
  'ACTIVE_COUPLE_CONFLICT',
  'A user in an active couple cannot create another invitation'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_question_comparison(uuid)',
    'execute'
  ),
  'Anonymous users cannot execute the comparison function'
);

select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.private_accounts),
  1::bigint,
  'A user reads their own private account but cannot enumerate accounts'
);

select is(
  (select count(*) from public.topics),
  8::bigint,
  'An authenticated user can read all eight active topics'
);

select is(
  (
    select array_agg(slug order by order_index)
    from public.topics
  ),
  array[
    'communication-and-conflict',
    'faith-and-religious-practice',
    'family-boundaries-and-involvement',
    'living-arrangements',
    'household-roles',
    'finances-and-debt',
    'children-and-parenting',
    'dealbreakers'
  ]::text[],
  'Authenticated topic reads preserve the approved low-to-high intensity order'
);

select throws_ok(
  'update public.topics set name = ''Changed by user'' where true',
  '42501',
  'permission denied for table topics',
  'Canonical topics cannot be edited by an authenticated user'
);

select throws_ok(
  'update public.questions set text = ''Changed by user'' where true',
  '42501',
  'permission denied for table questions',
  'Canonical questions cannot be edited by an authenticated user'
);

insert into public.answers (question_id, user_id, couple_id, value)
values
  (
    '10000000-0000-4000-8000-000000000101',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    (select value::uuid from test_state where key = 'couple_id'),
    to_jsonb('mostly_consistent'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    (select value::uuid from test_state where key = 'couple_id'),
    '4'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000105',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    (select value::uuid from test_state where key = 'couple_id'),
    to_jsonb('We would listen carefully and ask for trusted guidance.'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000307',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    (select value::uuid from test_state where key = 'couple_id'),
    to_jsonb('Private family context for a direct conversation.'::text)
  );

select is(
  (select count(*) from public.answers),
  4::bigint,
  'A user can read their own answers'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  true
);
set local role authenticated;

insert into public.answers (question_id, user_id, couple_id, value)
values
  (
    '10000000-0000-4000-8000-000000000101',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    (select value::uuid from test_state where key = 'couple_id'),
    to_jsonb('mostly_consistent'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000102',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    (select value::uuid from test_state where key = 'couple_id'),
    '1'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000105',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    (select value::uuid from test_state where key = 'couple_id'),
    to_jsonb('We would make space for a respectful conversation.'::text)
  ),
  (
    '10000000-0000-4000-8000-000000000307',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    (select value::uuid from test_state where key = 'couple_id'),
    to_jsonb('Different private family context.'::text)
  );

select ok(
  (
    select not comparison.partner_answer_revealed
      and comparison.partner_answer is null
    from public.get_question_comparison(
      '10000000-0000-4000-8000-000000000101'
    ) comparison
  ),
  'Safe comparison responses omit an unrevealed partner value'
);

select ok(
  (
    select comparison.bucket = 'worth_discussing'
      and not comparison.partner_answer_revealed
      and comparison.partner_answer is null
    from public.get_question_comparison(
      '10000000-0000-4000-8000-000000000105'
    ) comparison
  ),
  'Text discussion-only answers produce a neutral bucket without disclosing wording'
);

select ok(
  (
    select comparison.bucket = 'worth_discussing'
      and not comparison.partner_answer_revealed
      and comparison.partner_answer is null
    from public.get_question_comparison(
      '10000000-0000-4000-8000-000000000307'
    ) comparison
  ),
  'Never-compare answers produce a neutral prompt without comparing or disclosing wording'
);

select throws_ok(
  $$
    update public.answers
    set revealed = true
    where question_id = '10000000-0000-4000-8000-000000000307'
  $$,
  'P0001',
  'ANSWER_REVEAL_NOT_ALLOWED',
  'A never-compare answer cannot be revealed'
);

select is(
  public.get_topic_comparison_summary(
    '00000000-0000-4000-8000-000000000101'
  ),
  '{"aligned":1,"worthDiscussing":1,"possibleConcern":1,"waiting":3}'::jsonb,
  'A topic aggregate includes every active question rather than only the first'
);

select is(
  (
    select count(*)
    from public.answers answer
    where answer.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  0::bigint,
  'A partner cannot directly read an unrevealed answer'
);

update public.answers
set value = to_jsonb('very_structured'::text)
where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

reset role;
select is(
  (
    select answer.value
    from public.answers answer
    where answer.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and answer.question_id = '10000000-0000-4000-8000-000000000101'
  ),
  to_jsonb('mostly_consistent'::text),
  'A partner cannot update another user answer'
);

set local role authenticated;
update public.answers
set revealed = true
where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

reset role;
select is(
  (
    select answer.revealed
    from public.answers answer
    where answer.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and answer.question_id = '10000000-0000-4000-8000-000000000101'
  ),
  false,
  'A partner cannot reveal another user answer'
);

select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);
set local role authenticated;

update public.answers
set revealed = true
where question_id = '10000000-0000-4000-8000-000000000101';

select ok(
  (
    select answer.revealed and answer.revealed_at is not null
    from public.answers answer
    where answer.question_id = '10000000-0000-4000-8000-000000000101'
  ),
  'A user can reveal their own answer and the reveal is timestamped'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.answers answer
    where answer.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  0::bigint,
  'Direct answer queries remain owner-only after reveal'
);

select ok(
  (
    select comparison.partner_answer_revealed
      and comparison.partner_answer is not null
    from public.get_question_comparison(
      '10000000-0000-4000-8000-000000000101'
    ) comparison
  ),
  'The safe comparison function returns a specifically revealed partner answer'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  true
);
set local role authenticated;

update public.answers
set revealed = false
where question_id = '10000000-0000-4000-8000-000000000101';

select ok(
  (
    select not answer.revealed and answer.revealed_at is null
    from public.answers answer
    where answer.question_id = '10000000-0000-4000-8000-000000000101'
  ),
  'A user can revoke their own answer reveal'
);

insert into public.guided_discussions (
  couple_id,
  topic_id,
  question_id,
  status,
  shared_note
)
values (
  (select value::uuid from test_state where key = 'couple_id'),
  '00000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000102',
  'discussing',
  'A shared planning note.'
);

insert into public.couple_checklist_items (
  couple_id,
  checklist_definition_id
)
values (
  (select value::uuid from test_state where key = 'couple_id'),
  '20000000-0000-4000-8000-000000000001'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  true
);
set local role authenticated;

select ok(
  (
    select not comparison.partner_answer_revealed
      and comparison.partner_answer is null
    from public.get_question_comparison(
      '10000000-0000-4000-8000-000000000101'
    ) comparison
  ),
  'A revoked partner answer is absent from later safe responses'
);

select is(
  (
    select comparison.bucket
    from public.get_question_comparison(
      '10000000-0000-4000-8000-000000000102'
    ) comparison
  ),
  'possible_concern',
  'Scale difference three is returned as a possible concern'
);

select is(
  (select count(*) from public.guided_discussions),
  1::bigint,
  'Both couple members can read shared discussions'
);

update public.couple_checklist_items
set done = true;

select ok(
  (
    select item.done and item.completed_at is not null
    from public.couple_checklist_items item
  ),
  'Both couple members can update shared checklist state'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.couples),
  0::bigint,
  'An outsider cannot read the couple'
);

select is(
  (select count(*) from public.guided_discussions),
  0::bigint,
  'An outsider cannot read shared notes'
);

select is(
  (select count(*) from public.couple_checklist_items),
  0::bigint,
  'An outsider cannot read shared checklist state'
);

reset role;

select * from finish();
rollback;
