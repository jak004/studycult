-- "Discover rooms" on the Messages page was querying conversations for
-- is_group = true platform-wide, expecting to find rooms the user hasn't
-- joined yet — but the only SELECT policies on conversations were "you're
-- already a member" and "you created it", so a room made by someone else was
-- invisible to that query before it ever left Postgres. The join button had
-- nothing genuinely new to ever show.
--
-- Safe to open up: this only exposes a group room's name/subject/created_by,
-- not its messages, which stay gated by the separate, still-membership-only
-- policy on the messages table. Direct (non-group) conversations are
-- untouched — this policy only matches is_group = true rows.
create policy "Group conversations are discoverable by anyone signed in"
  on public.conversations for select
  using (is_group = true);
