-- v3 rewrite: §7.2's "How it works" onboarding screen is reachable before
-- sign-up and lists all twelve topic titles as a compact strip — topic
-- names are public marketing content (the spec itself publishes the full
-- list), unlike questions or anything answer-shaped, which stay
-- authenticated-only. This is the only anon grant anywhere in the schema.
grant select on table public.topics to anon;

create policy "anonymous visitors can read active topics"
on public.topics
for select
to anon
using (is_active);
