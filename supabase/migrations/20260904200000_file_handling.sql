-- ============================================================
-- Avatar upload (public bucket, own-folder write) and chat attachments
-- (private bucket, RLS scoped to conversation membership — mirroring the
-- messages RLS pattern already in place).
-- ============================================================

alter table public.profiles add column if not exists avatar_url text;

alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_type text
  check (attachment_type is null or attachment_type in ('image', 'file'));

-- ---------- Avatars ----------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Chat attachments ----------
-- Private bucket — files live at <conversation_id>/<filename>, so membership
-- can be checked the same way the messages table itself does.

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

create policy "Conversation members can upload attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = auth.uid()
    )
  );

create policy "Conversation members can view attachments"
  on storage.objects for select
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = ((storage.foldername(name))[1])::uuid
      and cm.user_id = auth.uid()
    )
  );
