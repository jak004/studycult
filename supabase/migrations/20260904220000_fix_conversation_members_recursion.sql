-- The original "Members can view membership rows for their conversations"
-- policy self-referenced conversation_members from within its own USING
-- clause: checking whether a row is visible required running the same
-- EXISTS subquery against conversation_members, which re-triggers this same
-- SELECT policy on the same table, forever. Postgres detects this and raises
-- "infinite recursion detected in policy for relation conversation_members"
-- on the first real read that hits it (e.g. re-selecting a room right after
-- creating it).
--
-- Fix: move the check into a SECURITY DEFINER function. Its internal query
-- runs as the function's owner, which Postgres exempts from RLS by default
-- (table owners bypass RLS unless FORCE ROW LEVEL SECURITY is set), so it
-- reads the table directly instead of re-entering this policy.
create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id
    and user_id = p_user_id
  );
$$;

drop policy if exists "Members can view membership rows for their conversations" on public.conversation_members;
create policy "Members can view membership rows for their conversations"
  on public.conversation_members for select
  using (public.is_conversation_member(conversation_id, auth.uid()));
