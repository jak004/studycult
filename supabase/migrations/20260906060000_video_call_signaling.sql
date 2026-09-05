-- "Start video call" previously only opened the Jitsi room locally for
-- whoever clicked it — nothing told the other participant a call had
-- started, so they'd only ever join if they happened to click the same
-- button themselves at the same time. This adds a real-time broadcast (see
-- ChatWindow.jsx) plus a persistent in-app notification for whenever the
-- other person isn't currently looking at this conversation. In-app only,
-- deliberately no email: by the time an emailed invite would arrive, the
-- call is almost certainly over.
alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type in (
    'welcome', 'new_message', 'quiz_result', 'weekly_digest',
    'session_booked', 'session_confirmed', 'session_cancelled',
    'session_reminder_24h', 'session_reminder_1h',
    'payment_received', 'payout_sent',
    'video_call_started'
  )
);

create policy "Members can queue a video_call_started event for their conversation"
  on public.events for insert
  with check (
    type = 'video_call_started'
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = (payload->>'conversation_id')::uuid
      and cm.user_id = auth.uid()
    )
  );

create or replace function public.handle_new_event()
returns trigger as $$
declare
  v_title text;
  v_body text;
  v_link text;
begin
  if new.type = 'welcome' then
    v_title := 'Welcome to StudyCult 🎓';
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
  elsif new.type = 'payment_received' then
    v_title := 'Payment received';
    v_body := coalesce(new.payload->>'other_name', 'Your student') || ' paid for your upcoming session.';
    v_link := '/dashboard';
  elsif new.type = 'payout_sent' then
    v_title := 'Payout sent';
    v_body := 'Your payout for the session with ' || coalesce(new.payload->>'other_name', 'your student') || ' is on its way.';
    v_link := '/dashboard';
  elsif new.type = 'video_call_started' then
    v_title := '📹 Video call started';
    v_body := coalesce(new.payload->>'caller_name', 'Someone') || ' started a video call — join now.';
    v_link := '/messages?c=' || (new.payload->>'conversation_id');
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, body, link)
  values (new.user_id, v_title, v_body, v_link);

  return new;
end;
$$ language plpgsql security definer;
