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
      select 1
      from public.artifact_blobs b
      where b.owner_account_id=v_job.account_id
        and b.purged_at is null
    ) then
      raise exception 'Preset artifact storage purge adapter is not available';
    end if;

    perform set_config('app.community_retention_redaction','on',true);

    update public.media_assets
    set storage_key='purged:' || media_id::text,
        mime_type='application/x-purged',
        byte_size=0,
        width=null,
        height=null,
        checksum_sha256=repeat('0',64),
        purged_at=v_now
    where owner_account_id=v_job.account_id
      and purged_at is null;
    get diagnostics v_media_count=row_count;

    update public.community_work_revisions r
    set shared_metadata='{}'::jsonb
    from public.community_works w
    where r.work_id=w.work_id
      and w.owner_account_id=v_job.account_id;
    get diagnostics v_work_revision_count=row_count;

    update public.gallery_work_revisions g
    set title='[deleted]',
        description=null,
        metadata='{}'::jsonb
    where exists (
      select 1
      from public.community_work_revisions r
      join public.community_works w on w.work_id=r.work_id
      where r.revision_id=g.revision_id
        and w.owner_account_id=v_job.account_id
    );

    update public.preset_revisions p
    set metadata='{}'::jsonb
    where exists (
      select 1
      from public.preset_artifacts a
      where a.preset_artifact_id=p.preset_artifact_id
        and a.owner_account_id=v_job.account_id
    );
    get diagnostics v_preset_revision_count=row_count;

    perform set_config('app.community_retention_redaction','off',true);

    delete from public.idempotency_keys
    where account_id=v_job.account_id;

    update public.account_deletion_events
    set content_purged_at=v_now,
        retention_state='purge_scheduled'
    where deletion_event_id=v_job.deletion_event_id;

    insert into public.audit_events(
      actor_account_id,action_type,target_entity_id,metadata
    ) values (
      null,'retention.content_purged',null,
      jsonb_build_object(
        'accountId',v_job.account_id,
        'deletionEventId',v_job.deletion_event_id,
        'mediaCount',v_media_count,
        'workRevisionCount',v_work_revision_count,
        'presetRevisionCount',v_preset_revision_count
      )
    );
  elsif v_job.stage='operational_detail' then
    if not exists (
      select 1
      from public.account_deletion_events
      where deletion_event_id=v_job.deletion_event_id
        and content_purged_at is not null
    ) then
      raise exception 'Content purge must complete before operational scrub';
    end if;

    perform set_config('app.community_retention_redaction','on',true);

    update public.notification_events
    set actor_account_id=null
    where actor_account_id=v_job.account_id;

    update public.reports r
    set reporter_account_id=case
          when r.reporter_account_id=v_job.account_id then null
          else r.reporter_account_id
        end,
        detail=null
    where r.status in ('closed','rejected')
      and (
        r.reporter_account_id=v_job.account_id
        or private.community_entity_owned_by_account(r.target_entity_id,v_job.account_id)
      );

    update public.moderation_actions a
    set actor_account_id=case
          when a.actor_account_id=v_job.account_id then null
          else a.actor_account_id
        end,
        reason='[retained moderation action]',
        prior_state='{}'::jsonb,
        resulting_state='{}'::jsonb
    where exists (
      select 1
      from public.moderation_cases c
      where c.case_id=a.case_id
        and c.status in ('resolved','closed')
        and private.community_entity_owned_by_account(c.target_entity_id,v_job.account_id)
    )
       or a.actor_account_id=v_job.account_id;

    update public.audit_events
    set actor_account_id=case
          when actor_account_id=v_job.account_id then null
          else actor_account_id
        end,
        request_correlation_id=null,
        metadata='{}'::jsonb
    where actor_account_id=v_job.account_id
       or metadata->>'accountId'=v_job.account_id::text;

    delete from public.account_recovery_cases
    where account_id=v_job.account_id
      and state in ('completed','rejected','cancelled');

    delete from private.provider_cleanup_jobs
    where account_id=v_job.account_id
      and state='completed';

    perform set_config('app.community_retention_redaction','off',true);

    update public.account_deletion_events
    set operational_scrubbed_at=v_now,
        retention_state='purged'
    where deletion_event_id=v_job.deletion_event_id;

    insert into public.audit_events(
      actor_account_id,action_type,target_entity_id,metadata
    ) values (
      null,'retention.operational_scrubbed',null,
      jsonb_build_object(
        'deletionEventId',v_job.deletion_event_id
      )
    );
  else
    raise exception 'Unsupported retention stage';
  end if;

  update private.account_retention_jobs
  set state='completed',
      attempts=attempts+1,
      last_error=null,
      completed_at=v_now,
      locked_at=null,
      lock_token=null
  where retention_job_id=p_retention_job_id;

  return jsonb_build_object(
    'retentionJobId',p_retention_job_id,
    'stage',v_job.stage,
    'state','completed',
    'completedAt',v_now
  );
end;
$$;
