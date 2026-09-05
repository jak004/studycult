-- "Delete for me" hides a message only for the caller, leaving it intact for
-- everyone else in the conversation — distinct from the hard delete added in
-- 20260905050000_message_deletion.sql ("delete for everyone"), which only the
-- sender can do and which actually removes the row.
alter table public.messages add column if not exists deleted_for uuid[] not null default '{}';

-- Enforced in the SELECT policy itself (not just filtered client-side) so a
-- message hidden for one member can never leak back to them through some
-- other query path.
drop policy if exists "Members can read messages in their conversations" on public.messages;
create policy "Members can read messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
    )
    and not (auth.uid() = any(deleted_for))
  );

-- A narrow RPC instead of a general UPDATE policy — Postgres RLS has no
-- column-level granularity, so an UPDATE policy broad enough to let any
-- member append their own id to deleted_for would also let them rewrite
-- content/attachment_url on messages that aren't theirs.
create or replace function public.hide_message_for_me(target_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  select conversation_id into v_conversation_id from public.messages where id = target_message_id;
  if v_conversation_id is null then
    raise exception 'Message not found';
  end if;

  if not exists (
    select 1 from public.conversation_members
    where conversation_id = v_conversation_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this conversation';
  end if;

  update public.messages
  set deleted_for = array_append(deleted_for, auth.uid())
  where id = target_message_id
    and not (auth.uid() = any(deleted_for));
end;
$$;

grant execute on function public.hide_message_for_me(uuid) to authenticated;
