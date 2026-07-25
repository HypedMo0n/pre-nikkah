begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

-- Canonical inventory. These two assertions are the database-side mirror of the
-- verify gate in scripts/db/remote-db.mjs.
select is(
  (select count(*) from public.topics where is_active),
  12::bigint,
  'The seeded library exposes twelve active topics'
);

select is(
  (select count(*) from public.questions where is_active),
  72::bigint,
  'The seeded library exposes seventy-two active questions'
);

-- Seed content gap: mahr and marriage contract. The checklist has carried a
-- clarify-mahr item since the first seed, so the question library has to cover
-- it rather than leaving the checklist pointing at nothing.
select isnt_empty(
  $$
    select question.id
    from public.questions question
    join public.topics topic on topic.id = question.topic_id
    where topic.slug = 'finances-and-debt'
      and question.is_active
      and question.text ilike '%mahr%'
  $$,
  'finances-and-debt carries an active question addressing mahr'
);

select isnt_empty(
  $$
    select question.id
    from public.questions question
    join public.topics topic on topic.id = question.topic_id
    where topic.slug = 'finances-and-debt'
      and question.is_active
      and question.text ilike '%mahr%'
      and question.comparison_mode in ('exact', 'scale_distance')
  $$,
  'The mahr question is comparison eligible so a couple can see whether they agree'
);

select isnt_empty(
  $$
    select question.id
    from public.questions question
    where question.is_active
      and (
        question.text ilike '%marriage contract%'
        or question.text ilike '%marriage-contract%'
      )
  $$,
  'Marriage-contract expectations are covered by an active question'
);

-- Seed content gap: intimacy. The requirement is that the subject exists and is
-- held at a sensitive tier, never as ordinary comparable content.
select isnt_empty(
  $$
    select question.id
    from public.questions question
    join public.topics topic on topic.id = question.topic_id
    where question.is_active
      and topic.slug = 'intimacy-and-closeness'
      and question.sensitivity in ('sensitive', 'professional_discussion')
  $$,
  'At least one active intimacy question is held at a sensitive tier'
);

select is_empty(
  $$
    select question.id
    from public.questions question
    join public.topics topic on topic.id = question.topic_id
    where question.is_active
      and topic.slug = 'intimacy-and-closeness'
      and question.type = 'text'
      and (question.comparison_mode <> 'never_compare' or question.can_reveal)
  $$,
  'Free-text intimacy answers are never compared and never revealable'
);

-- Library-wide safety invariants that the seed must not regress.
select is_empty(
  $$
    select id
    from public.questions
    where is_active
      and sensitivity = 'professional_discussion'
      and (comparison_mode <> 'never_compare' or can_reveal)
  $$,
  'Every professional-discussion prompt stays private and uncompared'
);

-- Cadence rule 1: a topic opens on its lowest-order standard question. A
-- single-prompt topic such as dealbreakers is exempt because it has no opening
-- question to separate from the reflection itself.
select is_empty(
  $$
    select topic.slug
    from public.topics topic
    join public.questions question on question.topic_id = topic.id
    where topic.is_active
      and question.is_active
    group by topic.slug
    having count(*) > 1
      and count(*) filter (where question.sensitivity = 'standard') = 0
  $$,
  'Every multi-question topic contains a standard-sensitivity question to open on'
);

-- Cadence rule 5: the optional break is only reachable for a topic of five to
-- eight questions, so no topic may grow past eight.
select is_empty(
  $$
    select topic.slug
    from public.topics topic
    join public.questions question on question.topic_id = topic.id
    where topic.is_active
      and question.is_active
    group by topic.slug
    having count(*) > 8
  $$,
  'No active topic exceeds the eight-question cadence ceiling'
);

select * from finish();
rollback;
