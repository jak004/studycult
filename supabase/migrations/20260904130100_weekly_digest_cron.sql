-- Runs the weekly-digest Edge Function every Monday at 08:00 UTC.
-- Requires the pg_cron and pg_net extensions — if this errors, enable them
-- first under Database → Extensions in the Supabase dashboard, then re-run.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Before running this migration, replace:
--   <project-ref>   — from your Supabase project URL (Project Settings → General)
--   <cron-secret>   — must match what you set with `supabase secrets set CRON_SECRET=...`
--                      (pick any long random string, just keep the two in sync)
select cron.schedule(
  'weekly-digest',
  '0 8 * * 1',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object('Authorization', 'Bearer <cron-secret>'),
    body := '{}'::jsonb
  );
  $$
);
