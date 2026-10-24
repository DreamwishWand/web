-- 03 COMM INERT CANDIDATE: Scene Save Revision + Gallery Media transaction. Synthetic locally.
-- DISPOSABLE local Supabase only: never run on Staging/Production.
-- No real Storage object, public CDN, signed actor token or native DDV Apply.
begin;
create function pg_temp.scene_test_cover_failure() returns trigger
language plpgsql as $forced$ begin
  raise exception 'CI_FORCED_SCENE_COVER_WRITE_FAILURE';
end $forced$;

-- Unprivileged diagnostic oracle scoped to this disposable SQL fixture.
-- Owner preflight is read-only; it does NOT create an atomic Graph fence.
create function pg_temp.scene_edge_pin(p_preset uuid,p_gallery uuid)
returns text language sql stable as $pin$
  select encode(extensions.digest(convert_to(
    'scene-historical-edges-v1|'||p_preset::text||'|'||p_gallery::text||
    '|'||coalesce(string_agg(edge,'|' order by edge),''),
    'UTF8'),'sha256'),'hex')
  from (
    select distinct gp.gallery_revision_id::text||'/'||
      gp.preset_revision_id::text as edge
    from public.gallery_revision_presets gp
    join public.preset_revisions pr
      on pr.preset_revision_id=gp.preset_revision_id
    where pr.preset_artifact_id=p_preset
  ) scoped;
$pin$;
do $linked$
declare
  v_auth uuid;
  v_owner uuid;
  v_creator uuid;
  v_subject uuid;
  v_media uuid:=gen_random_uuid();
  v_gallery_work uuid:=gen_random_uuid();
  v_gallery_revision uuid:=gen_random_uuid();
  v_preset_id uuid:=gen_random_uuid();
  v_preset_work uuid:=gen_random_uuid();
  v_preset_revision uuid:=gen_random_uuid();
  v_work_revision uuid:=gen_random_uuid();
  v_blob uuid:=gen_random_uuid();
  v_info jsonb;
  v_readiness jsonb;
  v_denied boolean:=false;
  v_tag text:=gen_random_uuid()::text;
  v_second_blob uuid:=gen_random_uuid();
  v_third_blob uuid:=gen_random_uuid();
  v_fault_blob uuid:=gen_random_uuid();
  v_outbox_count integer;
  v_other_auth uuid;
  v_revision_count integer;
  v_second_media uuid:=gen_random_uuid();
  v_preset_ver bigint;
  v_gallery_ver bigint;
  v_paired_result jsonb;
  v_replay jsonb;
  v_stage_error text;
  v_initial_pin text;
  v_pin_before_extra_edge text;
  v_extra_gallery_revision uuid:=gen_random_uuid();
  v_versions_before uuid[];
