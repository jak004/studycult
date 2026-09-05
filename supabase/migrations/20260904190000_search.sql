-- ============================================================
-- Full-text tutor search, replacing the client-side subject filter in
-- Tutors.jsx. Note: a `generated always as (to_tsvector(...)) stored` column
-- (as commonly suggested) actually fails in Postgres — to_tsvector(regconfig,
-- text) isn't classified STABLE... IMMUTABLE, and generated columns require
-- an immutable expression. A trigger-maintained column is the standard,
-- reliable way to get the same result, so that's what this does instead.
-- ============================================================

alter table public.profiles add column if not exists languages text[] not null default '{}';
alter table public.profiles add column if not exists search_vector tsvector;

create or replace function public.profiles_search_vector_update()
returns trigger as $$
begin
  new.search_vector := to_tsvector(
    'english',
    coalesce(new.bio, '') || ' ' || coalesce(array_to_string(new.subjects, ' '), '')
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_search_vector_trigger on public.profiles;
create trigger profiles_search_vector_trigger
  before insert or update on public.profiles
  for each row execute procedure public.profiles_search_vector_update();

update public.profiles
set search_vector = to_tsvector('english', coalesce(bio, '') || ' ' || coalesce(array_to_string(subjects, ' '), ''));

create index if not exists profiles_search_vector_idx on public.profiles using gin (search_vector);
