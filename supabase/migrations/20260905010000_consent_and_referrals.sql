-- ============================================================
-- Terms/Privacy consent tracking, and a referral program. Both are captured
-- server-side in handle_new_user (security definer, bypasses RLS) rather
-- than via a client insert — a referral row or an accepted-terms timestamp
-- both need to be trustworthy, not just whatever the browser claims.
-- ============================================================

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists photo_consent boolean not null default false;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (referred_id) -- each account can only ever be credited to one referrer
);

alter table public.referrals enable row level security;

create policy "Users can view their own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id);

-- No insert policy for clients — only handle_new_user (below) writes here,
-- so a referral can't be faked by calling the API directly.

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

  -- Referral attribution — only wired up for password signups (the only
  -- path where we control what lands in raw_user_meta_data); Google OAuth
  -- populates this from the provider's own data, so referrals via Google
  -- sign-in aren't tracked. Guarded against a malformed/tampered id instead
  -- of letting a bad cast abort the whole signup.
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
    values (v_referrer_id, 'Referral signup! 🎉', 'Someone joined StudyBridge using your referral link.', '/profile');
  end if;

  return new;
end;
$$ language plpgsql security definer;
