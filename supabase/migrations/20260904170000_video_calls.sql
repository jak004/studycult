-- ============================================================
-- Live video via Daily.co. A room is created lazily (on first "Start video
-- call" click) and cached on whichever record makes sense: the sessions row
-- if this conversation has an upcoming/active booked session, otherwise the
-- conversation itself for ad-hoc calls. Rooms auto-expire on Daily's side
-- (see the `exp` property set in create-video-room), so no cleanup job here.
-- ============================================================

alter table public.conversations add column if not exists video_room_url text;
alter table public.conversations add column if not exists video_room_expires_at timestamptz;

alter table public.sessions add column if not exists video_room_url text;
alter table public.sessions add column if not exists video_room_expires_at timestamptz;
