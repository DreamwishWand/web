
create or replace function public.community_authorize_session(
  p_auth_subject uuid,
  p_issued_at_epoch bigint,
  p_max_age_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_identity_id uuid;
  v_cutoff timestamptz;
  v_issued_at timestamptz;
  v_token_age_seconds bigint;
begin
  if p_issued_at_epoch is null or p_issued_at_epoch <= 0 then
    raise exception 'JWT issued-at claim is required';
  end if;

  if p_max_age_seconds is not null then
    raise exception 'Session-bound recent authentication required';
  end if;

  v_account_id := private.resolve_active_account(p_auth_subject);
  v_issued_at := to_timestamp(p_issued_at_epoch);

  select auth_identity_id,sessions_valid_after
    into v_identity_id,v_cutoff
  from public.auth_identities
  where provider='supabase'
    and provider_subject=p_auth_subject::text
    and account_id=v_account_id
    and identity_state='active'
  limit 1;

  if v_identity_id is null then
    raise exception 'Active AuthIdentity not found';
  end if;

  if v_issued_at < v_cutoff then
    raise exception 'Wand session has been revoked';
  end if;

  v_token_age_seconds := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - v_issued_at)))::bigint
  );

  return jsonb_build_object(
    'accountId',v_account_id,
    'authIdentityId',v_identity_id,
    'issuedAt',v_issued_at,
    'tokenAgeSeconds',v_token_age_seconds,
    'sessionsValidAfter',v_cutoff
  );
end;
$$;

create or replace function private.require_recent_session(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_max_age_seconds integer
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_auth jsonb;
  v_account_id uuid;
  v_created_at timestamptz;
  v_not_after timestamptz;
  v_session_age_seconds bigint;
begin
  if p_session_id is null then
    raise exception 'Session ID is required for recent authentication';
  end if;

  if p_max_age_seconds is null or p_max_age_seconds <= 0 then
    raise exception 'Recent-auth max age must be positive';
  end if;

  v_auth := public.community_authorize_session(
    p_auth_subject,
    p_issued_at_epoch,
    null
  );
  v_account_id := (v_auth->>'accountId')::uuid;

  select s.created_at,s.not_after
    into v_created_at,v_not_after
  from auth.sessions s
  where s.id=p_session_id
    and s.user_id=p_auth_subject
  limit 1;

  if v_created_at is null then
    raise exception 'Authenticated session not found';
  end if;

  if v_not_after is not null and v_not_after <= clock_timestamp() then
    raise exception 'Authenticated session has expired';
  end if;

  v_session_age_seconds := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - v_created_at)))::bigint
  );

  if v_session_age_seconds > p_max_age_seconds then
    raise exception 'Recent authentication required';
  end if;

  return v_account_id;
end;
$$;

drop function if exists private.require_recent_admin(uuid,bigint);

