-- 03 COMM / WEP Scene Save-Revision owner readiness (READ-ONLY).
-- Disposable local Supabase only. Synthetic identities/artifacts; ROLLBACK.
-- Not a valid writer, real signed JWT, Cloud or storage transaction proof.
begin;
do $scene_rev$
declare
  v_auth uuid;
  v_other uuid;
  v_owner uuid;
  v_creator uuid;
  v_published jsonb;
  v_before jsonb;
  v_retry jsonb;
  v_after jsonb;
  v_preset uuid;
  v_work uuid;
  v_first_revision uuid;
  v_new_revision uuid:=gen_random_uuid();
  v_blob uuid;
  v_tag text:=gen_random_uuid()::text;
  v_rejected boolean:=false;
  v_error text;
begin
  select ai.provider_subject::uuid,c.owner_account_id,c.creator_profile_id
  into v_auth,v_owner,v_creator
  from public.creator_profiles c
  join public.auth_identities ai on ai.account_id=c.owner_account_id
  where c.handle='isolated_bootstrap_creator' and ai.provider='supabase'
  limit 1;
  select ai.provider_subject::uuid into v_other
  from public.auth_identities ai
  where ai.provider='supabase' and ai.provider_subject<>v_auth::text
  limit 1;
  if v_auth is null or v_other is null then
    raise exception 'READINESS_SYNTHETIC_ACTORS_UNAVAILABLE';
  end if;

  if to_regprocedure('public.community_scene_revision_readiness_v1(uuid,uuid)') is null
    or not has_function_privilege('service_role','public.community_scene_revision_readiness_v1(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.community_scene_revision_readiness_v1(uuid,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.community_scene_revision_readiness_v1(uuid,uuid)','EXECUTE')
  then raise exception 'SCENE_REVISION_READINESS_ACL_FAILED';end if;

  v_published:=public.community_publish_preset_envelope(
    v_auth,v_creator,'public','scene','Readiness First Revision',null,
    'ci-only/scene-ready-'||v_tag||'.json',1,'application/json',
    512,repeat('f',64),'{}'::jsonb,'readiness:'||v_tag
  );
  v_preset:=(v_published->>'presetArtifactId')::uuid;
  v_work:=(v_published->>'workId')::uuid;
  v_first_revision:=(v_published->>'presetRevisionId')::uuid;

  v_before:=public.community_scene_revision_readiness_v1(v_auth,v_preset);
  if v_before->>'contract'<>'ddv.scene-revision-readiness@1'
    or v_before->>'ownerEligible'<>'true'
    or v_before->>'presetArtifactId'<>v_preset::text
    or v_before->>'presetWorkId'<>v_work::text
    or v_before->>'currentPresetRevisionId'<>v_first_revision::text
    or v_before->>'latestRevisionNumber'<>'1'
    or v_before->>'revisionCount'<>'1'
    or v_before->>'knownGalleryReferenceCount'<>'0'
    or v_before->>'knownHistoricalGalleryCount'<>'0'
    or v_before->'pairedGalleryWorkId' is distinct from 'null'::jsonb
    or v_before->'pairedGalleryWorkRowVersion' is distinct from 'null'::jsonb
    or v_before->'pairedGalleryCurrentWorkRevisionId' is distinct from 'null'::jsonb
    or v_before->>'pairedGallerySnapshotIsAtomicFence'<>'false'
    or v_before->>'historicalEdgeSetIsAtomicFence'<>'false'
    or v_before->>'graphComplete'<>'false'
    or v_before->>'saveRevisionAuthorized'<>'false'
    or v_before->>'pairedGalleryPublishAuthorized'<>'false'
    or v_before->>'unpublishAuthorized'<>'false'
    or v_before->>'deleteAuthorized'<>'false'
    or v_before->>'restoreAuthorized'<>'false'
    or v_before->>'dependencyFingerprintIsAtomicFence'<>'false'
    or v_before?'storageKey'
    or v_before?'signedUrl'
  then raise exception 'SCENE_REVISION_READINESS_FIRST_CONTRACT_BROKEN';end if;
  if not(v_before->'blockedReasons'?'GALLERY_ALL_WRITER_LOCK_PROTOCOL_UNVERIFIED')
  then raise exception 'SCENE_REVISION_READINESS_MISSING_GLOBAL_LOCK_GATE';end if;

  v_retry:=public.community_scene_revision_readiness_v1(v_auth,v_preset);
  if v_retry<>v_before then
    raise exception 'SCENE_REVISION_READINESS_UNCHANGED_NOT_IDEMPOTENT';
  end if;

  -- Readiness must not magically promote an unsealed historical Revision:
  -- new Revision row is intentionally not connected to current publication.
  select artifact_blob_id into v_blob from public.preset_revisions
  where preset_revision_id=v_first_revision;
  insert into public.preset_revisions(
    preset_revision_id,preset_artifact_id,revision_number,artifact_blob_id,
    metadata,created_by_account_id
  ) values(
    v_new_revision,v_preset,2,v_blob,'{"fixture":"unpublished"}'::jsonb,v_owner
  );
  v_after:=public.community_scene_revision_readiness_v1(v_auth,v_preset);
  if v_after->>'revisionCount'<>'2'
    or v_after->>'latestRevisionNumber'<>'2'
    or v_after->>'currentPresetRevisionId'<>v_first_revision::text
    or v_after->>'dependencyFingerprintSha256'=v_before->>'dependencyFingerprintSha256'
    or v_after->>'saveRevisionAuthorized'<>'false'
  then raise exception 'SCENE_REVISION_READINESS_HISTORICAL_POINTER_INCORRECT';end if;

  begin
    perform public.community_scene_revision_readiness_v1(v_other,v_preset);
  exception when others then
    get stacked diagnostics v_error=message_text;
    if v_error='SCENE_REVISION_NOT_OWNER_OR_UNAVAILABLE' then
      v_rejected:=true;
    else raise; end if;
  end;
  if not v_rejected then raise exception 'SCENE_REVISION_READINESS_NONOWNER_LEAK';end if;

  raise notice 'LOCAL_SCENE_REVISION_READINESS_OWNER_HISTORY_PRIVACY_ROLLBACK_PASS';
end
$scene_rev$;
rollback;
