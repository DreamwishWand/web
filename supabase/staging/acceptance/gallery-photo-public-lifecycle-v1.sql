-- SQL-only staging contract acceptance; fixture data MUST rollback.
begin;
do $$
declare
  v_subject uuid;
  v_subject_other uuid;
  v_account uuid;
  v_account_other uuid;
  v_creator uuid;
  v_target uuid;
  v_media_1 uuid:=gen_random_uuid();
  v_media_2 uuid:=gen_random_uuid();
  v_key text:='test-photo-'||gen_random_uuid()::text;
  v_response jsonb;
  v_replay jsonb;
  v_update jsonb;
  v_work uuid;
  v_first_revision uuid;
  v_second_revision uuid;
  v_row bigint;
  v_block boolean;
  v_artifact uuid:=gen_random_uuid();
  v_kind text;
  v_subject_type text;
  v_base bigint;
  v_case_media uuid;
  v_case_subject uuid;
  v_case_response jsonb;
begin
  select ai.provider_subject::uuid,wa.account_id,c.creator_profile_id
  into v_subject,v_account,v_creator
  from public.wand_accounts wa
  join public.auth_identities ai
    on ai.account_id=wa.account_id and ai.provider='supabase' and ai.identity_state='active'
  join public.creator_profiles c on c.owner_account_id=wa.account_id and c.moderation_state='clear'
  where wa.status='active' and not exists(select 1 from public.account_roles ar where ar.account_id=wa.account_id)
  order by wa.account_id limit 1;
  select ai.provider_subject::uuid,wa.account_id
  into v_subject_other,v_account_other
  from public.wand_accounts wa join public.auth_identities ai
    on ai.account_id=wa.account_id and ai.provider='supabase' and ai.identity_state='active'
  where wa.status='active' and wa.account_id<>v_account order by wa.account_id limit 1;
  if v_account is null or v_account_other is null then
    raise exception 'ACCEPTANCE_ACCOUNTS_MISSING';
  end if;
  -- This trusted subject row is a transaction-only fixture, NOT a canonical 09 INT seed.
  insert into public.gallery_verified_subjects(
    gallery_kind,subject_type,canonical_target_id,base_item_id,
    platform,game_version,build_id,profile_schema,evidence_ref,verification_state
  ) values('outdoor','biome','ACCEPTANCE_ONLY_'||gen_random_uuid()::text,
    null,'switch','1.25.0','52BD625D9B4E0053',624,
    'rollback-only-contract-fixture','verified') returning subject_id into v_target;

  insert into public.community_entities(entity_id,entity_type) values
    (v_media_1,'media_asset'),(v_media_2,'media_asset');
  insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
    byte_size,width,height,checksum_sha256,processing_state,moderation_state)
  values
    (v_media_1,v_account,'acceptance/'||v_media_1||'.png',
      'image/png',12345,1920,1080,repeat('a',64),'ready','clear'),
    (v_media_2,v_account,'acceptance/'||v_media_2||'.jpg',
      'image/jpeg',12345,1920,1080,repeat('b',64),'ready','clear');

  v_block:=false;
  begin
    perform public.community_publish_gallery_photo_v1(v_subject,v_creator,null,null,
      'outdoor',v_target,'A',null,array[v_media_1,v_media_1],v_media_1,true,v_key||':invalid');
  exception when others then
    if position('GALLERY_MEDIA_SELECTION_INVALID' in sqlerrm)>0 then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_DUPLICATE_MEDIA_ACCEPTED'; end if;

  v_block:=false;
  begin
    perform public.community_publish_gallery_photo_v1(v_subject,v_creator,null,null,
      'outdoor',v_target,'A',null,array[v_media_1],v_media_1,false,v_key||':attestation');
  exception when others then
    if position('GALLERY_ORIGINALITY_ATTESTATION_REQUIRED' in sqlerrm)>0 then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_MISSING_ATTESTATION_ACCEPTED'; end if;

  v_block:=false;
  begin
    perform public.community_publish_gallery_photo_v1(v_subject,v_creator,null,null,
      'tom_furniture',v_target,'A',null,array[v_media_1],v_media_1,true,v_key||':kind');
  exception when others then
    if position('GALLERY_VERIFIED_SUBJECT_REQUIRED' in sqlerrm)>0 then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_UNVERIFIED_KIND_ACCEPTED'; end if;

  v_response:=public.community_publish_gallery_photo_v1(v_subject,v_creator,null,null,
    'outdoor',v_target,'Accepted A',null,array[v_media_1,v_media_2],v_media_2,true,v_key);
  v_work:=(v_response->>'workId')::uuid;
  v_first_revision:=(v_response->>'revisionId')::uuid;
  v_row:=(v_response->>'rowVersion')::bigint;

  if (v_response->>'created')::boolean<>true
    or (v_response->>'coverMediaId')::uuid<>v_media_2
    or (v_response->'mediaIds'->>0)::uuid<>v_media_2
    or (select count(*) from public.work_revision_media where work_revision_id=v_first_revision)<>2
    or not exists(select 1 from public.search_documents where work_id=v_work) then
    raise exception 'ACCEPTANCE_CREATE_PAYLOAD_OR_PUBLIC_INDEX_FAILED';
  end if;

  v_replay:=public.community_publish_gallery_photo_v1(v_subject,v_creator,null,null,
    'outdoor',v_target,'Accepted A',null,array[v_media_1,v_media_2],v_media_2,true,v_key);
  if v_replay<>v_response then raise exception 'ACCEPTANCE_IDEMPOTENCY_REPLAY_FAILED'; end if;

  v_block:=false;
  begin
    perform public.community_publish_gallery_photo_v1(v_subject,v_creator,null,null,
      'outdoor',v_target,'Other Title',null,array[v_media_1,v_media_2],v_media_2,true,v_key);
  exception when others then
    if position('GALLERY_IDEMPOTENCY_CONFLICT' in sqlerrm)>0 then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_IDEMPOTENCY_REUSE_ACCEPTED'; end if;

  v_block:=false;
  begin
    perform public.community_publish_gallery_photo_v1(v_subject_other,v_creator,v_work,v_row,
      'outdoor',v_target,'Intruder',null,array[v_media_1],v_media_1,true,v_key||':other');
  exception when others then
    if position('GALLERY_CREATOR_FORBIDDEN' in sqlerrm)>0 or position('GALLERY_WORK_FORBIDDEN' in sqlerrm)>0
      then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_NONOWNER_UPDATE_ACCEPTED'; end if;

  v_update:=public.community_publish_gallery_photo_v1(v_subject,v_creator,v_work,v_row,
    'outdoor',v_target,'Accepted B',null,array[v_media_2,v_media_1],v_media_1,true,v_key||':update');
  v_second_revision:=(v_update->>'revisionId')::uuid;
  if v_second_revision=v_first_revision
    or (select title from public.gallery_work_revisions where revision_id=v_first_revision)<>'Accepted A'
    or (select title from public.gallery_work_revisions where revision_id=v_second_revision)<>'Accepted B'
    or (select current_published_revision_id from public.community_works where work_id=v_work)<>v_second_revision
    then raise exception 'ACCEPTANCE_IMMUTABLE_PUBLISH_UPDATE_FAILED'; end if;

  v_block:=false;
  begin
    perform public.community_publish_gallery_photo_v1(v_subject,v_creator,v_work,v_row,
      'outdoor',v_target,'Rejected Concurrent',null,array[v_media_1],v_media_1,true,v_key||':conflict');
  exception when others then
    if position('GALLERY_ROW_VERSION_CONFLICT' in sqlerrm)>0 then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_STALE_WRITE_ACCEPTED'; end if;

  if (public.community_get_gallery_photo_public_v1(v_work)->>'title')<>'Accepted B'
    or (public.community_get_gallery_photo_public_v1(v_work)->>'coverMediaId')<>v_media_1::text
    or (public.community_get_public_media_storage_v2(v_media_1)->>'mediaId')<>v_media_1::text then
    raise exception 'ACCEPTANCE_PUBLIC_DETAIL_OR_MEDIA_FAILED';
  end if;

  v_block:=false;
  begin
    perform public.community_unpublish_work(v_subject,v_work,(v_update->>'rowVersion')::bigint,v_key||':unsafe-unpublish');
  exception when others then
    if position('GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED' in sqlerrm)>0
      then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_PRIVATE_PRESERVATION_BYPASS'; end if;

  v_block:=false;
  begin
    perform public.community_publish_gallery_photo_v1(v_subject,v_creator,v_work,null,
      'outdoor',v_target,'Missing Version',null,array[v_media_1],v_media_1,true,v_key||':null-version');
  exception when others then
    if position('GALLERY_ROW_VERSION_CONFLICT' in sqlerrm)>0 then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_NULL_ROW_VERSION_ACCEPTED'; end if;

  -- Existing Preset linkage must block deletion until 09 INT supplies atomic retirement.
  insert into public.community_entities(entity_id,entity_type)
  values(v_artifact,'preset_artifact');
  insert into public.preset_artifacts(
    preset_artifact_id,owner_account_id,creator_profile_id,preset_type,associated_gallery_work_id
  ) values(v_artifact,v_account,v_creator,'scene',v_work);

  v_block:=false;
  begin
    perform public.community_delete_gallery_photo_v1(
      v_subject,v_work,(v_update->>'rowVersion')::bigint,v_key||':blocked-linked-delete');
  exception when others then
    if position('GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED' in sqlerrm)>0
      then v_block:=true; else raise; end if;
  end;
  if not v_block then raise exception 'ACCEPTANCE_DEPENDENT_PRESET_DELETION_ACCEPTED'; end if;
  if (select lifecycle_state from public.community_works where work_id=v_work)<>'published' then
    raise exception 'ACCEPTANCE_PARTIAL_DELETION_CHANGED_PUBLIC_WORK'; end if;
  delete from public.preset_artifacts where preset_artifact_id=v_artifact;

  perform public.community_delete_gallery_photo_v1(
    v_subject,v_work,(v_update->>'rowVersion')::bigint,v_key||':delete');

  if exists(select 1 from public.search_documents where work_id=v_work) then
    raise exception 'ACCEPTANCE_PUBLIC_SEARCH_NOT_REVOKED';
  end if;
  v_block:=false;
  begin
    perform public.community_get_gallery_photo_public_v1(v_work);
  exception when others then v_block:=true;
  end;
  if not v_block then raise exception 'ACCEPTANCE_DELETED_DIRECT_READ_ACCESSIBLE'; end if;
  v_block:=false;
  begin
    perform public.community_get_public_media_storage_v2(v_media_1);
  exception when others then v_block:=true;
  end;
  if not v_block then raise exception 'ACCEPTANCE_DELETED_MEDIA_RESOLVER_ACCESSIBLE'; end if;
  -- Four additional classifications share no media and no Work identity.
  for v_kind,v_subject_type,v_base in
    select * from (values
      ('outdoor'::text,'floating_island'::text,null::bigint),
      ('indoor'::text,'room'::text,null::bigint),
      ('tom_furniture'::text,'tom_furniture'::text,40000001::bigint),
      ('tom_clothing'::text,'tom_clothing'::text,50000001::bigint)
    ) x(k,t,b)
  loop
    v_case_media:=gen_random_uuid();
    insert into public.community_entities(entity_id,entity_type)
    values(v_case_media,'media_asset');
    insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
      byte_size,width,height,checksum_sha256,processing_state,moderation_state)
    values(v_case_media,v_account,'acceptance/'||v_case_media||'.png',
      'image/png',12345,1920,1080,repeat('a',64),'ready','clear');
    insert into public.gallery_verified_subjects(
      gallery_kind,subject_type,canonical_target_id,base_item_id,
      platform,game_version,build_id,profile_schema,evidence_ref,verification_state
    ) values(v_kind,v_subject_type,'ACCEPTANCE_ONLY_'||gen_random_uuid()::text,
      v_base,'switch','1.25.0','52BD625D9B4E0053',624,
      'rollback-only-contract-fixture','verified') returning subject_id into v_case_subject;
    v_case_response:=public.community_publish_gallery_photo_v1(v_subject,v_creator,null,null,
      v_kind,v_case_subject,'Classification acceptance',null,
      array[v_case_media],v_case_media,true,v_key||':class:'||v_subject_type);
    if v_case_response->>'galleryKind'<>v_kind or v_case_response->>'subjectType'<>v_subject_type
      or (v_case_response->>'baseItemId')::bigint is distinct from v_base
      or (public.community_get_gallery_photo_public_v1((v_case_response->>'workId')::uuid)->>'subjectType')<>v_subject_type
    then raise exception 'ACCEPTANCE_CLASSIFICATION_FAILED %',v_subject_type; end if;
  end loop;

  raise notice 'GALLERY_PHOTO_V1_ROLLBACK_PASS';
end $$;
rollback;
