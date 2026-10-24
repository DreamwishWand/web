-- 03 COMM INERT CANDIDATE: Scene Save Revision + Gallery Media transaction. Synthetic locally.
-- DISPOSABLE local Supabase only: never run on Staging/Production.
-- No real Storage object, public CDN, signed actor token or native DDV Apply.
begin;
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
  v_second_media uuid:=gen_random_uuid();
  v_preset_ver bigint;
  v_gallery_ver bigint;
  v_paired_result jsonb;
  v_replay jsonb;
  v_stage_error text;
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
  then raise exception 'SCENE_LINKED_READINESS_MUST_STAY_FAILCLOSED';end if;


  -- This routine is postgres-only in the disposable DB. It MUST NOT be
  -- callable by service_role/anon/authenticated in the source candidate.
  if has_function_privilege('service_role',
      'private.scene_save_revision_paired_candidate_v1(uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text)','EXECUTE')
      or has_function_privilege('anon',
      'private.scene_save_revision_paired_candidate_v1(uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text)','EXECUTE')
      or has_function_privilege('authenticated',
      'private.scene_save_revision_paired_candidate_v1(uuid,uuid,uuid,bigint,bigint,uuid,uuid[],uuid,text,text,jsonb,text)','EXECUTE')
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

  v_paired_result:=private.scene_save_revision_paired_candidate_v1(
    v_auth,v_preset_id,v_preset_revision,v_preset_ver,v_gallery_ver,
    v_second_blob,array[v_media,v_second_media],v_second_media,
    'Paired Scene V2','Revision with a new Cover',
    '{"source":"synthetic-ci"}'::jsonb,'paired-update:'||v_tag);
  if (v_paired_result->>'mediaCount')::integer<>2
    or (v_paired_result->>'coverMediaId')::uuid is distinct from v_second_media
  then raise exception 'PAIRED_SCENE_COMMIT_RESPONSE_INVALID';end if;

  v_replay:=private.scene_save_revision_paired_candidate_v1(
    v_auth,v_preset_id,v_preset_revision,v_preset_ver,v_gallery_ver,
    v_second_blob,array[v_media,v_second_media],v_second_media,
    'Paired Scene V2','Revision with a new Cover',
    '{"source":"synthetic-ci"}'::jsonb,'paired-update:'||v_tag);
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
      '{"source":"synthetic-ci"}'::jsonb,'paired-update:'||v_tag);
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_IDEMPOTENCY_CONFLICT' then
      v_denied:=true; else raise; end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_REUSED_KEY_CHANGED_BODY_ALLOWED';end if;

  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,v_preset_revision,v_preset_ver,v_gallery_ver,
      v_blob,array[v_media,v_second_media],v_second_media,
      'Stale','Stale', '{}'::jsonb,'stale:'||v_tag);
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_ROW_VERSION_CONFLICT' then
      v_denied:=true; else raise;end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_STALE_VERSION_ALLOWED';end if;

  -- A rejected physical reference never alters previous immutable revisions.
  v_denied:=false;
  begin
    perform private.scene_save_revision_paired_candidate_v1(
      v_auth,v_preset_id,(v_paired_result->>'presetRevisionId')::uuid,
      (select row_version from public.community_works where work_id=v_preset_work),
      (select row_version from public.community_works where work_id=v_gallery_work),
      v_blob,array[v_media,v_second_media],gen_random_uuid(),
      'Bad cover','Failure', '{}'::jsonb,'bad-cover:'||v_tag);
  exception when others then
    get stacked diagnostics v_stage_error=message_text;
    if v_stage_error='SCENE_REVISION_BLOB_INVALID_OR_REUSED' or
       v_stage_error='SCENE_REVISION_MEDIA_COUNT_COVER_OR_UNIQUENESS_INVALID'
    then v_denied:=true; else raise;end if;
  end;
  if not v_denied then raise exception 'PAIRED_SCENE_BAD_COVER_ALLOWED';end if;
  if exists (select 1 from public.idempotency_keys
    where account_id=v_owner and idempotency_key='bad-cover:'||v_tag)
  then raise exception 'PAIRED_SCENE_FAILED_RETRY_COMMITTED';end if;
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
