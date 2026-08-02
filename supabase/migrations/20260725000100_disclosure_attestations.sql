-- Disclosure engine (alpha-scope item a).
--
-- An attestation is a fact a person states about themselves, not an opinion
-- about a shared question, so it is modelled separately from answers rather
-- than as another comparison_mode. Three consequences are enforced here:
--
-- 1. No comparison is ever computed. public.comparisons keys on question_id,
--    and an attestation has no question, so there is no path by which one
--    could be bucketed as aligned / worth_discussing / possible_concern.
-- 2. A direct read of an attestation row returns it to its owner and to
--    nobody else, including after a reveal. That is stricter than answers,
--    where an explicit recipient may read the row itself. Revealed content
--    reaches a partner only through get_revealed_disclosures().
-- 3. Reveal is per attestation and explicit. It lives in its own table behind
--    its own function, which requires a confirmation token, so revealing an
--    answer can never reveal an attestation and revealing one attestation can
--    never reveal another.

-- Fixed disclosure categories. Canonical content, so it ships in the
-- migration rather than in seed.sql, matching topics and questions.
create table public.disclosure_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  order_index integer not null unique check (order_index >= 0),
  is_required boolean not null default true,
  is_active boolean not null default true
);

create table public.disclosure_category_translations (
  category_id uuid not null
    references public.disclosure_categories(id) on delete cascade,
  locale text not null check (locale ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  title text not null check (char_length(title) between 1 and 160),
  description text not null check (char_length(description) between 1 and 500),
  primary key (category_id, locale)
);

-- The attestation itself. `body` is owner-only content and never leaves this
-- table except through an explicit reveal.
create table public.disclosure_attestations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  category_id uuid not null
    references public.disclosure_categories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, category_id, user_id)
);

create index disclosure_attestations_space_user_idx
  on public.disclosure_attestations (space_id, user_id);

-- One row per attestation actually revealed, to one recipient. Separate table
-- so that no answer-side share can ever imply a disclosure reveal.
create table public.disclosure_reveals (
  attestation_id uuid not null
    references public.disclosure_attestations(id) on delete cascade,
  revealed_to_user_id uuid not null
    references public.profiles(id) on delete cascade,
  revealed_at timestamptz not null default now(),
  primary key (attestation_id, revealed_to_user_id)
);

-- Defined before the policies below, which reference it.
create or replace function public.is_current_user_attestation_owner(
  p_attestation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.disclosure_attestations attestation
    where attestation.id = p_attestation_id
      and attestation.user_id = auth.uid()
  );
$$;

alter table public.disclosure_categories enable row level security;
alter table public.disclosure_category_translations enable row level security;
alter table public.disclosure_attestations enable row level security;
alter table public.disclosure_reveals enable row level security;

revoke all on public.disclosure_categories,
  public.disclosure_category_translations,
  public.disclosure_attestations,
  public.disclosure_reveals
  from public, anon, authenticated;

grant select on public.disclosure_categories,
  public.disclosure_category_translations,
  public.disclosure_attestations,
  public.disclosure_reveals
  to authenticated;

create policy "authenticated users can read disclosure categories"
on public.disclosure_categories for select to authenticated
using (is_active);

create policy "authenticated users can read category translations"
on public.disclosure_category_translations for select to authenticated
using (true);

-- Owner-only, with no recipient branch. A revealed attestation is still not
-- directly readable by the partner; get_revealed_disclosures() is the only
-- path to that content.
create policy "attestation owner can read"
on public.disclosure_attestations for select to authenticated
using (user_id = (select auth.uid()));

create policy "reveal participants can read"
on public.disclosure_reveals for select to authenticated
using (
  revealed_to_user_id = (select auth.uid())
  or public.is_current_user_attestation_owner(attestation_id)
);

