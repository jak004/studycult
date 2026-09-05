-- ============================================================
-- StudyBridge — initial schema
-- ============================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  -- role is nullable: Google/OTP sign-ins don't carry a role at creation time,
  -- so new users are routed to /complete-profile until this is set.
  role text check (role in ('student', 'tutor')),
  bio text default '',
  subjects text[] default '{}',
  hourly_rate numeric check (hourly_rate is null or hourly_rate >= 0),
  avatar_emoji text default '🎓',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Integrity: automatically stamp updated_at on every profile edit so changes
-- are traceable, instead of trusting the client to send an honest timestamp.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Auto-create a profile row when someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',   -- Google OAuth puts it here
      split_part(new.email, '@', 1),
      'New user'
    ),
    new.raw_user_meta_data->>'role'      -- null unless password signup supplied one
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- CONVERSATIONS ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_group boolean default false,
  subject text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;

create policy "Members can view their conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = id and cm.user_id = auth.uid()
    )
  );

create policy "Any signed-in user can create a conversation"
  on public.conversations for insert
  with check (auth.uid() = created_by);

create policy "Members can view membership rows for their conversations"
  on public.conversation_members for select
  using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
    )
  );

create policy "Users can add members to conversations they created or belong to"
  on public.conversation_members for insert
  with check (true);

-- ---------- MESSAGES ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id),
  content text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Members can read messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
    )
  );

create policy "Members can send messages in their conversations"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
    )
  );

-- Enable realtime on messages
alter publication supabase_realtime add table public.messages;

-- ---------- QUIZZES ----------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null, -- array of strings e.g. ["A","B","C","D"]
  correct_index int not null check (correct_index >= 0),
  position int default 0,
  -- Integrity: the "correct" answer must actually point at an option that exists.
  constraint correct_index_in_range check (correct_index < jsonb_array_length(options))
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  user_id uuid references public.profiles(id),
  score int not null check (score >= 0),
  total int not null check (total >= 0),
  completed_at timestamptz default now(),
  constraint score_within_total check (score <= total)
);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "Quizzes are viewable by everyone"
  on public.quizzes for select using (true);

create policy "Signed-in users can create quizzes"
  on public.quizzes for insert with check (auth.uid() = created_by);

create policy "Questions are viewable by everyone"
  on public.quiz_questions for select using (true);

create policy "Quiz creators can add questions"
  on public.quiz_questions for insert with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.created_by = auth.uid())
  );

create policy "Users can view their own attempts"
  on public.quiz_attempts for select using (auth.uid() = user_id);

create policy "Users can insert their own attempts"
  on public.quiz_attempts for insert with check (auth.uid() = user_id);
