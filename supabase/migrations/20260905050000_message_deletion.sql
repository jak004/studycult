create policy "Senders can delete their own messages"
  on public.messages for delete
  using (auth.uid() = sender_id);

-- Realtime's filtered DELETE events (conversation_id=eq.<id>) need the full
-- old row available to filter against — with the default replica identity
-- (primary key only), a deleted row's payload wouldn't include conversation_id
-- at all, and the other participant would never see the delete happen live.
alter table public.messages replica identity full;
