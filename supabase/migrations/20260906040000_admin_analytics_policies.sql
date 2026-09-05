-- Admins need platform-wide read access for the analytics dashboard, which
-- none of these three tables grant today. This also fixes a real bug in the
-- existing /admin "Quizzes taken (7d)" metric: quiz_attempts' only SELECT
-- policy is "auth.uid() = user_id" (self only), so that count has always
-- silently reflected just the logged-in admin's own attempts, not the
-- platform's.
create policy "Admins can view all sessions"
  on public.sessions for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admins can view all payments"
  on public.payments for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Admins can view all quiz attempts"
  on public.quiz_attempts for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
