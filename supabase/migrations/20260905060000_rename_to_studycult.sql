-- Renaming StudyBridge -> StudyCult (name collision with an existing app).
-- handle_new_user and handle_new_event have both been redefined by several
-- earlier migrations already — per this project's own rule, those old files
-- stay as-is (they're history), so the branding text they happen to contain
-- is corrected here instead, in the two functions' current live definitions.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_referrer_id uuid;
begin
  insert into public.profiles (id, full_name, role, terms_accepted_at, photo_consent)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'New user'
    ),
    new.raw_user_meta_data->>'role',
    now(),
    coalesce((new.raw_user_meta_data->>'photo_consent')::boolean, false)
  );

  insert into public.events (user_id, type, payload)
  values (new.id, 'welcome', jsonb_build_object('email', new.email));

  begin
    v_referrer_id := nullif(new.raw_user_meta_data->>'referred_by', '')::uuid;
  exception when others then
    v_referrer_id := null;
  end;

  if v_referrer_id is not null and v_referrer_id <> new.id
     and exists (select 1 from public.profiles where id = v_referrer_id) then
    insert into public.referrals (referrer_id, referred_id)
    values (v_referrer_id, new.id)
    on conflict (referred_id) do nothing;

    insert into public.notifications (user_id, title, body, link)
    values (v_referrer_id, 'Referral signup! 🎉', 'Someone joined StudyCult using your referral link.', '/profile');
  end if;

  return new;
end;
$$ language plpgsql security definer;

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
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, body, link)
  values (new.user_id, v_title, v_body, v_link);

  return new;
end;
$$ language plpgsql security definer;
