-- ============================================================
-- Notification infrastructure: per-user preferences, an activity
-- timestamp (used to skip "new message" emails while the recipient
-- is actively online), and an events table that queues email-worthy
-- happenings for the send-notification-email Edge Function.
-- ============================================================

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default
    '{"welcome": true, "new_message": true, "quiz_result": true, "weekly_digest": true}'::jsonb;

-- Updated by a lightweight client heartbeat while a session is open.
-- Used to decide whether someone is "active right now" before emailing them
-- about a new message — no point emailing someone already looking at the chat.
alter table public.profiles
  add column if not exists last_active_at timestamptz not null default now();

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('welcome', 'new_message', 'quiz_result', 'weekly_digest')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  emailed boolean not null default false,
  -- Set when an event is deliberately not emailed (recipient opted out, or was
  -- active when a new_message event fired) — distinguishes "skipped on purpose"
  -- from "the function hasn't processed this row yet".
  skip_reason text
);

alter table public.events enable row level security;

create index if not exists events_unprocessed_idx on public.events (created_at) where emailed = false;

create policy "Users can view their own events"
  on public.events for select
  using (auth.uid() = user_id);

-- Clients may only queue the two event types that stem directly from their own
-- actions. 'welcome' is inserted by the handle_new_user trigger (below, runs as
-- table owner and bypasses RLS) and 'weekly_digest' only by the scheduled job
-- (via the service_role key, which also bypasses RLS) — neither is reachable
-- through this policy.
create policy "Members can queue a new_message event for their conversation"
  on public.events for insert
  with check (
    type = 'new_message'
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = (payload->>'conversation_id')::uuid
      and cm.user_id = auth.uid()
    )
  );

create policy "Users can queue their own quiz_result event"
  on public.events for insert
  with check (type = 'quiz_result' and auth.uid() = user_id);

-- Extend the existing signup trigger to also queue a welcome email.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'New user'
    ),
    new.raw_user_meta_data->>'role'
  );

  insert into public.events (user_id, type, payload)
  values (new.id, 'welcome', jsonb_build_object('email', new.email));

  return new;
end;
$$ language plpgsql security definer;
