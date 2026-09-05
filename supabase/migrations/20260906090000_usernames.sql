-- Lets a student pick a display name shown to other students (peers, group
-- study rooms) instead of their real name — see displayName() in
-- src/lib/names.js for exactly where this applies. A tutor's own name stays
-- public everywhere (it's already shown on their listing in Tutors), and a
-- tutor always sees a student's real full_name regardless of this column.
--
-- No RLS change needed: profiles has always been fully readable by any
-- signed-in user ("Profiles are viewable by everyone"), so this is purely a
-- display-layer choice made in the app, the same as every other profile
-- field that isn't shown in every context.
alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;
