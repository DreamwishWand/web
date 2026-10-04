insert into private.community_retention_policy(policy_key,integer_value,updated_at)
values
  ('deleted_account_operational_days',90,now()),
  ('deleted_account_elevated_operational_days',365,now())
on conflict (policy_key) do update
set integer_value=excluded.integer_value,
    updated_at=now();

alter table public.account_deletion_events
  add column if not exists routine_operational_scrubbed_at timestamptz null,
  add column if not exists elevated_operational_scrub_after timestamptz null,
  add column if not exists elevated_operational_scrubbed_at timestamptz null;

alter table private.account_retention_jobs
  drop constraint if exists account_retention_jobs_stage_check;

alter table private.account_retention_jobs
  add constraint account_retention_jobs_stage_check
  check (stage in ('content_payload','operational_detail','elevated_operational_detail'));

create or replace function private.community_schedule_account_retention()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_content_days integer;
  v_routine_days integer;
  v_elevated_days integer;
begin
  select integer_value into v_content_days
  from private.community_retention_policy
  where policy_key='deleted_account_content_days';

  select integer_value into v_routine_days
  from private.community_retention_policy
  where policy_key='deleted_account_operational_days';

  select integer_value into v_elevated_days
  from private.community_retention_policy
  where policy_key='deleted_account_elevated_operational_days';

  if v_content_days is null or v_routine_days is null or v_elevated_days is null then
    raise exception 'Community retention policy is incomplete';
  end if;

  new.content_purge_after := coalesce(
    new.content_purge_after,
    new.requested_at + make_interval(days=>v_content_days)
  );
  new.operational_scrub_after := coalesce(
    new.operational_scrub_after,
    new.requested_at + make_interval(days=>v_routine_days)
  );
  new.elevated_operational_scrub_after := coalesce(
    new.elevated_operational_scrub_after,
    new.requested_at + make_interval(days=>v_elevated_days)
  );

  return new;
end;
$$;

create or replace function private.community_enqueue_retention_jobs()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  insert into private.account_retention_jobs(
    deletion_event_id,account_id,stage,due_at,next_attempt_at
  ) values (
    new.deletion_event_id,new.account_id,'content_payload',
    new.content_purge_after,new.content_purge_after
  )
  on conflict (account_id,stage) do nothing;

  insert into private.account_retention_jobs(
    deletion_event_id,account_id,stage,due_at,next_attempt_at
  ) values (
    new.deletion_event_id,new.account_id,'operational_detail',
    new.operational_scrub_after,new.operational_scrub_after
  )
  on conflict (account_id,stage) do nothing;

  insert into private.account_retention_jobs(
    deletion_event_id,account_id,stage,due_at,next_attempt_at
  ) values (
    new.deletion_event_id,new.account_id,'elevated_operational_detail',
    new.elevated_operational_scrub_after,new.elevated_operational_scrub_after
  )
  on conflict (account_id,stage) do nothing;

  return new;
end;
$$;

update public.account_deletion_events e
set
  operational_scrub_after=e.requested_at + interval '90 days',
  elevated_operational_scrub_after=e.requested_at + interval '365 days'
where e.operational_scrubbed_at is null;

update private.account_retention_jobs j
set
  due_at=e.requested_at + interval '90 days',
  next_attempt_at=case
    when j.state='pending' then e.requested_at + interval '90 days'
    else j.next_attempt_at
  end
from public.account_deletion_events e
where j.deletion_event_id=e.deletion_event_id
  and j.stage='operational_detail'
  and j.state<>'completed';

insert into private.account_retention_jobs(
  deletion_event_id,account_id,stage,due_at,next_attempt_at
)
select
  e.deletion_event_id,
  e.account_id,
  'elevated_operational_detail',
  e.requested_at + interval '365 days',
  e.requested_at + interval '365 days'
from public.account_deletion_events e
where e.operational_scrubbed_at is null
on conflict (account_id,stage) do nothing;

