-- #116 Gallery public token issuance regression; rollback-only synthetic rows.
-- Creates a REAL published Gallery Photo through the existing canonical RPC,
-- then a deliberately inconsistent additional Gallery revision with a Cover
-- reference but no work_revision_media membership. No Storage bytes touched.
begin;
do $$
declare
 v_auth uuid;v_account uuid;v_creator uuid;v_subject uuid;
 v_cover_ok uuid:=gen_random_uuid();
 v_cover_only uuid:=gen_random_uuid();
 v_work uuid;v_revision uuid:=gen_random_uuid();
 v_published jsonb;v_current jsonb;v_cover jsonb;v_owner jsonb;
 v_nonce text:=gen_random_uuid()::text;
begin
 select ai.provider_subject::uuid,wa.account_id,c.creator_profile_id
 into v_auth,v_account,v_creator
 from public.wand_accounts wa
 join public.auth_identities ai on ai.account_id=wa.account_id
   and ai.provider='supabase' and ai.identity_state='active'
 join public.creator_profiles c on c.owner_account_id=wa.account_id
   and c.moderation_state='clear'
 where wa.status='active'
 order by wa.account_id limit 1;
 if v_auth is null then raise exception 'GALLERY_COVER_FIXTURE_OWNER_MISSING'; end if;
 select subject_id into v_subject from public.gallery_verified_subjects
 where verification_state='verified' and subject_type='floating_island'
 order by canonical_target_id limit 1;
 if v_subject is null then raise exception 'GALLERY_COVER_FIXTURE_SUBJECT_MISSING'; end if;

 insert into public.community_entities(entity_id,entity_type)
 values(v_cover_ok,'media_asset'),(v_cover_only,'media_asset');
 insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
 byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values(v_cover_ok,v_account,'rollback/'||v_cover_ok||'.png','image/png',
   128,20,20,repeat('a',64),'ready','clear'),
       (v_cover_only,v_account,'rollback/'||v_cover_only||'.png','image/png',
   128,20,20,repeat('b',64),'ready','clear');

 v_published:=public.community_publish_gallery_photo_v1(
  v_auth,v_creator,null,null,'outdoor',v_subject,'Current published Gallery',null,
  array[v_cover_ok],v_cover_ok,true,'cover-guard-create:'||v_nonce
 );
 v_work:=(v_published->>'workId')::uuid;
 v_current:=public.community_gallery_media_gateway_v1(v_cover_ok);
 if (v_current->>'galleryManaged')::boolean is distinct from true
    or (v_current->>'publiclyAccessible')::boolean is distinct from true then
   raise exception 'CURRENT_GALLERY_MEDIA_UNEXPECTEDLY_BLOCKED';
 end if;

 -- Deliberate DB-only inconsistent Gallery revision. Must never be
 -- interpreted as permission to stream an unpublished Cover-only image.
 insert into public.community_work_revisions(
  revision_id,work_id,revision_number,created_by_account_id,shared_metadata)
 values(v_revision,v_work,2,v_account,'{}'::jsonb);
 insert into public.gallery_work_revisions(revision_id,title,metadata)
 values(v_revision,'Unpublished cover-only fixture','{}'::jsonb);
 insert into public.gallery_photo_revision_fields(
  revision_id,subject_id,cover_media_id,originality_attested)
 values(v_revision,v_subject,v_cover_only,true);

 if exists(select 1 from public.work_revision_media
           where work_revision_id=v_revision and media_id=v_cover_only) then
   raise exception 'FIXTURE_COVER_UNEXPECTEDLY_MEDIA_BOUND';
 end if;
 v_cover:=public.community_gallery_media_gateway_v1(v_cover_only);
 if (v_cover->>'galleryManaged')::boolean is distinct from true
    or (v_cover->>'publiclyAccessible')::boolean is distinct from false
    or v_cover ? 'storageKey' then
   raise exception 'COVER_ONLY_IMAGE_NOT_FAIL_CLOSED';
 end if;

 v_owner:=public.community_gallery_owner_media_read_v1(v_auth,v_cover_only);
 if (v_owner->>'galleryManaged')::boolean is distinct from true
    or (v_owner->>'ownerAuthorized')::boolean is distinct from true then
   raise exception 'OWNER_HISTORICAL_COVER_CLASSIFICATION_REGRESSION';
 end if;
 if (public.community_gallery_media_gateway_v1(gen_random_uuid())->>'galleryManaged')::boolean
 then raise exception 'UNRELATED_IMAGE_MARKED_GALLERY'; end if;
 if has_function_privilege('anon','public.community_gallery_media_gateway_v1(uuid)','execute')
 or has_function_privilege('authenticated','public.community_gallery_media_gateway_v1(uuid)','execute')
 or not has_function_privilege('service_role','public.community_gallery_media_gateway_v1(uuid)','execute')
 then raise exception 'PUBLIC_GATEWAY_RPC_PERMISSION_REGRESSION'; end if;

 raise notice 'GALLERY_PUBLIC_COVER_ONLY_GUARD_ROLLBACK_PASS';
end $$;
rollback;
