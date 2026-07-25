-- v3 rewrite: the discuss screen's "Share my exact answer" action is
-- irreversible and must not re-prompt once already done. answer_shares is
-- zero-client-policy, same as space_members, so nothing previously let the
-- sharer check their own prior share — this returns a content-free
-- boolean only, never the shared option itself.
create or replace function public.has_shared_own_answer(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.answer_shares share
    join public.answers answer on answer.id = share.answer_id
    where answer.user_id = auth.uid()
      and answer.question_id = p_question_id
      and answer.space_id = public.current_space_id()
  );
$$;

revoke all on function public.has_shared_own_answer(uuid) from public, anon, authenticated;
grant execute on function public.has_shared_own_answer(uuid) to authenticated;