create or replace function private.require_recent_admin(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_window integer;
  v_account_id uuid;
begin
  select integer_value into v_window
  from private.community_security_config
  where policy_key='support_admin_recent_auth_seconds';

  if v_window is null then
    raise exception 'Support admin recent-auth policy is not configured';
  end if;

  v_account_id := private.require_recent_session(
    p_auth_subject,
    p_session_id,
    p_issued_at_epoch,
    v_window
  );

  if not exists (
    select 1 from public.account_roles
    where account_id=v_account_id
      and role='admin'
  ) then
    raise exception 'Admin role required';
  end if;

  return v_account_id;
end;
$$;

drop function if exists public.community_admin_open_recovery_case(
  uuid,bigint,uuid,text,text,text,text
);
drop function if exists public.community_admin_complete_recovery(
  uuid,bigint,uuid,text
);
drop function if exists public.community_admin_retry_provider_cleanup(
  uuid,bigint,uuid,text
);

create or replace function public.community_admin_open_recovery_case(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_account_id uuid,
  p_new_provider text,
  p_new_provider_subject text,
  p_reason text,
  p_verification_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  perform private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  return public.community_open_recovery_case(
    p_admin_auth_subject,
    p_account_id,
    p_new_provider,
    p_new_provider_subject,
    p_reason,
    p_verification_ref
  );
end;
$$;

create or replace function public.community_admin_complete_recovery(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_recovery_case_id uuid,
  p_completion_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  perform private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  return public.community_complete_recovery(
    p_admin_auth_subject,
    p_recovery_case_id,
    p_completion_reason
  );
end;
$$;

create or replace function public.community_admin_retry_provider_cleanup(
  p_admin_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_cleanup_job_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_admin_account_id uuid;
  v_job private.provider_cleanup_jobs%rowtype;
begin
  v_admin_account_id := private.require_recent_admin(
    p_admin_auth_subject,
    p_session_id,
    p_issued_at_epoch
  );

  if coalesce(length(btrim(p_reason)),0) < 8
     or length(btrim(p_reason)) > 500 then
    raise exception 'Retry reason must be 8-500 characters';
  end if;

  select * into v_job
  from private.provider_cleanup_jobs
  where cleanup_job_id=p_cleanup_job_id
  for update;

  if v_job.cleanup_job_id is null then
    raise exception 'Provider cleanup job not found';
  end if;

  if v_job.state <> 'dead_letter' then
    raise exception 'Provider cleanup job is not dead-lettered';
  end if;

  update private.provider_cleanup_jobs
  set state='pending',
      attempts=0,
      last_error=null,
      next_attempt_at=now(),
      locked_at=null,
      lock_token=null,
      dead_lettered_at=null
  where cleanup_job_id=p_cleanup_job_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_admin_account_id,
    'provider_cleanup.dead_letter_requeued',
    null,
    jsonb_build_object(
      'cleanupJobId',v_job.cleanup_job_id,
      'accountId',v_job.account_id,
      'provider',v_job.provider,
      'priorAttempts',v_job.attempts,
      'priorLastError',v_job.last_error,
      'reason',btrim(p_reason)
    )
  );

  return jsonb_build_object(
    'cleanupJobId',v_job.cleanup_job_id,
    'state','pending',
    'attempts',0,
    'nextAttemptAt',now()
  );
end;
$$;

drop function if exists public.community_tombstone_account(uuid,bigint,text);

create or replace function public.community_tombstone_account(
  p_auth_subject uuid,
  p_session_id uuid,
  p_issued_at_epoch bigint,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_account_id uuid;
  v_creator_id uuid;
  v_delete_window integer;
  v_event_id uuid;
  v_cleanup_job_id uuid;
  v_deleted_at timestamptz := clock_timestamp();
  v_work_count integer := 0;
  v_comment_count integer := 0;
  v_save_count integer := 0;
  v_follow_count integer := 0;
  v_reaction_count integer := 0;
  v_notification_count integer := 0;
begin
  if p_confirmation <> 'DELETE' then
    raise exception 'Explicit account deletion confirmation is required';
  end if;

  select integer_value into v_delete_window
  from private.community_security_config
  where policy_key='account_delete_recent_auth_seconds';

  if v_delete_window is null then
    raise exception 'Account deletion recent-auth policy is not configured';
  end if;

  v_account_id := private.require_recent_session(
    p_auth_subject,
    p_session_id,
    p_issued_at_epoch,
    v_delete_window
  );

  perform pg_advisory_xact_lock(
    hashtextextended('account-delete:' || v_account_id::text,0)
  );

  if not exists (
    select 1 from public.wand_accounts
    where account_id=v_account_id
      and status<>'deleted'
      and deleted_at is null
    for update
  ) then
    raise exception 'WandAccount is already deleted';
  end if;

  select creator_profile_id into v_creator_id
  from public.creator_profiles
  where owner_account_id=v_account_id
  for update;

  insert into public.account_deletion_events(account_id)
  values(v_account_id)
  returning deletion_event_id into v_event_id;

  insert into private.provider_cleanup_jobs(account_id,provider,provider_subject)
  values(v_account_id,'supabase',p_auth_subject::text)
  returning cleanup_job_id into v_cleanup_job_id;

  if v_creator_id is not null then
    update public.creator_profiles
    set handle='deleted-' || replace(left(v_creator_id::text,12),'-',''),
        display_name='Deleted Creator',
        avatar_media_id=null,
        bio=null,
        profile_visibility='private'
    where creator_profile_id=v_creator_id;

    update public.community_entities
    set deleted_at=coalesce(deleted_at,v_deleted_at)
    where entity_id=v_creator_id;
  end if;

  update public.community_works
  set lifecycle_state='deleted',visibility='private'
  where owner_account_id=v_account_id
    and lifecycle_state<>'deleted';
  get diagnostics v_work_count=row_count;

  update public.community_entities e
  set deleted_at=coalesce(e.deleted_at,v_deleted_at)
  where exists (
    select 1 from public.community_works w
    where w.work_id=e.entity_id
      and w.owner_account_id=v_account_id
  );

  delete from public.search_documents
  where work_id in (
    select work_id from public.community_works
    where owner_account_id=v_account_id
  );

  update public.comments
  set body='[deleted]',lifecycle_state='deleted'
  where author_account_id=v_account_id
    and lifecycle_state<>'deleted';
  get diagnostics v_comment_count=row_count;

  update public.community_entities e
  set deleted_at=coalesce(e.deleted_at,v_deleted_at)
  where exists (
    select 1 from public.comments c
    where c.comment_id=e.entity_id
      and c.author_account_id=v_account_id
  );

  delete from public.saved_items where account_id=v_account_id;
  get diagnostics v_save_count=row_count;
  delete from public.follows where follower_account_id=v_account_id;
  get diagnostics v_follow_count=row_count;
  delete from public.reactions where account_id=v_account_id;
  get diagnostics v_reaction_count=row_count;
  delete from public.notification_deliveries where recipient_account_id=v_account_id;
  get diagnostics v_notification_count=row_count;
  delete from public.wand_account_ddv_profiles where account_id=v_account_id;

  update public.account_recovery_cases
  set state=case when state='open' then 'cancelled' else state end,
      requested_provider_subject='deleted:' || recovery_case_id::text,
      verification_ref=null,
      updated_at=now()
  where account_id=v_account_id;

  update public.auth_identities
  set identity_state='retired',
      retired_at=coalesce(retired_at,v_deleted_at),
      sessions_valid_after=v_deleted_at,
      provider_subject='deleted:' || auth_identity_id::text
  where account_id=v_account_id;

  update public.wand_accounts
  set status='deleted',
      deleted_at=v_deleted_at,
      updated_at=v_deleted_at
  where account_id=v_account_id;

  update public.account_deletion_events
  set completed_at=v_deleted_at,
      public_profile_anonymized=true,
      public_content_hidden=true,
      private_interactions_removed=true,
      auth_identities_retired=true
  where deletion_event_id=v_event_id;

  insert into public.audit_events(
    actor_account_id,action_type,target_entity_id,metadata
  ) values (
    v_account_id,
    'account.tombstoned',
    null,
    jsonb_build_object(
      'deletionEventId',v_event_id,
      'providerCleanupJobId',v_cleanup_job_id,
      'workCount',v_work_count,
      'commentCount',v_comment_count,
      'savedItemCount',v_save_count,
      'followCount',v_follow_count,
      'reactionCount',v_reaction_count,
      'notificationDeliveryCount',v_notification_count,
      'retentionState','restricted_retention'
    )
  );

  return jsonb_build_object(
    'deletionEventId',v_event_id,
    'providerCleanupJobId',v_cleanup_job_id,
    'accountId',v_account_id,
    'status','deleted',
    'deletedAt',v_deleted_at,
    'retentionState','restricted_retention',
    'workCount',v_work_count,
    'commentCount',v_comment_count
  );
end;
$$;

revoke execute on function private.require_recent_session(uuid,uuid,bigint,integer)
from public,anon,authenticated;
revoke execute on function private.require_recent_admin(uuid,uuid,bigint)
from public,anon,authenticated;

revoke execute on function public.community_admin_open_recovery_case(
  uuid,uuid,bigint,uuid,text,text,text,text
) from public,anon,authenticated;
revoke execute on function public.community_admin_complete_recovery(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;
revoke execute on function public.community_admin_retry_provider_cleanup(
  uuid,uuid,bigint,uuid,text
) from public,anon,authenticated;
revoke execute on function public.community_tombstone_account(
  uuid,uuid,bigint,text
) from public,anon,authenticated;

grant execute on function private.require_recent_session(uuid,uuid,bigint,integer)
to service_role;
grant execute on function private.require_recent_admin(uuid,uuid,bigint)
to service_role;

grant execute on function public.community_admin_open_recovery_case(
  uuid,uuid,bigint,uuid,text,text,text,text
) to service_role;
grant execute on function public.community_admin_complete_recovery(
  uuid,uuid,bigint,uuid,text
) to service_role;
grant execute on function public.community_admin_retry_provider_cleanup(
  uuid,uuid,bigint,uuid,text
) to service_role;
grant execute on function public.community_tombstone_account(
  uuid,uuid,bigint,text
) to service_role;
