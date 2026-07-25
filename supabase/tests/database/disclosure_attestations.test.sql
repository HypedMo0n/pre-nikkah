begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'discloser@example.test',
    crypt('test-password-a', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Member A","locale":"en"}', now(), now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'partner@example.test',
    crypt('test-password-b', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Member B","locale":"en"}', now(), now()
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'outsider@example.test',
    crypt('test-password-c', gen_salt('bf')),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Outsider"}', now(), now()
  );

create temp table test_state (key text primary key, value text not null);
grant select, insert, update on table test_state to authenticated;

insert into test_state (key, value)
select 'category_one', category.id::text
from public.disclosure_categories category
order by category.order_index
limit 1;

insert into test_state (key, value)
select 'category_two', category.id::text
from public.disclosure_categories category
order by category.order_index
offset 1 limit 1;

-- The discloser opens a space and the partner joins it.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

create temp table created_space as select * from public.create_space();
grant select on table created_space to authenticated;
insert into test_state (key, value)
select 'invite_code', created.invite_code from created_space created;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
select lives_ok(
  format(
    'select public.redeem_space_invite(%L)',
    (select value from test_state where key = 'invite_code')
  ),
  'The partner joins the space'
);

-- The discloser records two attestations in different categories.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

insert into test_state (key, value)
select 'attestation_one', public.save_disclosure_attestation(
  (select value::uuid from test_state where key = 'category_one'),
  'A fact about my own life, category one.'
)::text;

insert into test_state (key, value)
select 'attestation_two', public.save_disclosure_attestation(
  (select value::uuid from test_state where key = 'category_two'),
  'A fact about my own life, category two.'
)::text;

select is(
  (select count(*) from public.disclosure_attestations),
  2::bigint,
  'The owner reads their own attestations'
);

select throws_ok(
  $$insert into public.disclosure_attestations (space_id, category_id, user_id, body)
    values (
      public.current_space_id(),
      (select value::uuid from test_state where key = 'category_one'),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'Direct write'
    )$$,
  '42501',
  null,
  'Attestations cannot be written directly, only through the definer function'
);

-- Before any reveal the partner sees no attestation row at all.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);

select is(
  (select count(*) from public.disclosure_attestations),
  0::bigint,
  'A partner reads no attestation row before any reveal'
);

select is(
  (select count(*) from public.get_revealed_disclosures('en')),
  0::bigint,
  'A partner is shown no disclosure content before any reveal'
);

-- The pre-reveal signal is a count and nothing else: no id, no key, no label.
select is(
  (select array_agg(key order by key) from jsonb_object_keys(public.get_disclosure_overview()) as key),
  array['ownAttested', 'partnerAttested', 'requiredTotal']::text[],
  'The shared overview exposes counts only, never a category identity'
);

select is(
  public.get_disclosure_overview() ->> 'partnerAttested',
  '2',
  'The partner learns only how many required disclosures exist, not which'
);

-- A partner cannot reveal someone else's attestation.
select throws_ok(
  format(
    'select public.reveal_disclosure_attestation(%L, %L)',
    (select value from test_state where key = 'attestation_one'),
    'CONFIRM_DISCLOSURE_REVEAL'
  ),
  'P0001',
  'ATTESTATION_NOT_FOUND',
  'Only the discloser can reveal their own attestation'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

-- Reveal is explicit: without the confirmation argument it does not happen.
select throws_ok(
  format(
    'select public.reveal_disclosure_attestation(%L, %L)',
    (select value from test_state where key = 'attestation_one'),
    'no'
  ),
  'P0001',
  'REVEAL_NOT_CONFIRMED',
  'A reveal without explicit confirmation is rejected'
);

select is(
  (select count(*) from public.disclosure_reveals),
  0::bigint,
  'The rejected reveal recorded nothing'
);

select lives_ok(
  format(
    'select public.reveal_disclosure_attestation(%L, %L)',
    (select value from test_state where key = 'attestation_one'),
    'CONFIRM_DISCLOSURE_REVEAL'
  ),
  'A confirmed reveal succeeds for the discloser'
);

set local role postgres;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
set local role authenticated;

-- The load-bearing assertion: reveal grants content through the safe function
-- and still never makes the row itself readable.
select is(
  (select count(*) from public.disclosure_attestations),
  0::bigint,
  'A direct read stays owner-only even after the attestation is revealed'
);

select is(
  (select count(*) from public.get_revealed_disclosures('en')),
  1::bigint,
  'Revealing one attestation reveals exactly that one, not the other'
);

select is(
  (select body from public.get_revealed_disclosures('en')),
  'A fact about my own life, category one.',
  'The revealed attestation returns its content to the partner it was revealed to'
);

select is(
  (select category_key from public.get_revealed_disclosures('en')),
  (select key from public.disclosure_categories where id = (select value::uuid from test_state where key = 'category_one')),
  'The revealed attestation is labelled with its own category'
);

-- An outsider sees nothing, revealed or not.
set local role postgres;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
set local role authenticated;

select is(
  (select count(*) from public.get_revealed_disclosures('en')),
  0::bigint,
  'An outsider is shown no disclosure content'
);

-- Unlinking the space ends memberships without deleting attestations or
-- reveals, so access has to stop at the membership rather than at the reveal.
set local role postgres;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
set local role authenticated;
select lives_ok('select public.close_space()', 'The discloser unlinks the space');

set local role postgres;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', true);
set local role authenticated;

select is(
  (select count(*) from public.get_revealed_disclosures('en')),
  0::bigint,
  'A former partner loses revealed disclosure content once the space is unlinked'
);

reset role;

select is(
  (select count(*) from public.disclosure_reveals),
  1::bigint,
  'The reveal record itself survives closure; only access to the content stops'
);

-- An attestation has no comparison to run, which is stronger than choosing not
-- to compare one. There is no column by which a comparison could reference it.
select hasnt_column(
  'public', 'comparisons', 'attestation_id',
  'No comparison row can reference an attestation'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'disclosure_attestations'
      and column_name in ('state', 'priority', 'cluster', 'option_key')
  ),
  0::bigint,
  'An attestation carries no comparison state, priority, or cluster'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name in (
        'disclosure_categories',
        'disclosure_category_translations',
        'disclosure_attestations',
        'disclosure_reveals'
      )
  ),
  0::bigint,
  'Anonymous callers have no access to any disclosure table'
);

select * from finish();
rollback;
