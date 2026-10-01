
create table if not exists private.community_retention_policy (
  policy_key text primary key,
  integer_value integer not null check (integer_value > 0),
  updated_at timestamptz not null default now()
);

insert into private.community_retention_policy(policy_key,integer_value)
values
  ('deleted_account_content_days',30),
  ('deleted_account_operational_days',365),
  ('retention_retry_base_seconds',300)
on conflict (policy_key) do nothing;

alter table public.account_deletion_events
  add column if not exists content_purge_after timestamptz null,
  add column if not exists content_purged_at timestamptz null,
  add column if not exists operational_scrub_after timestamptz null,
  add column if not exists operational_scrubbed_at timestamptz null;

alter table public.media_assets
  add column if not exists purged_at timestamptz null;

alter table public.artifact_blobs
  add column if not exists purged_at timestamptz null;

alter table public.reports
  alter column reporter_account_id drop not null;

alter table public.moderation_actions
  alter column actor_account_id drop not null;

create table if not exists private.account_retention_holds (
  hold_id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wand_accounts(account_id),
  hold_type text not null
    check (hold_type in ('moderation','security','legal')),
  reason text not null,
  created_by_account_id uuid not null references public.wand_accounts(account_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  released_at timestamptz null,
  released_by_account_id uuid null references public.wand_accounts(account_id)
);

create index if not exists account_retention_holds_active_idx
  on private.account_retention_holds(account_id,created_at)
  where released_at is null;

revoke all on private.account_retention_holds from public,anon,authenticated;

create table if not exists private.account_retention_jobs (
  retention_job_id uuid primary key default gen_random_uuid(),
  deletion_event_id uuid not null references public.account_deletion_events(deletion_event_id),
  account_id uuid not null references public.wand_accounts(account_id),
  stage text not null check (stage in ('content_payload','operational_detail')),
  state text not null default 'pending'
    check (state in ('pending','processing','completed','dead_letter')),
  due_at timestamptz not null,
  next_attempt_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text null,
  locked_at timestamptz null,
  lock_token uuid null,
  completed_at timestamptz null,
  dead_lettered_at timestamptz null,
  unique(account_id,stage)
);

create index if not exists account_retention_jobs_due_idx
  on private.account_retention_jobs(state,next_attempt_at,due_at)
  where state in ('pending','processing');

revoke all on private.account_retention_jobs from public,anon,authenticated;

create or replace function private.community_entity_owned_by_account(
  p_entity_id uuid,
  p_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select
    exists (
      select 1 from public.creator_profiles
      where creator_profile_id=p_entity_id and owner_account_id=p_account_id
    )
    or exists (
      select 1 from public.community_works
      where work_id=p_entity_id and owner_account_id=p_account_id
    )
    or exists (
      select 1 from public.comments
      where comment_id=p_entity_id and author_account_id=p_account_id
    )
    or exists (
      select 1 from public.media_assets
      where media_id=p_entity_id and owner_account_id=p_account_id
    )
    or exists (
      select 1 from public.preset_artifacts
      where preset_artifact_id=p_entity_id and owner_account_id=p_account_id
    );
$$;

create or replace function private.community_account_has_retention_hold(
  p_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select
    exists (
      select 1
      from private.account_retention_holds h
      where h.account_id=p_account_id
        and h.released_at is null
        and (h.expires_at is null or h.expires_at > now())
    )
    or exists (
      select 1
      from public.reports r
      where r.status in ('open','triaged')
        and (
          r.reporter_account_id=p_account_id
          or private.community_entity_owned_by_account(r.target_entity_id,p_account_id)
        )
    )
    or exists (
      select 1
      from public.moderation_cases c
      where c.status in ('open','reviewing')
        and private.community_entity_owned_by_account(c.target_entity_id,p_account_id)
    )
    or exists (
      select 1
      from private.provider_cleanup_jobs j
      where j.account_id=p_account_id
        and j.state <> 'completed'
    );
$$;

create or replace function private.community_schedule_account_retention()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_content_days integer;
  v_operational_days integer;
begin
  select integer_value into v_content_days
  from private.community_retention_policy
  where policy_key='deleted_account_content_days';

  select integer_value into v_operational_days
  from private.community_retention_policy
  where policy_key='deleted_account_operational_days';

  if v_content_days is null or v_operational_days is null then
    raise exception 'Community retention policy is incomplete';
  end if;

  new.content_purge_after := coalesce(
    new.content_purge_after,
    new.requested_at + make_interval(days=>v_content_days)
  );
  new.operational_scrub_after := coalesce(
    new.operational_scrub_after,
    new.requested_at + make_interval(days=>v_operational_days)
  );

  return new;
end;
$$;

drop trigger if exists account_deletion_retention_schedule_guard
  on public.account_deletion_events;
create trigger account_deletion_retention_schedule_guard
before insert on public.account_deletion_events
for each row execute function private.community_schedule_account_retention();

update public.account_deletion_events e
set
  content_purge_after=coalesce(
    e.content_purge_after,
    e.requested_at + make_interval(days=>
      (select integer_value from private.community_retention_policy
       where policy_key='deleted_account_content_days')
    )
  ),
  operational_scrub_after=coalesce(
    e.operational_scrub_after,
    e.requested_at + make_interval(days=>
      (select integer_value from private.community_retention_policy
       where policy_key='deleted_account_operational_days')
    )
  )
where e.content_purge_after is null
   or e.operational_scrub_after is null;

insert into private.account_retention_jobs(
  deletion_event_id,account_id,stage,due_at,next_attempt_at
)
select
  e.deletion_event_id,e.account_id,'content_payload',
  e.content_purge_after,e.content_purge_after
from public.account_deletion_events e
where e.content_purged_at is null
on conflict (account_id,stage) do nothing;

insert into private.account_retention_jobs(
  deletion_event_id,account_id,stage,due_at,next_attempt_at
)
select
  e.deletion_event_id,e.account_id,'operational_detail',
  e.operational_scrub_after,e.operational_scrub_after
from public.account_deletion_events e
where e.operational_scrubbed_at is null
on conflict (account_id,stage) do nothing;

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

  return new;
end;
$$;

drop trigger if exists account_deletion_retention_jobs
  on public.account_deletion_events;
create trigger account_deletion_retention_jobs
after insert on public.account_deletion_events
for each row execute function private.community_enqueue_retention_jobs();

create or replace function private.community_tombstone_owned_nonwork_entities()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if new.status='deleted' and new.deleted_at is not null
     and (old.status is distinct from new.status or old.deleted_at is distinct from new.deleted_at) then
    update public.community_entities e
    set deleted_at=coalesce(e.deleted_at,new.deleted_at)
    where e.entity_id in (
      select media_id from public.media_assets where owner_account_id=new.account_id
      union
      select preset_artifact_id from public.preset_artifacts where owner_account_id=new.account_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists wand_account_extra_entity_tombstones
  on public.wand_accounts;
create trigger wand_account_extra_entity_tombstones
after update of status,deleted_at on public.wand_accounts
for each row execute function private.community_tombstone_owned_nonwork_entities();

update public.community_entities e
set deleted_at=coalesce(e.deleted_at,wa.deleted_at)
from public.wand_accounts wa
where wa.status='deleted'
  and wa.deleted_at is not null
  and e.entity_id in (
    select media_id from public.media_assets where owner_account_id=wa.account_id
    union
    select preset_artifact_id from public.preset_artifacts where owner_account_id=wa.account_id
  );

create or replace function public.guard_unpurged_media_link()
returns trigger
language plpgsql
set search_path=pg_catalog,public
as $$
begin
  if exists (
    select 1
    from public.media_assets m
    where m.media_id=new.media_id
      and m.purged_at is not null
  ) then
    raise exception 'Purged media cannot be linked to a revision';
  end if;
  return new;
end;
$$;

drop trigger if exists work_revision_media_purge_guard
  on public.work_revision_media;
create trigger work_revision_media_purge_guard
before insert or update of media_id on public.work_revision_media
for each row execute function public.guard_unpurged_media_link();

create or replace function public.community_get_media_storage_key(
  p_auth_subject uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_media public.media_assets%rowtype;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);

  if not private.can_access_entity(p_media_id,v_account_id) then
    raise exception 'Media is not accessible';
  end if;

  select * into v_media
  from public.media_assets
  where media_id=p_media_id
    and processing_state='ready'
    and moderation_state='clear'
    and purged_at is null;

  if v_media.media_id is null then
    raise exception 'Media is not READY';
  end if;

  return jsonb_build_object(
    'mediaId',v_media.media_id,
    'storageKey',v_media.storage_key,
    'mimeType',v_media.mime_type,
    'byteSize',v_media.byte_size,
    'width',v_media.width,
    'height',v_media.height,
    'checksumSha256',v_media.checksum_sha256
  );
end;
$$;

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
      or
      (j.state='processing' and j.locked_at < now()-interval '10 minutes')
    )
      and not private.community_account_has_retention_hold(j.account_id)
      and (
        j.stage='content_payload'
        or exists (
          select 1
          from public.account_deletion_events e
          where e.deletion_event_id=j.deletion_event_id
            and e.content_purged_at is not null
        )
      )
    order by j.due_at,j.retention_job_id
    for update skip locked
    limit v_limit
  ),
  claimed as (
    update private.account_retention_jobs j
    set state='processing',
        locked_at=now(),
        lock_token=p_lock_token
    where j.retention_job_id in (select retention_job_id from candidates)
    returning
      j.retention_job_id,
      j.deletion_event_id,
      j.account_id,
      j.stage,
      j.attempts
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
            where m.owner_account_id=c.account_id
              and m.purged_at is null
          ) else '[]'::jsonb end,
        'artifactBlobCount',
          case when c.stage='content_payload' then (
            select count(*)
            from public.artifact_blobs b
            where b.owner_account_id=c.account_id
              and b.purged_at is null
          ) else 0 end
      )
      order by c.retention_job_id
    ),
    '[]'::jsonb
  )
  into v_jobs
  from claimed c;

  return jsonb_build_object(
    'lockToken',p_lock_token,
    'jobs',v_jobs
  );
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
      select 1
      from public.artifact_blobs b
      where b.owner_account_id=v_job.account_id
        and b.purged_at is null
    ) then
      raise exception 'Preset artifact storage purge adapter is not available';
    end if;

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

