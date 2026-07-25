-- v3 rewrite: profiles exposes only the owner's own row, and space_members
-- grants no direct client access at all. Several screens need the
-- partner's display name (§7.5 "You & Val", §7.7 "Saved — Val hasn't
-- reached this one yet", §7.9 "This one matters a lot to Val") without
-- widening either table's grants. One name-only SECURITY DEFINER function,
-- matching the same function-mediated pattern as get_topic_progress.
create or replace function public.get_partner_display_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profile.display_name
  from public.space_members membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.space_id = public.current_space_id()
    and membership.user_id <> auth.uid()
    and membership.ended_at is null
  limit 1;
$$;

revoke all on function public.get_partner_display_name() from public, anon, authenticated;
grant execute on function public.get_partner_display_name() to authenticated;