-- Writes go through this function rather than a table grant, so the space
-- membership and ownership checks cannot be bypassed by a client.
create or replace function public.save_disclosure_attestation(
  p_category_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid := public.current_space_id();
  v_id uuid;
  v_existing public.disclosure_attestations%rowtype;
  v_has_existing boolean;
  v_body text := public.normalize_body(p_body);
  v_space_status text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if v_space_id is null then
    raise exception using errcode = 'P0001', message = 'SPACE_REQUIRED';
  end if;
  -- The table's char_length(body) >= 1 accepts a body of pure whitespace,
  -- which would count the category as attested in get_disclosure_overview()
  -- while disclosing nothing.
  if v_body = '' then
    raise exception using errcode = 'P0001', message = 'DISCLOSURE_BODY_REQUIRED';
  end if;
  if not exists (
    select 1 from public.disclosure_categories category
    where category.id = p_category_id and category.is_active
  ) then
    raise exception using errcode = 'P0001', message = 'CATEGORY_NOT_FOUND';
  end if;

  -- Locked because reveal_disclosure_attestation() locks the same row. Without
  -- it, a reveal could read the pre-edit row, this edit could then update the
  -- body and delete the reveals, and the reveal could still insert afterwards,
  -- publishing the revised fact without a confirmation for that revision.
  --
  -- Attestation first, space second. reveal_disclosure_attestation() takes them
  -- in that order too; reversing them here let a concurrent save and reveal
  -- each hold one row while waiting for the other. Any future function touching
  -- both rows must use the same order.
  select * into v_existing
  from public.disclosure_attestations
  where space_id = v_space_id
    and category_id = p_category_id
    and user_id = v_user_id
  for update;

  -- Captured immediately: FOUND is rewritten by the next SELECT INTO, and the
  -- space lock below sits between this lookup and the branch that uses it.
  v_has_existing := found;

  -- Pausing stops answer saves, so it stops disclosure saves too, otherwise a
  -- paused member could still move the partner-visible partnerAttested count.
  -- 'waiting' is allowed, matching save_answer: a person may record their own
  -- facts before a partner has joined.
  select space.status into v_space_status
  from public.spaces space
  where space.id = v_space_id
  for update;

  if v_space_status is null or v_space_status not in ('waiting', 'active') then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;

  if not v_has_existing then
    -- The lookup above can only lock a row that already exists, so two
    -- concurrent first saves for the same category both find nothing and both
    -- arrive here. The space lock serializes them, but the loser would still
    -- run a plain insert after the winner committed and fail the unique
    -- constraint -- surfacing a raw database error for what is, from the
    -- person's point of view, an ordinary save. The upsert makes the loser
    -- behave like the edit it effectively is.
    insert into public.disclosure_attestations (
      space_id, category_id, user_id, body
    )
    values (v_space_id, p_category_id, v_user_id, v_body)
    on conflict (space_id, category_id, user_id) do update
      set body = excluded.body,
          updated_at = now()
    returning id into v_id;

    -- No-op on a genuine first save. In the racing case the row the winner
    -- created has just had its body replaced, so any reveal of it is retracted
    -- rather than left pointing at content that was never confirmed for it.
    delete from public.disclosure_reveals where attestation_id = v_id;

    return v_id;
  end if;

  -- Editing the body after a reveal would otherwise push the new text to the
  -- partner through get_revealed_disclosures() without a second confirmation,
  -- since the reveal keys on the attestation rather than on its content. Any
  -- change to the fact retracts every reveal of it, so the revised version has
  -- to be revealed explicitly, exactly like the first one.
  if v_existing.body is distinct from v_body then
    update public.disclosure_attestations
    set body = v_body,
        updated_at = now()
    where id = v_existing.id;

    delete from public.disclosure_reveals
    where attestation_id = v_existing.id;
  end if;

  return v_existing.id;
end;
$$;

-- Reveal is explicit and per attestation. The confirmation argument exists so
-- a reveal can never be a side effect of another action: a caller has to pass
-- the token deliberately, which is what the scope's "confirmation step at
-- reveal time" requires of the layer above.
create or replace function public.reveal_disclosure_attestation(
  p_attestation_id uuid,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_attestation public.disclosure_attestations%rowtype;
  v_partner_id uuid;
  v_space_status text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'AUTH_REQUIRED';
  end if;
  if p_confirmation is distinct from 'CONFIRM_DISCLOSURE_REVEAL' then
    raise exception using errcode = 'P0001', message = 'REVEAL_NOT_CONFIRMED';
  end if;

  -- Locked for the same reason save_disclosure_attestation() locks: the two
  -- must not interleave, or a reveal can attach to a body that was edited
  -- after this row was read.
  select * into v_attestation
  from public.disclosure_attestations
  where id = p_attestation_id and user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ATTESTATION_NOT_FOUND';
  end if;

  -- Pausing leaves memberships open and only changes spaces.status, so a
  -- membership check alone would let a paused journey keep disclosing. This
  -- mirrors share_answer(), which refuses to share an answer while paused;
  -- an attestation is more sensitive, not less.
  --
  -- Locked, not merely read: set_space_paused() updates this row, so an
  -- unlocked check could observe 'active', the pause could commit, and the
  -- reveal would still insert afterwards, publishing content into a space that
  -- is by then paused.
  select space.status into v_space_status
  from public.spaces space
  where space.id = v_attestation.space_id
  for update;

  if v_space_status is distinct from 'active' then
    raise exception using errcode = 'P0001', message = 'SPACE_PAUSED';
  end if;

  select member.user_id into v_partner_id
  from public.space_members member
  where member.space_id = v_attestation.space_id
    and member.user_id <> v_user_id
    and member.ended_at is null
  limit 1;

  if v_partner_id is null then
    raise exception using errcode = 'P0001', message = 'PARTNER_REQUIRED';
  end if;

  insert into public.disclosure_reveals (attestation_id, revealed_to_user_id)
  values (p_attestation_id, v_partner_id)
  on conflict do nothing;
end;
$$;

-- The partner-visible signal before any reveal. Counts only: no category id,
-- no category label, no summary, no content. The scope allows the partner to
-- learn that required disclosures have or have not been made, and nothing
-- finer, so identity of the categories is deliberately not returned.
create or replace function public.get_disclosure_overview()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'requiredTotal', (
      select count(*) from public.disclosure_categories
      where is_active and is_required
    ),
    'ownAttested', (
      select count(*)
      from public.disclosure_attestations attestation
      join public.disclosure_categories category
        on category.id = attestation.category_id
      where attestation.space_id = public.current_space_id()
        and attestation.user_id = auth.uid()
        and category.is_active and category.is_required
    ),
    'partnerAttested', (
      select count(*)
      from public.disclosure_attestations attestation
      join public.disclosure_categories category
        on category.id = attestation.category_id
      where attestation.space_id = public.current_space_id()
        and attestation.user_id <> auth.uid()
        and category.is_active and category.is_required
    )
  )
  where auth.uid() is not null and public.current_space_id() is not null;
$$;

-- The only path by which a partner ever sees disclosure content, and only for
-- the specific attestations that were explicitly revealed to them.
--
-- Current membership is required as well as the reveal. close_space() ends
-- memberships without deleting attestations or reveals, so authorizing on the
-- reveal row alone would let a former partner keep reading health, financial,
-- and family disclosures indefinitely after the space was unlinked.
create or replace function public.get_revealed_disclosures(p_locale text)
returns table (
  attestation_id uuid,
  category_key text,
  category_title text,
  body text,
  revealed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    attestation.id,
    category.key,
    coalesce(translation.title, fallback.title),
    attestation.body,
    reveal.revealed_at
  from public.disclosure_reveals reveal
  join public.disclosure_attestations attestation
    on attestation.id = reveal.attestation_id
  join public.disclosure_categories category
    on category.id = attestation.category_id
  left join public.disclosure_category_translations translation
    on translation.category_id = category.id
   and translation.locale = p_locale
  left join public.disclosure_category_translations fallback
    on fallback.category_id = category.id
   and fallback.locale = 'en'
  where reveal.revealed_to_user_id = auth.uid()
    and public.is_current_space_member(attestation.space_id)
  order by category.order_index;
$$;

revoke all on function public.is_current_user_attestation_owner(uuid),
  public.save_disclosure_attestation(uuid, text),
  public.reveal_disclosure_attestation(uuid, text),
  public.get_disclosure_overview(),
  public.get_revealed_disclosures(text)
  from public, anon, authenticated;

grant execute on function public.is_current_user_attestation_owner(uuid),
  public.save_disclosure_attestation(uuid, text),
  public.reveal_disclosure_attestation(uuid, text),
  public.get_disclosure_overview(),
  public.get_revealed_disclosures(text)
  to authenticated;

-- The fixed categories named by the scope document: the material facts the
-- question library deliberately refuses to collect as answers.
insert into public.disclosure_categories (id, key, order_index, is_required)
values
  ('b1a4c0de-0000-4000-8000-000000000001', 'prior-marriage', 1, true),
  ('b1a4c0de-0000-4000-8000-000000000002', 'dependents', 2, true),
  ('b1a4c0de-0000-4000-8000-000000000003', 'health-material-to-marriage', 3, true),
  ('b1a4c0de-0000-4000-8000-000000000004', 'financial-obligations', 4, true);

insert into public.disclosure_category_translations
  (category_id, locale, title, description)
values
  ('b1a4c0de-0000-4000-8000-000000000001', 'en', 'Previous marriage',
   'Whether you have been married before, and anything about it your partner should know before the nikah.'),
  ('b1a4c0de-0000-4000-8000-000000000001', 'fr', 'Mariage précédent',
   'Si vous avez déjà été marié, et ce que votre partenaire devrait savoir à ce sujet avant le nikah.'),
  ('b1a4c0de-0000-4000-8000-000000000002', 'en', 'Children and dependents',
   'Children from a previous relationship, or anyone else who depends on you.'),
  ('b1a4c0de-0000-4000-8000-000000000002', 'fr', 'Enfants et personnes à charge',
   'Des enfants d''une relation précédente, ou toute autre personne qui dépend de vous.'),
  ('b1a4c0de-0000-4000-8000-000000000003', 'en', 'Health relevant to marriage',
   'A condition that would materially affect married life. Share only what you choose, and only with your partner.'),
  ('b1a4c0de-0000-4000-8000-000000000003', 'fr', 'Santé en lien avec le mariage',
   'Une situation qui affecterait concrètement la vie conjugale. Ne partagez que ce que vous choisissez, et uniquement avec votre partenaire.'),
  ('b1a4c0de-0000-4000-8000-000000000004', 'en', 'Financial obligations',
   'Debt or an ongoing financial commitment beyond what the finances topic already covers in general terms.'),
  ('b1a4c0de-0000-4000-8000-000000000004', 'fr', 'Engagements financiers',
   'Une dette ou un engagement financier durable, au-delà de ce que le thème des finances aborde déjà en termes généraux.');
