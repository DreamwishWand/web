-- 09 INT R7 isolated-only candidate.
-- This file must NEVER be migrated to Staging/Production without 03 COMM review.
-- Function community_unpublish_work below is the ACTUAL live Staging
-- pg_get_functiondef text with exactly one PERFORM insertion before its first Work lock.
-- Fixture-only account resolver and mock tables live in the regression script.
-- This candidate covers linked PresetWork generic UNPUBLISH ONLY; no positive Gallery retirement.
create or replace function private.cross_product_lock_linked_preset_work_r7(p_work_id uuid)
returns void
language plpgsql
set search_path=pg_catalog,public,private
as $r7$
declare
  v_id uuid;
  v_gallery uuid;
  v_gallery_after uuid;
  v_artifacts uuid[];
  v_preset_work uuid;
begin
  -- Provisional discovery; identities must be rechecked after row locks.
  select coalesce(array_agg(preset_artifact_id order by preset_artifact_id),array[]::uuid[])
    into v_artifacts
  from public.preset_artifacts where community_work_id=p_work_id;
  if cardinality(v_artifacts)=0 then
    return; -- non-Preset Work or unknown binding: no claimed Gallery retirement proof
  end if;
  foreach v_id in array v_artifacts loop
    select community_work_id,associated_gallery_work_id
      into v_preset_work,v_gallery
    from public.preset_artifacts where preset_artifact_id=v_id for update;
    if v_preset_work is distinct from p_work_id then
      raise exception 'R7_LINKED_ARTIFACT_CHANGED';
    end if;
  end loop;
  -- In the current candidate, only one corresponding Artifact is supported.
  if cardinality(v_artifacts)<>1 then
    raise exception 'R7_MULTIPLE_ARTIFACTS_UNSUPPORTED';
  end if;
  -- PresetWork is locked after Artifact, before Gallery.
  perform 1 from public.community_works
    where work_id=p_work_id and work_type='preset' for update;
  if not found then raise exception 'R7_LINKED_PRESET_WORK_MISSING';end if;
  if v_gallery is not null then
    perform 1 from public.community_works
      where work_id=v_gallery and work_type='gallery' for update;
    if not found then raise exception 'R7_LINKED_GALLERY_WORK_MISSING';end if;
  end if;
  -- Under-lock relation revalidation rejects a changed provisional identity.
  select associated_gallery_work_id into v_gallery_after
    from public.preset_artifacts where preset_artifact_id=v_id;
  if v_gallery_after is distinct from v_gallery then
    raise exception 'R7_LINKED_GALLERY_ID_CHANGED';
  end if;
  -- This narrow helper does not assert graphComplete or retirementAuthorized.
end
$r7$;
revoke all on function private.cross_product_lock_linked_preset_work_r7(uuid)
  from public,anon,authenticated,service_role;

-- Minimal candidate: exact deployed generic RPC with a single pre-row-lock call.

CREATE OR REPLACE FUNCTION public.community_unpublish_work(p_auth_subject uuid, p_work_id uuid, p_expected_version bigint, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'extensions', 'public', 'private'
AS $function$
declare
  v_account_id uuid;
  v_work public.community_works%rowtype;
  v_response jsonb;
  v_request_hash text;
  v_existing_hash text;
begin
  v_account_id := private.resolve_active_account(p_auth_subject);
  perform pg_advisory_xact_lock(hashtextextended(v_account_id::text || ':' || p_idempotency_key,0));
  v_request_hash := encode(digest(
    concat_ws('|','unpublish_work',p_work_id::text,p_expected_version::text),
    'sha256'
  ),'hex');

  select request_hash,response into v_existing_hash,v_response
  from public.idempotency_keys
  where account_id=v_account_id and idempotency_key=p_idempotency_key;

  if v_existing_hash is not null then
    if v_existing_hash <> v_request_hash then raise exception 'Idempotency key reused with a different request'; end if;
    return v_response;
  end if;

  perform private.cross_product_lock_linked_preset_work_r7(p_work_id);

  select * into v_work
  from public.community_works
  where work_id=p_work_id
  for update;

  if v_work.work_id is null then raise exception 'Work not found'; end if;
  if v_work.owner_account_id<>v_account_id then raise exception 'Actor does not own work'; end if;
  if v_work.row_version<>p_expected_version then raise exception 'Row version conflict'; end if;
  if v_work.lifecycle_state<>'published' then raise exception 'Only published work can be unpublished'; end if;

  insert into public.idempotency_keys(account_id,idempotency_key,command_name,request_hash)
  values (v_account_id,p_idempotency_key,'unpublish_work',v_request_hash);

  update public.community_works
  set lifecycle_state='unpublished'
  where work_id=p_work_id
  returning * into v_work;

  delete from public.search_documents where entity_id=p_work_id;

  insert into public.outbox_events(aggregate_type,aggregate_id,event_type,payload,dedupe_key)
  values (
    'community_work',p_work_id,'work.unpublished',
    jsonb_build_object('workId',p_work_id),
    'work.unpublished:' || p_work_id::text || ':' || v_work.row_version::text
  );

  v_response := jsonb_build_object(
    'workId',p_work_id,'lifecycleState',v_work.lifecycle_state,'rowVersion',v_work.row_version
  );
  update public.idempotency_keys set response=v_response,completed_at=now()
  where account_id=v_account_id and idempotency_key=p_idempotency_key;
  return v_response;
end;
$function$

