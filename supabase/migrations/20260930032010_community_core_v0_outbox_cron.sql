
create extension if not exists pg_cron;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname='community-outbox-every-minute';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'community-outbox-every-minute',
    '* * * * *',
    'select public.community_process_outbox_batch(100);'
  );
end;
$$;
