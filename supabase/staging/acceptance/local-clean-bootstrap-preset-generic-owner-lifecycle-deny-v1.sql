-- 03 COMM / #119 R5 generic owner Preset transition fail-closed.
-- Run ONLY in disposable local Supabase, using synthetic actors; rolls back.
-- No real actor JWT, Storage bytes, account erasure or cross-process locks.
begin;
do $test$
declare
  v_owner_subject uuid;
  v_other_subject uuid;
  v_creator uuid;
  v_id uuid;
  v_work uuid;
  v_row_version bigint;
  v_tag text:=gen_random_uuid()::text;
  v_key text;
  v_error text;
  v_before record;
  v_after record;
  v_denied boolean;
  v_action text;
  v_prior_count integer;
begin
  select ai.provider_subject::uuid,c.creator_profile_id
    into v_owner_subject,v_creator
  from public.creator_profiles c
  join public.auth_identities ai on ai.account_id=c.owner_account_id
  where c.handle='isolated_bootstrap_creator' and ai.provider='supabase'
  limit 1;
  select ai.provider_subject::uuid into v_other_subject
  from public.auth_identities ai
  where ai.provider='supabase' and ai.provider_subject<>v_owner_subject::text
  limit 1;
  if v_owner_subject is null or v_other_subject is null then
    raise exception 'LOCAL_PRESET_OWNER_ACTORS_MISSING';
  end if;
  v_id:=public.community_publish_preset_envelope(
    v_owner_subject,v_creator,'public','scene','CI Generic Owner Deny',null,
    'ci-only/owner-transition-'||v_tag||'.json',1,
    'application/json',321,repeat('a',64),'{}'::jsonb,
    'lifecycle-fixture:'||v_tag
  ) ->> 'presetArtifactId';
  select w.work_id,w.row_version,w.lifecycle_state,w.visibility,w.moderation_state,
         w.current_published_revision_id into v_before
  from public.community_works w
  join public.preset_artifacts p on p.community_work_id=w.work_id
  where p.preset_artifact_id=v_id;
  v_work:=v_before.work_id;
  v_row_version:=v_before.row_version;
  if v_work is null then raise exception 'LOCAL_PRESET_WORK_MISSING';end if;

  foreach v_action in array array['unpublish','delete','visibility'] loop
    v_key:='negative:'||v_tag||':'||v_action;
    v_denied:=false;
    begin
      if v_action='unpublish' then
        perform public.community_unpublish_work(
          v_owner_subject,v_work,v_row_version,v_key);
      elsif v_action='delete' then
        perform public.community_delete_work(
          v_owner_subject,v_work,v_row_version,v_key);
      else
        perform public.community_change_work_visibility(
          v_owner_subject,v_work,v_row_version,'private',v_key);
      end if;
    exception when others then
      get stacked diagnostics v_error=message_text;
      if v_error='PRESET_OWNER_LIFECYCLE_GLOBAL_WRITER_CONTRACT_REQUIRED'
      then v_denied:=true;
      else raise exception 'UNEXPECTED_PRESET_GENERIC_ACTION_ERROR: % (%)',
        v_action,v_error; end if;
    end;
    if not v_denied then
      raise exception 'GENERIC_PRESET_TRANSITION_NOT_BLOCKED: %',v_action;
    end if;

    select w.work_id,w.row_version,w.lifecycle_state,w.visibility,
           w.moderation_state,w.current_published_revision_id into v_after
    from public.community_works w where w.work_id=v_work;
    if (v_before.row_version,v_before.lifecycle_state,v_before.visibility,
        v_before.moderation_state,v_before.current_published_revision_id)
       is distinct from
       (v_after.row_version,v_after.lifecycle_state,v_after.visibility,
        v_after.moderation_state,v_after.current_published_revision_id)
    then raise exception 'PRESET_STATE_CHANGED_AFTER_DENIED_ACTION: %',v_action;end if;
    if exists (
      select 1 from public.idempotency_keys i
      join public.wand_accounts a on a.account_id=i.account_id
      join public.auth_identities ai on ai.account_id=a.account_id
      where ai.provider_subject=v_owner_subject::text and i.idempotency_key=v_key
    ) then raise exception 'REJECTED_PRESET_IDEMPOTENCY_KEY_COMMITTED: %',v_action;end if;
  end loop;

  -- Nonowner rejection still precedes the new type-specific guard.
  v_denied:=false;
  begin
    perform public.community_unpublish_work(
      v_other_subject,v_work,v_row_version,'other:'||v_tag);
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='Actor does not own work' then v_denied:=true;
    else raise exception 'UNEXPECTED_NONOWNER_DENIAL: %',v_error;end if;
  end;
  if not v_denied then raise exception 'NONOWNER_PRESET_LIFECYCLE_NOT_REJECTED';end if;

  -- Changes to Moderation and Account Erasure are NOT implemented by these
  -- three owner RPCs. Their separate DB update paths must remain possible;
  -- this is NOT full moderation/erasure RPC acceptance.
  update public.community_works set moderation_state='restricted'
  where work_id=v_work;
  update public.community_works
    set lifecycle_state='deleted',visibility='private'
  where work_id=v_work;
  if not exists(
    select 1 from public.community_works
    where work_id=v_work and lifecycle_state='deleted'
      and visibility='private' and moderation_state='restricted'
  ) then raise exception 'SAFETY_PRIVACY_DIRECT_UPDATE_PATH_BLOCKED';end if;
  raise notice 'LOCAL_GENERIC_PRESET_OWNER_TRANSITION_FAILCLOSED_ROLLBACK_PASS';
end
$test$;
rollback;
