-- The original insert policy on conversation_members was `with check (true)`,
-- meaning any signed-in user could insert a membership row for any user into
-- any conversation. Since conversation IDs appear in the URL (?c=<id>), this
-- let a stranger add themselves to someone else's private 1:1 chat and read
-- its messages. Tightened to: you can add yourself (study room self-join), or
-- the conversation's creator can add someone else (starting a direct chat).
drop policy if exists "Users can add members to conversations they created or belong to"
  on public.conversation_members;

create policy "Users can add members to conversations they created or belong to"
  on public.conversation_members for insert
  with check (
    auth.uid() = user_id
    or auth.uid() = (
      select created_by from public.conversations where id = conversation_id
    )
  );
