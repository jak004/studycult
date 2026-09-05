-- ============================================================
-- In-app notifications, fanned out automatically from every row
-- inserted into events — so the bell in Navbar.jsx never needs its
-- own insert logic scattered across the client.
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No insert policy for regular clients — only the trigger below (security
-- definer, runs as table owner, bypasses RLS) ever writes a notification row.

alter publication supabase_realtime add table public.notifications;

create or replace function public.handle_new_event()
returns trigger as $$
declare
  v_title text;
  v_body text;
  v_link text;
begin
  if new.type = 'welcome' then
    v_title := 'Welcome to StudyBridge 🎓';
    v_body := 'Message a tutor or join a study room whenever you''re ready.';
    v_link := '/dashboard';
  elsif new.type = 'new_message' then
    v_title := 'New message from ' || coalesce(new.payload->>'sender_name', 'someone');
    v_body := coalesce(new.payload->>'preview', '');
    v_link := '/messages?c=' || (new.payload->>'conversation_id');
  elsif new.type = 'quiz_result' then
    v_title := 'Your result: ' || coalesce(new.payload->>'quiz_title', 'Quiz');
    v_body := coalesce(new.payload->>'score', '0') || ' / ' || coalesce(new.payload->>'total', '0');
    v_link := '/quizzes';
  else
    -- weekly_digest is sent directly by the scheduled function, not via
    -- events, and any future event type without a case here just gets an
    -- email (if send-notification-email handles it) but no bell entry.
    return new;
  end if;

  insert into public.notifications (user_id, title, body, link)
  values (new.user_id, v_title, v_body, v_link);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_event_created on public.events;
create trigger on_event_created
  after insert on public.events
  for each row execute procedure public.handle_new_event();