create or replace function public.community_claim_account_retention_jobs(
  p_limit integer,
  p_lock_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_limit integer;
  v_jobs jsonb;
begin
  if p_lock_token is null then
    raise exception 'Retention lock token is required';
  end if;
  v_limit := least(greatest(coalesce(p_limit,10),1),50);

  with candidates as (
    select j.retention_job_id
    from private.account_retention_jobs j
    where (
      (j.state='pending' and j.next_attempt_at <= now() and j.due_at <= now())
      or (j.state='processing' and j.locked_at < now()-interval '10 minutes')
    )
      and not private.community_account_has_retention_hold(j.account_id)
      and (
        j.stage='content_payload'
        or (
          j.stage='operational_detail'
          and exists (
            select 1 from public.account_deletion_events e
            where e.deletion_event_id=j.deletion_event_id
              and e.content_purged_at is not null
          )
        )
        or (
          j.stage='elevated_operational_detail'
          and exists (
            select 1 from public.account_deletion_events e
            where e.deletion_event_id=j.deletion_event_id
              and e.routine_operational_scrubbed_at is not null
          )
        )
      )
    order by j.due_at,j.retention_job_id
    for update skip locked
    limit v_limit
  ),
  claimed as (
    update private.account_retention_jobs j
    set state='processing',locked_at=now(),lock_token=p_lock_token
    where j.retention_job_id in (select retention_job_id from candidates)
    returning j.retention_job_id,j.deletion_event_id,j.account_id,j.stage,j.attempts
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'retentionJobId',c.retention_job_id,
        'deletionEventId',c.deletion_event_id,
        'accountId',c.account_id,
        'stage',c.stage,
        'attempts',c.attempts,
        'mediaStorageKeys',
          case when c.stage='content_payload' then (
            select coalesce(jsonb_agg(m.storage_key order by m.media_id),'[]'::jsonb)
            from public.media_assets m
            where m.owner_account_id=c.account_id and m.purged_at is null
          ) else '[]'::jsonb end,
        'artifactBlobCount',
          case when c.stage='content_payload' then (
            select count(*) from public.artifact_blobs b
            where b.owner_account_id=c.account_id and b.purged_at is null
          ) else 0 end
      ) order by c.retention_job_id
    ),'[]'::jsonb
  ) into v_jobs
  from claimed c;

  return jsonb_build_object('lockToken',p_lock_token,'jobs',v_jobs);
end;
$$;

