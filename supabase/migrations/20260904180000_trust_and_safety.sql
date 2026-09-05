-- ============================================================
-- Trust & safety: tutor verification, reviews, reporting/blocking, and
-- basic message moderation. The full admin review queue is out of scope
-- here (you've flagged it as its own later section) — this migration adds
-- is_admin and a `handle_new_report` fan-out into the existing notification
-- bell so reports are at least visible to admins now, without building a
-- dedicated queue UI ahead of that section.
-- ============================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists verification_status text not null default 'unverified'
  check (verification_status in ('unverified', 'pending', 'verified'));

-- ---------- Tutor verification documents (private Storage bucket) ----------

insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

create policy "Users can upload their own verification documents"
  on storage.objects for insert
  with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own verification documents"
  on storage.objects for select
  using (
    bucket_id = 'verification-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    )
  );

-- ---------- Reviews ----------

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (session_id, reviewer_id)
);

alter table public.reviews enable row level security;

create policy "Reviews are viewable by everyone"
  on public.reviews for select using (true);

create policy "Session participants can review each other once"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_id
      and s.status = 'completed'
      and auth.uid() in (s.tutor_id, s.student_id)
      and reviewee_id = case when s.tutor_id = auth.uid() then s.student_id else s.tutor_id end
    )
  );

-- ---------- Blocking ----------

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocked_users enable row level security;

create policy "Users can view their own blocks"
  on public.blocked_users for select using (auth.uid() = blocker_id);

create policy "Users can block someone"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

create policy "Users can unblock someone"
  on public.blocked_users for delete using (auth.uid() = blocker_id);

-- Enforced here, not just hidden in the UI: a blocked user's insert into
-- messages fails outright if anyone else in that conversation has blocked them.
drop policy if exists "Members can send messages in their conversations" on public.messages;
create policy "Members can send messages in their conversations"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.blocked_users bu
      join public.conversation_members cm2 on cm2.user_id = bu.blocker_id
      where bu.blocked_id = auth.uid()
      and cm2.conversation_id = messages.conversation_id
    )
  );

-- ---------- Reporting ----------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "Reporters and admins can view reports"
  on public.reports for select
  using (
    auth.uid() = reporter_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

create policy "Users can file a report"
  on public.reports for insert
  with check (auth.uid() = reporter_id and reporter_id <> reported_user_id);

create policy "Admins can update report status"
  on public.reports for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Surfaces new reports to admins via the existing notification bell, without
-- building the dedicated review queue UI that's coming in a later section.
create or replace function public.handle_new_report()
returns trigger as $$
begin
  insert into public.notifications (user_id, title, body, link)
  select p.id, 'New report filed', new.reason, '/dashboard'
  from public.profiles p
  where p.is_admin;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_report_created on public.reports;
create trigger on_report_created
  after insert on public.reports
  for each row execute procedure public.handle_new_report();

-- ---------- Basic message moderation ----------

alter table public.messages add column if not exists flagged boolean not null default false;
alter table public.messages add column if not exists flag_reason text;

-- Configurable without a redeploy — an admin manages entries directly (via
-- SQL Editor or Table Editor) until Section 10 gives this its own UI. Seeded
-- with one placeholder rather than a curated list, since authoring a real
-- blocklist isn't something to embed casually in a migration file.
create table if not exists public.moderation_blocklist (
  term text primary key
);

alter table public.moderation_blocklist enable row level security;

create policy "Blocklist terms are viewable by everyone"
  on public.moderation_blocklist for select using (true);

insert into public.moderation_blocklist (term) values ('example-flagged-term')
on conflict do nothing;