create or replace function public.community_fail_account_retention_job(
  p_retention_job_id uuid,
  p_lock_token uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_job private.account_retention_jobs%rowtype;
  v_base_seconds integer;
begin
  select integer_value into v_base_seconds
  from private.community_retention_policy
  where policy_key='retention_retry_base_seconds';

  if v_base_seconds is null then v_base_seconds := 300; end if;

  update private.account_retention_jobs
  set attempts=attempts+1,
      last_error=left(coalesce(p_error,'retention job failed'),2000),
      state=case when attempts+1 >= 5 then 'dead_letter' else 'pending' end,
      next_attempt_at=case
        when attempts+1 >= 5 then next_attempt_at
        else now()+make_interval(
          secs=>least(86400,(v_base_seconds*power(2,least(attempts,7)))::integer)
        )
      end,
      dead_lettered_at=case when attempts+1 >= 5 then now() else null end,
      locked_at=null,
      lock_token=null
  where retention_job_id=p_retention_job_id
    and state='processing'
    and lock_token=p_lock_token
  returning * into v_job;

  if v_job.retention_job_id is null then
    raise exception 'Claimed retention job not found';
  end if;

  return jsonb_build_object(
    'retentionJobId',v_job.retention_job_id,
    'stage',v_job.stage,
    'state',v_job.state,
    'attempts',v_job.attempts,
    'nextAttemptAt',v_job.next_attempt_at,
    'deadLetteredAt',v_job.dead_lettered_at
  );
end;
$$;

create or replace function public.community_admin_add_retention_hold(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_account_id uuid,
  p_hold_type text,
  p_reason text,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_hold_id uuid;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,p_session_id,p_issued_at_epoch
  );

  if p_hold_type not in ('moderation','security','legal') then
    raise exception 'Unsupported retention hold type';
  end if;

  if coalesce(length(btrim(p_reason)),0)<8
     or length(btrim(p_reason))>500 then
    raise exception 'Retention hold reason must be 8-500 characters';
  end if;

  if not exists (
    select 1 from public.wand_accounts where account_id=p_account_id
  ) then
    raise exception 'WandAccount not found';
  end if;

  insert into private.account_retention_holds(
    account_id,hold_type,reason,created_by_account_id,expires_at
  ) values (
    p_account_id,p_hold_type,btrim(p_reason),v_admin_account_id,p_expires_at
  )
  returning hold_id into v_hold_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,'retention.hold_added',null,
    jsonb_build_object(
      'holdId',v_hold_id,
      'accountId',p_account_id,
      'holdType',p_hold_type,
      'expiresAt',p_expires_at
    )
  );

  return jsonb_build_object(
    'holdId',v_hold_id,
    'accountId',p_account_id,
    'holdType',p_hold_type,
    'expiresAt',p_expires_at
  );
