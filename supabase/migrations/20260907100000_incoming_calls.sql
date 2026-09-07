-- ============================================================
-- WhatsApp/FaceTime-style ringing flow for the existing Jitsi video calls.
-- Supersedes the ad-hoc "video_call_started" broadcast (see ChatWindow.jsx
-- and 20260906060000_video_call_signaling.sql) which only reached whoever
-- already had that conversation's chat open — this uses a real table +
-- Realtime postgres_changes so the receiver sees an incoming-call overlay
-- anywhere in the app, and both sides observe accept/decline/end.
--
-- No new video backend: room_url is the same deterministic
-- https://meet.jit.si/studycult-<conversation_id> room the existing
-- "Start video call" button already opens — Jitsi's public server needs no
-- API key or room-creation call, so there's no Edge Function here.
-- ============================================================

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  room_url text not null,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'missed', 'ended')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  ended_at timestamptz,
  constraint calls_caller_receiver_differ check (caller_id <> receiver_id)
);

create index calls_receiver_id_idx on public.calls (receiver_id);
create index calls_caller_id_idx on public.calls (caller_id);

alter table public.calls enable row level security;

-- Only the two participants can ever see a call row.
create policy "Participants can view their calls"
  on public.calls for select
  using (auth.uid() = caller_id or auth.uid() = receiver_id);

-- Starting a call requires actually being a member of the conversation it's
-- tied to (and the receiver must be too, so calls can't be aimed at a
-- bystander) — mirrors the messages insert policy's membership check.
create policy "Caller can start a call in their conversation"
  on public.calls for insert
  with check (
    auth.uid() = caller_id
    and status = 'ringing'
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = calls.conversation_id and cm.user_id = auth.uid()
    )
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = calls.conversation_id and cm.user_id = calls.receiver_id
    )
  );

-- Receiver flips ringing -> accepted/declined. Split from the caller policy
-- below so neither side can rewrite the other's half of the handshake.
create policy "Receiver can respond to their call"
  on public.calls for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- Caller marks a stale ring as missed (client-side 30s timeout) or either
-- leg of the call as ended.
create policy "Caller can update their call"
  on public.calls for update
  using (auth.uid() = caller_id)
  with check (auth.uid() = caller_id);

-- Realtime needs full rows on UPDATE (old + new), same as messages'
-- delete-for-everyone handling.
alter table public.calls replica identity full;
alter publication supabase_realtime add table public.calls;
