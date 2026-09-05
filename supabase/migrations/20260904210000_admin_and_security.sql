-- ============================================================
-- Admin capabilities + security hardening. Note: Postgres RLS has no notion
-- of column-level restrictions — a policy governs which ROWS a role can
-- touch, not which columns. "Exclude is_admin from what users can update" is
-- therefore implemented as a trigger that silently reverts any change to
-- is_admin unless the request is authenticated as service_role (the anon/
-- authenticated roles used by every client request are blocked; a raw SQL
-- Editor session, which carries no JWT role claim at all, is deliberately
-- left unblocked so you can still flip it by hand as documented in the
-- trust-and-safety section).
-- ============================================================

create or replace function public.protect_admin_column()
returns trigger as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.role() in ('anon', 'authenticated') then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_is_admin on public.profiles;
create trigger protect_is_admin
  before update on public.profiles
  for each row execute procedure public.protect_admin_column();

-- Admins need to update OTHER people's profiles (approving/rejecting a
-- tutor's verification_status) — the existing "own profile only" policy
-- doesn't cover that. This grants admins row access to any profile; the
-- trigger above still protects the is_admin column specifically regardless.
create policy "Admins can update any profile"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Admins acting from /admin (approving a tutor, etc.) need to push an
-- in-app notification to the affected user — the notifications table
-- otherwise has no client-facing insert policy at all (by design, from the
-- trust-and-safety migration).
create policy "Admins can notify a user directly"
  on public.notifications for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- Audit log ----------
-- Genuinely append-only: no update or delete policy exists for ANY role,
-- admins included — the only way to alter a row is a superuser at the
-- database level, which is the point of an audit trail.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Admins can view the audit log"
  on public.audit_log for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admins can write audit log entries"
  on public.audit_log for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Edge Functions log payment state changes using the service_role key, which
-- bypasses RLS entirely (as it does everywhere else in this schema) — that's
-- how paystack-webhook and release-payment write rows despite not being "an
-- admin" themselves.

-- ---------- Rate limiting ----------
-- Enforced in the database, not an Edge Function — this way it holds no
-- matter which code path performs the insert, and needs no separate
-- infrastructure. Supabase's built-in rate limiting is real but specific to
-- Auth endpoints (signup, OTP, token refresh); it doesn't extend to
-- arbitrary tables or custom Edge Functions, which is what's needed here.

create or replace function public.enforce_message_rate_limit()
returns trigger as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.messages
  where sender_id = new.sender_id
  and created_at > now() - interval '1 minute';

  if recent_count >= 20 then
    raise exception 'Rate limit exceeded: too many messages sent recently. Please wait a moment.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
  before insert on public.messages
  for each row execute procedure public.enforce_message_rate_limit();

create or replace function public.enforce_quiz_attempt_rate_limit()
returns trigger as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.quiz_attempts
  where user_id = new.user_id
  and completed_at > now() - interval '1 minute';

  if recent_count >= 10 then
    raise exception 'Rate limit exceeded: too many quiz submissions recently. Please wait a moment.';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists quiz_attempts_rate_limit on public.quiz_attempts;
create trigger quiz_attempts_rate_limit
  before insert on public.quiz_attempts
  for each row execute procedure public.enforce_quiz_attempt_rate_limit();
