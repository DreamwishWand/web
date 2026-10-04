-- Fix account tombstone for generated creator_profiles.handle_normalized.
-- The canonical tombstone RPC remains defined by the preceding migration; this replacement
-- removes direct writes to the generated normalized-handle column.

create or replace function public.community_tombstone_account(
  p_auth_subject uuid,
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
  v_deleted_at timestamptz := clock_timestamp();
  v_work_count integer := 0;
  v_comment_count integer := 0;
  v_save_count integer := 0;
  v_follow_count integer := 0;
  v_reaction_count integer := 0;
  v_notification_count integer := 0;
begin
  if p_confirmation <> 'DELETE' then raise exception 'Explicit account deletion confirmation is required'; end if;
  select integer_value into v_delete_window from private.community_security_config
  where policy_key='account_delete_recent_auth_seconds';
  if v_delete_window is null then raise exception 'Account deletion recent-auth policy is not configured'; end if;

  perform public.community_authorize_session(p_auth_subject,p_issued_at_epoch,v_delete_window);
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended('account-delete:' || v_account_id::text,0));

  if not exists (
    select 1 from public.wand_accounts
    where account_id=v_account_id and status<>'deleted' and deleted_at is null
    for update
  ) then raise exception 'WandAccount is already deleted'; end if;

  select creator_profile_id into v_creator_id from public.creator_profiles
  where owner_account_id=v_account_id for update;

  insert into public.account_deletion_events(account_id)
  values(v_account_id) returning deletion_event_id into v_event_id;

  if v_creator_id is not null then
    update public.creator_profiles
    set handle='deleted-' || replace(left(v_creator_id::text,12),'-',''),
        display_name='Deleted Creator',
        avatar_media_id=null,bio=null,profile_visibility='private'
    where creator_profile_id=v_creator_id;

    update public.community_entities set deleted_at=coalesce(deleted_at,v_deleted_at)
    where entity_id=v_creator_id;
  end if;

  update public.community_works set lifecycle_state='deleted',visibility='private'
  where owner_account_id=v_account_id and lifecycle_state<>'deleted';
  get diagnostics v_work_count=row_count;

  update public.community_entities e set deleted_at=coalesce(e.deleted_at,v_deleted_at)
  where exists (
    select 1 from public.community_works w
    where w.work_id=e.entity_id and w.owner_account_id=v_account_id
  );

  delete from public.search_documents
  where work_id in (select work_id from public.community_works where owner_account_id=v_account_id);

  update public.comments set body='[deleted]',lifecycle_state='deleted'
  where author_account_id=v_account_id and lifecycle_state<>'deleted';
  get diagnostics v_comment_count=row_count;

  update public.community_entities e set deleted_at=coalesce(e.deleted_at,v_deleted_at)
  where exists (
    select 1 from public.comments c
    where c.comment_id=e.entity_id and c.author_account_id=v_account_id
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
      verification_ref=null,updated_at=now()
  where account_id=v_account_id;

  update public.auth_identities
  set identity_state='retired',
      retired_at=coalesce(retired_at,v_deleted_at),
      sessions_valid_after=v_deleted_at,
      provider_subject='deleted:' || auth_identity_id::text
  where account_id=v_account_id;

  update public.wand_accounts set status='deleted',deleted_at=v_deleted_at,updated_at=v_deleted_at
  where account_id=v_account_id;

  update public.account_deletion_events
  set completed_at=v_deleted_at,
      public_profile_anonymized=true,
      public_content_hidden=true,
      private_interactions_removed=true,
      auth_identities_retired=true
  where deletion_event_id=v_event_id;

  insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
  values(
    v_account_id,'account.tombstoned',null,
    jsonb_build_object(
      'deletionEventId',v_event_id,'workCount',v_work_count,'commentCount',v_comment_count,
      'savedItemCount',v_save_count,'followCount',v_follow_count,
      'reactionCount',v_reaction_count,'notificationDeliveryCount',v_notification_count,
      'retentionState','restricted_retention'
    )
  );

  return jsonb_build_object(
    'deletionEventId',v_event_id,'accountId',v_account_id,'status','deleted',
    'deletedAt',v_deleted_at,'retentionState','restricted_retention',
    'workCount',v_work_count,'commentCount',v_comment_count
  );
end;
$$;
