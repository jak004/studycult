-- ============================================================
-- Courses: lets a tutor bundle a persistent slide/material library with a
-- set of quizzes into something a student can browse and enroll in, instead
-- of slides only existing transiently as quiz-generation input. Materials
-- and courses are open-read to any authenticated user, matching how quizzes
-- and tutor listings already work in this app (browse-first, no walled
-- garden) — enrollment is a personal progress marker, not an access gate.
-- ============================================================

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.courses enable row level security;

create policy "Courses are viewable by everyone"
  on public.courses for select using (true);

create policy "Tutors can create their own courses"
  on public.courses for insert
  with check (
    auth.uid() = tutor_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor')
  );

create policy "Tutors can update their own courses"
  on public.courses for update
  using (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

create policy "Tutors can delete their own courses"
  on public.courses for delete
  using (auth.uid() = tutor_id);

-- A quiz can optionally belong to a course (nullable — standalone quizzes
-- made from the existing Quizzes page keep working exactly as before).
alter table public.quizzes add column if not exists course_id uuid references public.courses(id) on delete set null;

create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  -- Nullable: a material can be an uploaded file (storage_path set) or a
  -- plain-text reading typed directly into the form (storage_path null,
  -- extracted_text holds the content) — no need to round-trip a PDF for both.
  storage_path text,
  extracted_text text,
  created_at timestamptz not null default now()
);

alter table public.course_materials enable row level security;

create policy "Course materials are viewable by everyone"
  on public.course_materials for select using (true);

create policy "Course owner can add materials"
  on public.course_materials for insert
  with check (
    exists (select 1 from public.courses c where c.id = course_id and c.tutor_id = auth.uid())
  );

create policy "Course owner can delete materials"
  on public.course_materials for delete
  using (
    exists (select 1 from public.courses c where c.id = course_id and c.tutor_id = auth.uid())
  );

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, student_id)
);

alter table public.course_enrollments enable row level security;

create policy "Students can view their own enrollments"
  on public.course_enrollments for select
  using (
    auth.uid() = student_id
    or exists (select 1 from public.courses c where c.id = course_id and c.tutor_id = auth.uid())
  );

create policy "Students can enroll themselves"
  on public.course_enrollments for insert
  with check (auth.uid() = student_id);

create policy "Students can unenroll themselves"
  on public.course_enrollments for delete
  using (auth.uid() = student_id);

-- ---------- Storage: course materials ----------
-- Private bucket — files live at <course_id>/<filename>, mirroring the
-- chat-attachments pattern (path-prefixed, checked against the owning row).

insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do nothing;

create policy "Anyone signed in can view course materials"
  on storage.objects for select
  using (bucket_id = 'course-materials');

create policy "Course owner can upload materials"
  on storage.objects for insert
  with check (
    bucket_id = 'course-materials'
    and exists (
      select 1 from public.courses c
      where c.id = ((storage.foldername(name))[1])::uuid
      and c.tutor_id = auth.uid()
    )
  );

create policy "Course owner can delete materials from storage"
  on storage.objects for delete
  using (
    bucket_id = 'course-materials'
    and exists (
      select 1 from public.courses c
      where c.id = ((storage.foldername(name))[1])::uuid
      and c.tutor_id = auth.uid()
    )
  );
