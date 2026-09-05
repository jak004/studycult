-- ============================================================
-- Splits full_name into first/middle/last, entered as separate fields on
-- Signup and Profile — full_name stays the single source of truth every
-- existing display in the app already reads (chat, dashboard, tutor cards,
-- reviews, admin, notifications…), auto-recomputed from the parts whenever
-- they're set so none of those call sites need to change.
-- ============================================================

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists middle_name text;
alter table public.profiles add column if not exists last_name text;

create or replace function public.sync_full_name_from_parts()
returns trigger as $$
begin
  -- Only recompute when parts are actually provided — leaves full_name alone
  -- for rows that never set first/last (existing accounts from before this
  -- migration, or a Google sign-in that only ever supplied one combined name).
  if new.first_name is not null or new.last_name is not null then
    new.full_name := trim(both ' ' from concat_ws(' ', new.first_name, nullif(new.middle_name, ''), new.last_name));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_sync_full_name on public.profiles;
create trigger profiles_sync_full_name
  before insert or update on public.profiles
  for each row execute procedure public.sync_full_name_from_parts();

-- handle_new_user has been redefined by several earlier migrations already —
-- per this project's own rule, those stay as-is (they're history), so its
-- current live body is repeated here verbatim with first/middle/last support
-- added on top: Signup.jsx now sends first_name/middle_name/last_name in the
-- signup metadata instead of one combined full_name, but Google/OTP sign-ins
-- still only ever supply the single combined field, so both paths are kept.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_referrer_id uuid;
  v_first_name text := new.raw_user_meta_data->>'first_name';
  v_middle_name text := new.raw_user_meta_data->>'middle_name';
  v_last_name text := new.raw_user_meta_data->>'last_name';
begin
  insert into public.profiles (id, full_name, first_name, middle_name, last_name, role, terms_accepted_at, photo_consent)
  values (
    new.id,
    coalesce(
      case when v_first_name is not null or v_last_name is not null
        then nullif(trim(both ' ' from concat_ws(' ', v_first_name, nullif(v_middle_name, ''), v_last_name)), '')
      end,
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'New user'
    ),
    v_first_name,
    v_middle_name,
    v_last_name,
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
