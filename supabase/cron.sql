-- =====================================================================
-- Turn on automatic emails (only once Kings has an email domain in Resend).
-- 1. Deploy the send-emails function and set its secrets (SETUP-BOOKINGS.md, part 5).
-- 2. Replace the two CHANGE-ME values below, then run this in the SQL Editor.
-- It calls the function every 10 minutes; the function sends whatever is due.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('kings-send-emails') where exists (select 1 from cron.job where jobname = 'kings-send-emails');

select cron.schedule('kings-send-emails', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://CHANGE-ME-project-ref.supabase.co/functions/v1/send-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'CHANGE-ME-cron-secret'),
    body := '{}'::jsonb)
$$);

-- To pause emails later:  select cron.unschedule('kings-send-emails');
