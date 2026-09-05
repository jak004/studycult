-- Video calls moved from Daily.co (which required a payment method on file
-- even for "free" usage) to a direct Jitsi Meet embed, which needs no room
-- record at all — the room name is derived from the conversation id on the
-- fly. These columns existed only to cache a Daily room URL/expiry.
alter table public.conversations drop column if exists video_room_url;
alter table public.conversations drop column if exists video_room_expires_at;
alter table public.sessions drop column if exists video_room_url;
alter table public.sessions drop column if exists video_room_expires_at;
