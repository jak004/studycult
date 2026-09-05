-- Powers no-login parent/guardian progress reports: a student generates a
-- link carrying an unguessable token, and anyone with that link (a parent,
-- no account needed) can view a read-only summary via the progress-report
-- edge function. The table itself stays locked to the owning student —
-- the edge function reads it with the service role, so no anon SELECT
-- policy is needed (or wanted; that would let anyone enumerate tokens).
create table public.progress_share_links (
  token uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.progress_share_links enable row level security;

create policy "Students manage their own share links"
  on public.progress_share_links for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
