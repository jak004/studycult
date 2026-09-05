-- Runs session-reminders every 15 minutes to catch sessions crossing the
-- T-24h/T-1h thresholds. Requires pg_cron/pg_net (see the weekly_digest_cron
-- migration for the same prerequisite).
--
-- Before running, replace:
--   <project-ref>   — from your Supabase project URL
--   <cron-secret>   — the same CRON_SECRET used for weekly-digest
select cron.schedule(
  'session-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/session-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <cron-secret>'),
    body := '{}'::jsonb
  );
  $$
);