end;
$$;

create or replace function public.community_admin_release_retention_hold(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_hold_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_hold private.account_retention_holds%rowtype;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,p_session_id,p_issued_at_epoch
  );

  if coalesce(length(btrim(p_reason)),0)<8
     or length(btrim(p_reason))>500 then
    raise exception 'Retention hold release reason must be 8-500 characters';
  end if;

  update private.account_retention_holds
  set released_at=now(),
      released_by_account_id=v_admin_account_id
  where hold_id=p_hold_id
    and released_at is null
  returning * into v_hold;

  if v_hold.hold_id is null then
    raise exception 'Active retention hold not found';
  end if;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,'retention.hold_released',null,
    jsonb_build_object(
      'holdId',v_hold.hold_id,
      'accountId',v_hold.account_id,
      'reason',btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'holdId',v_hold.hold_id,
    'accountId',v_hold.account_id,
    'releasedAt',v_hold.released_at
  );
end;
$$;

revoke execute on function private.community_entity_owned_by_account(uuid,uuid)
from public,anon,authenticated;
revoke execute on function private.community_account_has_retention_hold(uuid)
from public,anon,authenticated;
revoke execute on function private.community_schedule_account_retention()
from public,anon,authenticated,service_role;
revoke execute on function private.community_enqueue_retention_jobs()
from public,anon,authenticated,service_role;
revoke execute on function private.community_tombstone_owned_nonwork_entities()
from public,anon,authenticated,service_role;

revoke execute on function public.guard_unpurged_media_link()
from public,anon,authenticated;

revoke execute on function public.community_claim_account_retention_jobs(integer,uuid)
from public,anon,authenticated;
revoke execute on function public.community_complete_account_retention_job(uuid,uuid)
from public,anon,authenticated;
revoke execute on function public.community_fail_account_retention_job(uuid,uuid,text)
from public,anon,authenticated;
revoke execute on function public.community_admin_add_retention_hold(
  uuid,uuid,bigint,uuid,text,text,timestamptz
) from public,anon,authenticated;
revoke execute on function public.community_admin_release_retention_hold(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;

grant execute on function public.community_claim_account_retention_jobs(integer,uuid)
to service_role;
grant execute on function public.community_complete_account_retention_job(uuid,uuid)
to service_role;
grant execute on function public.community_fail_account_retention_job(uuid,uuid,text)
to service_role;
grant execute on function public.community_admin_add_retention_hold(
  uuid,uuid,bigint,uuid,text,text,timestamptz
) to service_role;
grant execute on function public.community_admin_release_retention_hold(
  uuid,uuid,bigint,uuid,text
) to service_role;
