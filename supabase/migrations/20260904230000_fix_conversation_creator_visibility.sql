-- createStudyRoom (and getOrCreateDirectConversation) insert a conversation
-- and immediately ask PostgREST to return it (`.select().single()`), before
-- the app's very next line adds the creator to conversation_members. Since
-- the conversations SELECT policy only allowed rows where the caller is
-- already a member, Postgres can't satisfy RETURNING at that instant and
-- rejects the whole insert with "new row violates row-level security policy
-- for table conversations" — even though the INSERT's own WITH CHECK
-- (auth.uid() = created_by) was satisfied.
--
-- A permissive policy allowing creators to see their own conversations
-- closes that gap (permissive policies OR together, so this doesn't
-- restrict anything the existing policy already allowed).
create policy "Creators can view the conversations they created"
  on public.conversations for select
  using (auth.uid() = created_by);
