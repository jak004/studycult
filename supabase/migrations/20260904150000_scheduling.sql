-- ============================================================
-- Scheduling & booking: recurring weekly availability per tutor,
-- and the sessions students book against it. Reuses the existing
-- events/notifications pipeline (Sections 2-3) for confirmations
-- and reminders rather than a separate mechanism.
-- ============================================================

create table if not exists public.tutor_availability (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = Sunday, matches JS Date#getDay()
  start_time time not null,
  end_time time not null,
  -- IANA zone (e.g. 'Africa/Accra') the start/end times are local to — tutors
  -- and students may be in different zones, so this is what makes the slot
  -- convertible to an unambiguous UTC instant when someone books it.
  timezone text not null,
  created_at timestamptz not null default now(),
  constraint end_after_start check (end_time > start_time)
);

alter table public.tutor_availability enable row level security;

create policy "Availability is viewable by everyone"
  on public.tutor_availability for select using (true);

create policy "Tutors can add their own availability"
  on public.tutor_availability for insert
  with check (auth.uid() = tutor_id);

create policy "Tutors can remove their own availability"
  on public.tutor_availability for delete
  using (auth.uid() = tutor_id);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  -- Always UTC in Postgres (timestamptz's whole point) — the UI is what
  -- converts to whichever timezone the viewer happens to be looking from.
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes > 0),
  -- The zone the tutor's availability slot was defined in, captured at booking
  -- time so confirmation/reminder emails can show an unambiguous local time
  -- even if the tutor edits or deletes that availability row later.
  timezone text not null default 'UTC',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  conversation_id uuid references public.conversations(id),
  reminder_24h_sent boolean not null default false,
  reminder_1h_sent boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "Participants can view their sessions"
  on public.sessions for select
  using (auth.uid() in (tutor_id, student_id));

create policy "Students can book a session"
  on public.sessions for insert
  with check (auth.uid() = student_id);

create policy "Participants can update their session status"
  on public.sessions for update
  using (auth.uid() in (tutor_id, student_id))
  with check (auth.uid() in (tutor_id, student_id));

-- ---------- Wire sessions into the existing events/notifications pipeline ----------

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type in (
    'welcome', 'new_message', 'quiz_result', 'weekly_digest',
    'session_booked', 'session_confirmed', 'session_cancelled',
    'session_reminder_24h', 'session_reminder_1h'
  )
);

alter table public.profiles alter column notification_prefs set default
  '{"welcome": true, "new_message": true, "quiz_result": true, "weekly_digest": true,
    "session_booked": true, "session_confirmed": true, "session_cancelled": true,
    "session_reminder_24h": true, "session_reminder_1h": true}'::jsonb;

-- A student can notify the tutor they booked; a tutor can notify the student
-- they confirmed; either can notify the other of a cancellation. All three
-- are verified against an actual sessions row, not just "any two users".
create policy "Student can queue a session_booked event to their tutor"
  on public.events for insert
  with check (
    type = 'session_booked'
    and exists (
      select 1 from public.sessions s
      where s.id = (payload->>'session_id')::uuid
      and s.student_id = auth.uid()
      and s.tutor_id = events.user_id
    )
  );

create policy "Tutor can queue a session_confirmed event to their student"
  on public.events for insert
  with check (
    type = 'session_confirmed'
    and exists (
      select 1 from public.sessions s
      where s.id = (payload->>'session_id')::uuid
      and s.tutor_id = auth.uid()
      and s.student_id = events.user_id
    )
  );

create policy "A session participant can notify the other of a cancellation"
  on public.events for insert
  with check (
    type = 'session_cancelled'
    and exists (
      select 1 from public.sessions s
      where s.id = (payload->>'session_id')::uuid
      and auth.uid() in (s.tutor_id, s.student_id)
      and events.user_id in (s.tutor_id, s.student_id)
      and events.user_id <> auth.uid()
    )
  );

-- session_reminder_24h / session_reminder_1h are inserted only by the
-- session-reminders scheduled function, using the service_role key, which
-- bypasses RLS entirely — no client-facing insert policy for those two.

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
  elsif new.type = 'session_booked' then
    v_title := 'New session request from ' || coalesce(new.payload->>'other_name', 'a student');
    v_body := 'Review and confirm it from your dashboard.';
    v_link := '/dashboard';
  elsif new.type = 'session_confirmed' then
    v_title := 'Session confirmed with ' || coalesce(new.payload->>'other_name', 'your tutor');
    v_body := coalesce(new.payload->>'when_text', '');
    v_link := '/dashboard';
  elsif new.type = 'session_cancelled' then
    v_title := 'Session cancelled';
    v_body := coalesce(new.payload->>'other_name', 'The other participant') || ' cancelled your session.';
    v_link := '/dashboard';
  elsif new.type = 'session_reminder_24h' then
    v_title := 'Session tomorrow';
    v_body := 'Your session with ' || coalesce(new.payload->>'other_name', 'someone') || ' is in about 24 hours.';
    v_link := '/dashboard';
  elsif new.type = 'session_reminder_1h' then
    v_title := 'Session starting soon';
    v_body := 'Your session with ' || coalesce(new.payload->>'other_name', 'someone') || ' starts in about an hour.';
    v_link := '/dashboard';
  else
    -- weekly_digest is sent directly by the scheduled function, not via
    -- events, so there is deliberately no case for it here.
    return new;
  end if;

  insert into public.notifications (user_id, title, body, link)
  values (new.user_id, v_title, v_body, v_link);

  return new;
end;
$$ language plpgsql security definer;
