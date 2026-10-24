-- 03 COMM linked Scene read: synthetic Gallery Photo current Media/Cover contract.
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
  v_gallery jsonb;
  v_preset_id uuid:=gen_random_uuid();
  v_preset_work uuid:=gen_random_uuid();
  v_preset_revision uuid:=gen_random_uuid();
  v_work_revision uuid:=gen_random_uuid();
  v_blob uuid:=gen_random_uuid();
  v_info jsonb;
  v_denied boolean:=false;
  v_tag text:=gen_random_uuid()::text;
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
  v_gallery:=public.community_publish_gallery_photo_v1(
    v_auth,v_creator,null,null,'outdoor',v_subject,
    'CI Linked Scene Gallery',null,
    array[v_media],v_media,true,'scene-linked-gallery:'||v_tag
  );

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
    (v_gallery->>'workId')::uuid
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
  values((v_gallery->>'revisionId')::uuid,v_preset_revision);
  update public.community_works
  set current_published_revision_id=v_work_revision,
      lifecycle_state='published',published_at=now()
  where work_id=v_preset_work;

  v_info:=public.community_get_scene_preset_public_v1(v_preset_work);
  if (v_info->>'presetRevisionId')::uuid is distinct from v_preset_revision
    or (v_info->>'galleryWorkId')::uuid is distinct from (v_gallery->>'workId')::uuid
    or (v_info->>'galleryWorkRevisionId')::uuid is distinct from (v_gallery->>'revisionId')::uuid
    or v_info->'mediaIds' <> jsonb_build_array(v_media)
    or (v_info->>'coverMediaId')::uuid is distinct from v_media
    or v_info->>'title' is distinct from 'Paired Scene'
    or v_info ? 'storageKey' then
    raise exception 'LINKED_SCENE_MEDIA_COVER_CURRENT_PROJECTION_FAILED';
  end if;

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
