-- Lets a user mark how much a given answer matters to them, and optionally
-- how they'd like to discuss a difference. Deliberately NOT a boolean:
-- graded importance (flexible/important/essential/non_negotiable) is more
-- honest than a single "important" toggle, and replaces the need for a
-- separate standalone dealbreakers topic over time (existing dealbreakers
-- topic is left in place for now; retiring it is a content decision, not
-- made by this migration).
--
-- Neither field is shared with the partner automatically. Same reveal-on-
-- consent model as the answer value itself: visible to the answering user
-- always, visible to their partner only once/if that specific answer has
-- also been revealed.

alter table public.answers
  add column importance text not null default 'flexible'
    check (importance in ('flexible', 'important', 'essential', 'non_negotiable')),
  add column discussion_preference text null
    check (discussion_preference in ('together', 'professional', 'outside_app'));

comment on column public.answers.importance is
  'Set by the answering user only. Not exposed to the partner unless the same answer has also been revealed (see answers.revealed).';
comment on column public.answers.discussion_preference is
  'Optional. How the answering user would prefer to discuss a difference on this question, if one exists. Same visibility rule as answers.importance.';