create or replace function public.community_complete_account_retention_job(
  p_retention_job_id uuid,
  p_lock_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_job private.account_retention_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_media_count integer := 0;
  v_work_revision_count integer := 0;
  v_preset_revision_count integer := 0;
begin
  select * into v_job
  from private.account_retention_jobs
  where retention_job_id=p_retention_job_id
    and state='processing'
    and lock_token=p_lock_token
  for update;

  if v_job.retention_job_id is null then
    raise exception 'Claimed retention job not found';
  end if;
  if private.community_account_has_retention_hold(v_job.account_id) then
    raise exception 'Retention hold became active';
  end if;

  if v_job.stage='content_payload' then
    if exists (
      select 1 from public.artifact_blobs b
      where b.owner_account_id=v_job.account_id and b.purged_at is null
    ) then
      raise exception 'Preset artifact storage purge adapter is not available';
    end if;

    update public.media_assets
    set storage_key='purged:' || media_id::text,
        mime_type='application/x-purged',
        byte_size=0,width=null,height=null,
        checksum_sha256=repeat('0',64),purged_at=v_now
    where owner_account_id=v_job.account_id and purged_at is null;
    get diagnostics v_media_count=row_count;

    update public.community_work_revisions r
    set shared_metadata='{}'::jsonb
    from public.community_works w
    where r.work_id=w.work_id and w.owner_account_id=v_job.account_id;
    get diagnostics v_work_revision_count=row_count;

    update public.gallery_work_revisions g
    set title='[deleted]',description=null,metadata='{}'::jsonb
    where exists (
      select 1 from public.community_work_revisions r
      join public.community_works w on w.work_id=r.work_id
      where r.revision_id=g.revision_id and w.owner_account_id=v_job.account_id
    );

    update public.preset_revisions p
    set metadata='{}'::jsonb
    where exists (
      select 1 from public.preset_artifacts a
      where a.preset_artifact_id=p.preset_artifact_id
        and a.owner_account_id=v_job.account_id
    );
    get diagnostics v_preset_revision_count=row_count;

    delete from public.idempotency_keys where account_id=v_job.account_id;

    update public.account_deletion_events
    set content_purged_at=v_now,retention_state='purge_scheduled'
    where deletion_event_id=v_job.deletion_event_id;

    insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
    values (
      null,'retention.content_purged',null,
      jsonb_build_object(
        'accountId',v_job.account_id,'deletionEventId',v_job.deletion_event_id,
        'mediaCount',v_media_count,'workRevisionCount',v_work_revision_count,
        'presetRevisionCount',v_preset_revision_count
      )
    );

  elsif v_job.stage='operational_detail' then
    if not exists (
      select 1 from public.account_deletion_events
      where deletion_event_id=v_job.deletion_event_id and content_purged_at is not null
    ) then
      raise exception 'Content purge must complete before routine operational scrub';
    end if;

    update public.notification_events
    set actor_account_id=null
    where actor_account_id=v_job.account_id;

    update public.reports r
    set reporter_account_id=case when r.reporter_account_id=v_job.account_id then null else r.reporter_account_id end,
        detail=null
    where r.status in ('closed','rejected')
      and (
        r.reporter_account_id=v_job.account_id
        or private.community_entity_owned_by_account(r.target_entity_id,v_job.account_id)
      )
      and not exists (
        select 1 from public.moderation_case_reports mcr where mcr.report_id=r.report_id
      )
      and not exists (
        select 1 from private.account_retention_holds h
        where h.account_id=v_job.account_id
          and h.hold_type in ('moderation','security','legal')
      );

    update public.audit_events
    set actor_account_id=case when actor_account_id=v_job.account_id then null else actor_account_id end,
        request_correlation_id=null,
        metadata='{}'::jsonb
    where actor_account_id=v_job.account_id
       or metadata->>'accountId'=v_job.account_id::text;

    delete from public.account_recovery_cases
    where account_id=v_job.account_id and state in ('completed','rejected','cancelled');
    delete from private.provider_cleanup_jobs
    where account_id=v_job.account_id and state='completed';

    update public.account_deletion_events
    set routine_operational_scrubbed_at=v_now
    where deletion_event_id=v_job.deletion_event_id;

    insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
    values (null,'retention.routine_operational_scrubbed',null,
      jsonb_build_object('deletionEventId',v_job.deletion_event_id));

  elsif v_job.stage='elevated_operational_detail' then
    if not exists (
      select 1 from public.account_deletion_events
      where deletion_event_id=v_job.deletion_event_id
        and routine_operational_scrubbed_at is not null
    ) then
      raise exception 'Routine operational scrub must complete before elevated operational scrub';
    end if;

    update public.reports r
    set reporter_account_id=case when r.reporter_account_id=v_job.account_id then null else r.reporter_account_id end,
        detail=null
    where r.status in ('closed','rejected')
      and (
        r.reporter_account_id=v_job.account_id
        or private.community_entity_owned_by_account(r.target_entity_id,v_job.account_id)
      );

    update public.moderation_actions a
    set actor_account_id=case when a.actor_account_id=v_job.account_id then null else a.actor_account_id end,
        reason='[retained moderation action]',
        prior_state='{}'::jsonb,
        resulting_state='{}'::jsonb
    where exists (
      select 1 from public.moderation_cases c
      where c.case_id=a.case_id and c.status in ('resolved','closed')
        and private.community_entity_owned_by_account(c.target_entity_id,v_job.account_id)
    ) or a.actor_account_id=v_job.account_id;

    update private.account_retention_holds
    set reason='[scrubbed retention hold]'
    where account_id=v_job.account_id and released_at is not null;

    update public.account_deletion_events
    set operational_scrubbed_at=v_now,
        elevated_operational_scrubbed_at=v_now,
        retention_state='purged'
    where deletion_event_id=v_job.deletion_event_id;

    insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
    values (null,'retention.operational_scrubbed',null,
      jsonb_build_object('deletionEventId',v_job.deletion_event_id));
  else
    raise exception 'Unsupported retention stage';
  end if;

  update private.account_retention_jobs
  set state='completed',attempts=attempts+1,last_error=null,completed_at=v_now,
      locked_at=null,lock_token=null
  where retention_job_id=p_retention_job_id;

  return jsonb_build_object(
    'retentionJobId',p_retention_job_id,'stage',v_job.stage,
    'state','completed','completedAt',v_now
  );
end;
$$;

revoke execute on function private.community_schedule_account_retention()
from public,anon,authenticated,service_role;
revoke execute on function private.community_enqueue_retention_jobs()
from public,anon,authenticated,service_role;