begin
  select ai.provider_subject::uuid, c.owner_account_id, c.creator_profile_id
  into v_auth,v_owner,v_creator
  from public.creator_profiles c
  join public.auth_identities ai on ai.account_id=c.owner_account_id
  where c.handle='isolated_bootstrap_creator' and ai.provider='supabase'
  limit 1;
  select subject_id into v_subject
  from public.gallery_verified_subjects
  where subject_type='floating_island' and gallery_kind='outdoor'
    and verification_state='verified' limit 1;
  if v_auth is null or v_subject is null then
    raise exception 'LOCAL_LINKED_SCENE_INPUT_MISSING';
  end if;
  select ai.provider_subject::uuid into v_other_auth
  from public.auth_identities ai
  where ai.provider='supabase' and ai.provider_subject<>v_auth::text limit 1;
  if v_other_auth is null then raise exception 'PAIRED_NONOWNER_LOCAL_ACTOR_MISSING';end if;
  update public.creator_profiles
  set profile_visibility='public',moderation_state='clear'
  where creator_profile_id=v_creator;

  insert into public.community_entities(entity_id,entity_type)
  values(v_media,'media_asset');
  insert into public.media_assets(
    media_id,owner_account_id,storage_key,mime_type,
    byte_size,width,height,checksum_sha256,processing_state,moderation_state
  ) values(
    v_media,v_owner,'ci-only/linked-scene-'||v_tag||'.png','image/png',
    128,20,20,repeat('f',64),'ready','clear'
  );
  -- Build an UNSEALED Gallery revision. A published Gallery's immutable
  -- revision cannot accept a new gallery_revision_presets link afterward.
  -- All composition rows must exist before promotion to current published.
  insert into public.community_entities(entity_id,entity_type)
  values(v_gallery_work,'community_work');
  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,
    visibility,moderation_state
  ) values(v_gallery_work,v_owner,v_creator,'gallery','public','clear');
  insert into public.gallery_works(work_id,gallery_kind)
  values(v_gallery_work,'outdoor');
  insert into public.gallery_work_settings(work_id,comments_enabled)
  values(v_gallery_work,true);
  insert into public.gallery_photo_subjects(
    work_id,subject_id,owner_account_id,creator_profile_id
  ) values(v_gallery_work,v_subject,v_owner,v_creator);
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_gallery_revision,v_gallery_work,1,v_owner,
    jsonb_build_object('origin','synthetic-gallery-photo-read-v1')
  );
  insert into public.gallery_work_revisions(revision_id,title,description,metadata)
  values(v_gallery_revision,'CI Linked Scene Gallery',null,'{"photoOnly":true}'::jsonb);
  insert into public.work_revision_media(work_revision_id,media_id,ordinal,role)
  values(v_gallery_revision,v_media,0,'gallery');
  insert into public.gallery_photo_revision_fields(
    revision_id,subject_id,cover_media_id,originality_attested
  ) values(v_gallery_revision,v_subject,v_media,true);

  insert into public.community_entities(entity_id,entity_type)
  values(v_preset_work,'community_work'),(v_preset_id,'preset_artifact');
  insert into public.community_works(
    work_id,owner_account_id,creator_profile_id,work_type,
    visibility,moderation_state
  ) values(v_preset_work,v_owner,v_creator,'preset','public','clear');
  insert into public.preset_artifacts(
    preset_artifact_id,owner_account_id,creator_profile_id,
    community_work_id,preset_type,associated_gallery_work_id
  ) values(
    v_preset_id,v_owner,v_creator,v_preset_work,'scene',
    v_gallery_work
  );
  insert into public.artifact_blobs(
    blob_id,owner_account_id,storage_key,schema_version,content_type,
    byte_size,checksum_sha256
  ) values(v_blob,v_owner,'ci-only/paired-preset-'||v_tag||'.json',1,
    'application/json',256,repeat('e',64));
  insert into public.preset_revisions(
    preset_revision_id,preset_artifact_id,revision_number,
    artifact_blob_id,metadata,created_by_account_id
  ) values(
    v_preset_revision,v_preset_id,1,v_blob,
    '{"fixture":"paired"}'::jsonb,v_owner
  );
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata
  ) values(
    v_work_revision,v_preset_work,1,v_owner,
    '{"title":"Paired Scene","description":"Synthetic linked Scene"}'::jsonb
  );
  insert into public.preset_revision_publications(work_revision_id,preset_revision_id)
  values(v_work_revision,v_preset_revision);
  insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
  values(v_gallery_revision,v_preset_revision);
  update public.community_works
  set current_published_revision_id=v_gallery_revision,
      lifecycle_state='published',published_at=now()
  where work_id=v_gallery_work;
  update public.community_works
  set current_published_revision_id=v_work_revision,
      lifecycle_state='published',published_at=now()
  where work_id=v_preset_work;

  v_info:=public.community_get_scene_preset_public_v1(v_preset_work);
  if (v_info->>'presetRevisionId')::uuid is distinct from v_preset_revision
    or (v_info->>'galleryWorkId')::uuid is distinct from v_gallery_work
    or (v_info->>'galleryWorkRevisionId')::uuid is distinct from v_gallery_revision
    or v_info->'mediaIds' <> jsonb_build_array(v_media)
    or (v_info->>'coverMediaId')::uuid is distinct from v_media
    or v_info->>'title' is distinct from 'Paired Scene'
    or v_info ? 'storageKey' then
    raise exception 'LINKED_SCENE_MEDIA_COVER_CURRENT_PROJECTION_FAILED';
  end if;


  v_readiness:=public.community_scene_revision_readiness_v1(v_auth,v_preset_id);
  if v_readiness->>'knownGalleryReferenceCount'<>'1'
    or v_readiness->>'knownHistoricalGalleryCount'<>'1'
    or v_readiness->>'hasAssociatedGallery'<>'true'
    or v_readiness->>'currentPresetRevisionId'<>v_preset_revision::text
    or v_readiness->>'graphComplete'<>'false'
    or v_readiness->>'pairedGalleryPublishAuthorized'<>'false'
    or v_readiness->>'saveRevisionAuthorized'<>'false'
    or v_readiness->>'crossOwnerOrUnresolvedGalleryCount'<>'0'
    or v_readiness->>'pairedGalleryWorkId' is distinct from v_gallery_work::text
    or v_readiness->>'pairedGalleryWorkRowVersion' is distinct from
      (select row_version::text from public.community_works
       where work_id=v_gallery_work)
    or v_readiness->>'pairedGalleryCurrentWorkRevisionId' is distinct from
      v_gallery_revision::text
    or v_readiness->>'pairedGallerySnapshotIsAtomicFence'<>'false'
    or v_readiness->>'historicalEdgeSetIsAtomicFence'<>'false'
  then raise exception 'SCENE_LINKED_READINESS_MUST_STAY_FAILCLOSED';end if;


  -- This routine is postgres-only in the disposable DB. It MUST NOT be
  -- callable by service_role/anon/authenticated in the source candidate.
  if has_function_privilege('service_role',
      'private.scene_save_revision_paired_candidate_v1(uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text,text,uuid,uuid,uuid,text,bigint)','EXECUTE')
      or has_function_privilege('anon',
      'private.scene_save_revision_paired_candidate_v1(uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text,text,uuid,uuid,uuid,text,bigint)','EXECUTE')
      or has_function_privilege('authenticated',
      'private.scene_save_revision_paired_candidate_v1(uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text,text,uuid,uuid,uuid,text,bigint)','EXECUTE')
  then raise exception 'PAIRED_SCENE_CANDIDATE_EXPOSED_TO_CLIENT';end if;

  insert into public.community_entities(entity_id,entity_type)
  values(v_second_media,'media_asset');
  insert into public.media_assets(
    media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,
    checksum_sha256,processing_state,moderation_state
  ) values(v_second_media,v_owner,'ci-only/paired-second-'||v_tag||'.png',
           'image/png',256,20,20,repeat('a',64),'ready','clear');
  insert into public.artifact_blobs(
    blob_id,owner_account_id,storage_key,schema_version,content_type,
    byte_size,checksum_sha256
  ) values(v_second_blob,v_owner,'published/'||v_owner::text||'/'||v_tag||'.json',
           1,'application/json',512,repeat('b',64));

  select row_version into v_preset_ver from public.community_works
  where work_id=v_preset_work;
  select row_version into v_gallery_ver from public.community_works
  where work_id=v_gallery_work;

  v_initial_pin:=pg_temp.scene_edge_pin(v_preset_id,v_gallery_work);
  v_paired_result:=private.scene_save_revision_paired_candidate_v1(
    v_auth,v_preset_id,v_preset_revision,v_preset_ver,v_gallery_ver,
    v_second_blob,array[v_media,v_second_media],v_second_media,
    'Paired Scene V2','Revision with a new Cover',
    '{"source":"synthetic-ci"}'::jsonb,'paired-update:'||v_tag,v_initial_pin,
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_second_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_second_blob));
  if (v_paired_result->>'artifactBlobId')::uuid is distinct from v_second_blob
    or v_paired_result->>'artifactChecksumSha256' is distinct from repeat('b',64)
    or (v_paired_result->>'artifactByteSize')::bigint<>512
    or (v_paired_result->>'artifactSchemaVersion')::integer<>1
    or v_paired_result->'mediaIds' is distinct from
      jsonb_build_array(v_media,v_second_media)
    or (v_paired_result->>'previousGalleryWorkRevisionId')::uuid
      is distinct from v_gallery_revision
  then raise exception 'PAIRED_SCENE_REGISTERED_MANIFEST_RESPONSE_INVALID';end if;
  if (v_paired_result->>'mediaCount')::integer<>2
    or (v_paired_result->>'coverMediaId')::uuid is distinct from v_second_media
  then raise exception 'PAIRED_SCENE_COMMIT_RESPONSE_INVALID';end if;

  v_replay:=private.scene_save_revision_paired_candidate_v1(
    v_auth,v_preset_id,v_preset_revision,v_preset_ver,v_gallery_ver,
    v_second_blob,array[v_media,v_second_media],v_second_media,
    'Paired Scene V2','Revision with a new Cover',
    '{"source":"synthetic-ci"}'::jsonb,'paired-update:'||v_tag,v_initial_pin,
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_second_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_second_blob));
  if v_replay is distinct from v_paired_result
  then raise exception 'PAIRED_SCENE_IDENTICAL_RETRY_NOT_IDEMPOTENT';end if;

  v_info:=public.community_get_scene_preset_public_v1(v_preset_work);
  if v_info->>'title' <> 'Paired Scene V2'
    or v_info->'mediaIds'<>jsonb_build_array(v_media,v_second_media)
    or (v_info->>'coverMediaId')::uuid is distinct from v_second_media
    or (v_info->>'presetRevisionId')::uuid is distinct from
       (v_paired_result->>'presetRevisionId')::uuid
    or (v_info->>'galleryWorkRevisionId')::uuid is distinct from
       (v_paired_result->>'galleryWorkRevisionId')::uuid
  then raise exception 'PAIRED_SCENE_CURRENT_REVISION_MEDIA_COVER_WRONG';end if;
  if not exists (
    select 1 from public.gallery_photo_revision_fields gf
    where gf.revision_id=v_gallery_revision and gf.cover_media_id=v_media
  ) or not exists (
    select 1 from public.work_revision_media rm
    where rm.work_revision_id=v_gallery_revision and rm.media_id=v_media
  ) or not exists (
    select 1 from public.gallery_revision_presets gp
    where gp.gallery_revision_id=v_gallery_revision
      and gp.preset_revision_id=v_preset_revision
  ) then raise exception 'PAIRED_SCENE_HISTORICAL_COVER_OR_REFERENCE_LOST';end if;
  if not exists(
    select 1 from public.search_documents sd
    where sd.work_id=v_preset_work and sd.title='Paired Scene V2'
  ) or not exists(
    select 1 from public.search_documents sd
    where sd.work_id=v_gallery_work and sd.title='Paired Scene V2'
  ) then raise exception 'PAIRED_SCENE_SEARCH_NOT_ATOMIC';end if;
  if (select count(*) from public.outbox_events
    where event_type='work.published' and
      aggregate_id in(v_preset_work,v_gallery_work)
      and payload->>'presetRevisionId'=(v_paired_result->>'presetRevisionId'))<>2
  then raise exception 'PAIRED_SCENE_OUTBOX_COUNT_INVALID';end if;

  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,v_preset_revision,v_preset_ver,v_gallery_ver,
      v_second_blob,array[v_media,v_second_media],v_second_media,
      'DIFFERENT TITLE','Revision with a new Cover',
      '{"source":"synthetic-ci"}'::jsonb,'paired-update:'||v_tag,v_initial_pin,
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_second_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_second_blob));
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_IDEMPOTENCY_CONFLICT' then
      v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_REUSED_KEY_CHANGED_BODY_ALLOWED';end if;

  -- A second account must never be able to update someone else's paired Scene.
  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_other_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      (select row_version from public.community_works where work_id=v_preset_work),
      (select row_version from public.community_works where work_id=v_gallery_work),
      v_second_blob,array[v_media,v_second_media],v_second_media,
      'Foreign','Foreign', '{}'::jsonb,'other:'||v_tag,pg_temp.scene_edge_pin(v_preset_id,v_gallery_work),
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_second_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_second_blob));
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_PAIRED_RELATION_REQUIRED'
    then v_denied:=true;else raise;end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_NONOWNER_WRITE_ALLOWED';end if;

  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,v_preset_revision,v_preset_ver,v_gallery_ver,
      v_blob,array[v_media,v_second_media],v_second_media,
      'Stale','Stale', '{}'::jsonb,'stale:'||v_tag,pg_temp.scene_edge_pin(v_preset_id,v_gallery_work),
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_blob));
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_ROW_VERSION_CONFLICT' then
      v_denied:=true; else raise;end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_STALE_VERSION_ALLOWED';end if;

  insert into public.artifact_blobs(
    blob_id,owner_account_id,storage_key,schema_version,content_type,
    byte_size,checksum_sha256
  ) values(v_third_blob,v_owner,'published/'||v_owner::text||'/'||v_tag||'-third.json',
           1,'application/json',512,repeat('c',64));
  select count(*) into v_revision_count from public.preset_revisions
    where preset_artifact_id=v_preset_id;
  -- Neither an unchanged Work RowVersion nor a caller-provided checksum
  -- authorizes a replaced Gallery current Revision or a mismatched
  -- registered Blob manifest. Both reject before idempotency/DB mutation.
  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      (select row_version from public.community_works where work_id=v_preset_work),
      (select row_version from public.community_works where work_id=v_gallery_work),
      v_third_blob,array[v_media,v_second_media],v_second_media,
      'Wrong Gallery current','No-op', '{}'::jsonb,
      'wrong-gallery-current:'||v_tag,
      pg_temp.scene_edge_pin(v_preset_id,v_gallery_work),
      v_gallery_work,v_gallery_revision,v_creator,repeat('c',64),512);
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_GALLERY_CURRENT_REVISION_STALE'
    then v_denied:=true;else raise;end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_STALE_CURRENT_GALLERY_ALLOWED';end if;

  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      (select row_version from public.community_works where work_id=v_preset_work),
      (select row_version from public.community_works where work_id=v_gallery_work),
      v_third_blob,array[v_media,v_second_media],v_second_media,
      'Wrong Blob checksum','No-op', '{}'::jsonb,
      'wrong-blob-checksum:'||v_tag,
      pg_temp.scene_edge_pin(v_preset_id,v_gallery_work),
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,repeat('0',64),512);
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_REGISTERED_BLOB_EXPECTATION_STALE'
    then v_denied:=true;else raise;end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_WRONG_BLOB_CHECKSUM_ALLOWED';end if;

  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      (select row_version from public.community_works where work_id=v_preset_work),
      (select row_version from public.community_works where work_id=v_gallery_work),
      v_third_blob,array[v_media,v_second_media],v_second_media,
      'Wrong Blob size','No-op', '{}'::jsonb,
      'wrong-blob-size:'||v_tag,
      pg_temp.scene_edge_pin(v_preset_id,v_gallery_work),
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,repeat('c',64),511);
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_REGISTERED_BLOB_EXPECTATION_STALE'
    then v_denied:=true;else raise;end if;
  end;
  if not v_denied or exists (
    select 1 from public.idempotency_keys
    where account_id=v_owner and idempotency_key in
      ('wrong-gallery-current:'||v_tag,'wrong-blob-checksum:'||v_tag,
       'wrong-blob-size:'||v_tag)
  ) or (select count(*) from public.preset_revisions
        where preset_artifact_id=v_preset_id)<>v_revision_count
  then raise exception 'PAIRED_SCENE_WRONG_EXPECTATION_SIDE_EFFECT';end if;
  raise notice 'LOCAL_SCENE_GALLERY_CURRENT_BLOB_MANIFEST_STALE_DENY_PASS';

  -- A rejected physical reference never alters previous immutable revisions.
  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      (select row_version from public.community_works where work_id=v_preset_work),
      (select row_version from public.community_works where work_id=v_gallery_work),
      v_third_blob,array[v_media,v_second_media],gen_random_uuid(),
      'Bad cover','Failure', '{}'::jsonb,'bad-cover:'||v_tag,pg_temp.scene_edge_pin(v_preset_id,v_gallery_work),
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_third_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_third_blob));
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_MEDIA_COUNT_COVER_OR_UNIQUENESS_INVALID'
    then v_denied:=true; else raise;end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_BAD_COVER_ALLOWED';end if;
  if exists (select 1 from public.idempotency_keys
    where account_id=v_owner and idempotency_key='bad-cover:'||v_tag)
  then raise exception 'PAIRED_SCENE_FAILED_RETRY_COMMITTED';end if;
  -- Unknown Media fails after all critical revision version checks, with no
  -- provisional idempotency or partial Work/Revision mutations.
  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      (select row_version from public.community_works where work_id=v_preset_work),
      (select row_version from public.community_works where work_id=v_gallery_work),
      v_third_blob,array[v_media,gen_random_uuid()],v_media,
      'Invalid media','Failure', '{}'::jsonb,'bad-media:'||v_tag,pg_temp.scene_edge_pin(v_preset_id,v_gallery_work),
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_third_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_third_blob));
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_MEDIA_NOT_OWNER_READY_CLEAR'
    then v_denied:=true;else raise;end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_UNKNOWN_MEDIA_ALLOWED';end if;
  if exists (select 1 from public.idempotency_keys
    where account_id=v_owner and idempotency_key in ('bad-media:'||v_tag,'other:'||v_tag))
    or (select count(*) from public.preset_revisions
        where preset_artifact_id=v_preset_id)<>v_revision_count
  then raise exception 'PAIRED_SCENE_FAILED_UPDATE_SIDE_EFFECT';end if;
  raise notice 'LOCAL_SCENE_PAIRED_NONOWNER_STALE_MEDIA_ROLLBACK_PASS';

  -- R8/R9 regression: a noncurrent historical revision linked to the SAME
  -- GalleryWork changes references without updating either Work rowVersion.
  -- An unchanged caller pin MUST now fail BEFORE idempotency or any mutation.
  v_pin_before_extra_edge:=pg_temp.scene_edge_pin(v_preset_id,v_gallery_work);
  v_versions_before:=array[
    (select current_published_revision_id from public.community_works where work_id=v_preset_work),
    (select current_published_revision_id from public.community_works where work_id=v_gallery_work)
  ];
  select row_version into v_preset_ver from public.community_works where work_id=v_preset_work;
  select row_version into v_gallery_ver from public.community_works where work_id=v_gallery_work;
  insert into public.community_work_revisions(
    revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
  values(v_extra_gallery_revision,v_gallery_work,
    (select max(revision_number)+1 from public.community_work_revisions
      where work_id=v_gallery_work),v_owner,
    '{"fixture":"unpublished-historical-extra-edge"}'::jsonb);
  insert into public.gallery_work_revisions(revision_id,title,description,metadata)
  values(v_extra_gallery_revision,'Unpublished history','Regression fixture','{}'::jsonb);
  insert into public.gallery_revision_presets(gallery_revision_id,preset_revision_id)
  values(v_extra_gallery_revision,v_preset_revision);
  if pg_temp.scene_edge_pin(v_preset_id,v_gallery_work)=v_pin_before_extra_edge
    or (select row_version from public.community_works where work_id=v_preset_work)<>v_preset_ver
    or (select row_version from public.community_works where work_id=v_gallery_work)<>v_gallery_ver
  then raise exception 'SCENE_STALE_EDGE_FIXTURE_NOT_VALID';end if;
  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      v_preset_ver,v_gallery_ver,v_third_blob,array[v_media,v_second_media],
      v_second_media,'Must refuse','Extra historical edge',
      '{}'::jsonb,'stale-history:'||v_tag,v_pin_before_extra_edge,
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_third_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_third_blob));
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_CALLER_EDGE_FINGERPRINT_STALE'
    then v_denied:=true;else raise;end if;
  end;
  if not v_denied
    or exists(select 1 from public.idempotency_keys
      where account_id=v_owner and idempotency_key='stale-history:'||v_tag)
    or (select count(*) from public.preset_revisions
        where preset_artifact_id=v_preset_id)<>v_revision_count
    or array[
      (select current_published_revision_id from public.community_works where work_id=v_preset_work),
      (select current_published_revision_id from public.community_works where work_id=v_gallery_work)
    ] is distinct from v_versions_before
  then raise exception 'SCENE_STALE_EDGE_PIN_ATOMIC_REJECTION_FAILED';end if;
  raise notice 'LOCAL_SCENE_SAME_GALLERY_STALE_CALLER_PIN_DENY_PASS';


  -- Deliberately fail LATE, after the PresetRevision, WorkRevisions and
  -- transaction-scoped idempotency entry have been inserted. PL/pgSQL
  -- exception subtransactions must roll back ALL partial DB writes.
  insert into public.artifact_blobs(
    blob_id,owner_account_id,storage_key,schema_version,content_type,
    byte_size,checksum_sha256
  ) values(v_fault_blob,v_owner,'published/'||v_owner::text||'/'||v_tag||'-fault.json',
           1,'application/json',600,repeat('d',64));
  select count(*) into v_outbox_count from public.outbox_events
  where aggregate_id in (v_preset_work,v_gallery_work);
  execute 'create trigger isolated_scene_cover_abort before insert on public.gallery_photo_revision_fields for each row execute function pg_temp.scene_test_cover_failure()';
  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      (select row_version from public.community_works where work_id=v_preset_work),
      (select row_version from public.community_works where work_id=v_gallery_work),
      v_fault_blob,array[v_media,v_second_media],v_second_media,
      'Forced rollback','Fault injection', '{}'::jsonb,'fault:'||v_tag,pg_temp.scene_edge_pin(v_preset_id,v_gallery_work),
      v_gallery_work,
      (select current_published_revision_id from public.community_works
       where work_id=v_gallery_work),v_creator,
      (select lower(checksum_sha256) from public.artifact_blobs where blob_id=v_fault_blob),
      (select byte_size from public.artifact_blobs where blob_id=v_fault_blob));
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='CI_FORCED_SCENE_COVER_WRITE_FAILURE'
    then v_denied:=true; else raise; end if;
  end;
  execute 'drop trigger isolated_scene_cover_abort on public.gallery_photo_revision_fields';
  if not v_denied then raise exception 'PAIRED_SCENE_FORCED_ABORT_FAILED';end if;
  if (select count(*) from public.preset_revisions
      where preset_artifact_id=v_preset_id)<>v_revision_count
    or (select count(*) from public.outbox_events
      where aggregate_id in (v_preset_work,v_gallery_work))<>v_outbox_count
    or exists(select 1 from public.idempotency_keys
      where account_id=v_owner and idempotency_key='fault:'||v_tag)
    or (select current_published_revision_id from public.community_works
      where work_id=v_preset_work) is distinct from
        (v_paired_result->>'presetWorkRevisionId')::uuid
    or (select current_published_revision_id from public.community_works
      where work_id=v_gallery_work) is distinct from
        (v_paired_result->>'galleryWorkRevisionId')::uuid
  then raise exception 'PAIRED_SCENE_ATOMIC_ROLLBACK_LEAK';end if;
  raise notice 'LOCAL_SCENE_PAIRED_LATE_EXCEPTION_ATOMIC_ROLLBACK_PASS';

  raise notice 'LOCAL_SCENE_PAIRED_UPDATE_MEDIA_HISTORICAL_COVER_IDEMPOTENCY_ROLLBACK_PASS';

  update public.media_assets set moderation_state='restricted' where media_id=v_media;
  v_denied:=false;
  begin
    perform public.community_get_scene_preset_public_v1(v_preset_work);
  exception when others then
    if position('Associated Gallery media is not publicly ready' in sqlerrm)>0
    then v_denied:=true;else raise;end if;
  end;
  if not v_denied then
    raise exception 'SCENE_LINKED_RESTRICTED_MEDIA_LEAK';
  end if;
  raise notice 'LOCAL_SCENE_LINKED_GALLERY_MEDIA_COVER_ROLLBACK_PASS';
end
$linked$;
rollback;
