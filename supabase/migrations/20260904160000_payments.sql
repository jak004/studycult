-- ============================================================
-- Payments via Paystack (not Stripe Connect — Stripe doesn't support
-- payout accounts in Ghana). Charges go to the platform's own Paystack
-- account; a tutor's share is only transferred out via a separate
-- Paystack Transfer once the session is marked completed, so money is
-- genuinely held, not auto-split at charge time the way Stripe Connect
-- subaccounts (or Paystack's own subaccount-split feature) would do it.
-- ============================================================

alter table public.profiles add column if not exists paystack_recipient_code text;
alter table public.profiles add column if not exists payout_bank_name text;
alter table public.profiles add column if not exists payout_account_last4 text;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  tutor_id uuid not null references public.profiles(id),
  -- Smallest currency unit (pesewas for GHS, kobo for NGN) — what Paystack's
  -- API itself expects and returns, so no unit conversion happens in between.
  amount_minor int not null check (amount_minor > 0),
  currency text not null default 'GHS',
  paystack_reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'transferred', 'refunded')),
  paystack_transfer_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "Participants can view their payments"
  on public.payments for select
  using (auth.uid() in (student_id, tutor_id));

-- No insert/update policy for regular clients — every write goes through an
-- Edge Function using the service_role key (create-payment, and the webhook
-- reconciling status from Paystack itself). A student-supplied amount or a
-- browser-reported "paid" status is exactly what payment fraud looks like.

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute procedure public.set_updated_at();

-- ---------- Wire payments into the existing events/notifications pipeline ----------

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check check (
  type in (
    'welcome', 'new_message', 'quiz_result', 'weekly_digest',
    'session_booked', 'session_confirmed', 'session_cancelled',
    'session_reminder_24h', 'session_reminder_1h',
    'payment_received', 'payout_sent'
  )
);

alter table public.profiles alter column notification_prefs set default
  '{"welcome": true, "new_message": true, "quiz_result": true, "weekly_digest": true,
    "session_booked": true, "session_confirmed": true, "session_cancelled": true,
    "session_reminder_24h": true, "session_reminder_1h": true,
    "payment_received": true, "payout_sent": true}'::jsonb;

-- Both event types here are inserted only by the paystack-webhook and
-- release-payment Edge Functions (service_role, bypasses RLS) — payment
-- status must be driven by Paystack's own confirmation, never by a client
-- claiming "I paid" or "I got paid".

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
  elsif new.type = 'payment_received' then
    v_title := 'Payment received';
    v_body := coalesce(new.payload->>'other_name', 'Your student') || ' paid for your upcoming session.';
    v_link := '/dashboard';
  elsif new.type = 'payout_sent' then
    v_title := 'Payout sent';
    v_body := 'Your payout for the session with ' || coalesce(new.payload->>'other_name', 'your student') || ' is on its way.';
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
