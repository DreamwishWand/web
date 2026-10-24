-- #116 Gallery public token issuance regression; rollback-only synthetic rows.
-- Creates a REAL published Gallery Photo through the existing canonical RPC,
-- then a deliberately inconsistent additional Gallery revision with a Cover
-- reference but no work_revision_media membership. No Storage bytes touched.
begin;
do $$
declare
 v_auth uuid;v_account uuid;v_creator uuid;v_subject uuid;
 v_other uuid;v_key text;v_unbound_key text;v_denied boolean:=false;v_result jsonb;
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
 select ai.provider_subject::uuid into v_other
 from public.wand_accounts wa join public.auth_identities ai on ai.account_id=wa.account_id
 and ai.provider='supabase' and ai.identity_state='active'
 where wa.status='active' and wa.account_id<>v_account limit 1;
 if v_other is null then raise exception 'GALLERY_COVER_OTHER_ACTOR_MISSING';end if;
 v_key:=v_auth::text||'/'||v_cover_only::text||'.png';
 perform public.community_gallery_media_intent_open_v1(v_auth,v_key,'image/png',128);
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
       (v_cover_only,v_account,v_key,'image/png',
   128,20,20,repeat('b',64),'ready','clear');

 perform public.community_gallery_media_intent_complete_v1(v_auth,v_key,v_cover_only);
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

 -- Immutable historical Cover-only reference has no WorkRevisionMedia row.
 -- Owner Abort must not mark this published-history Media quarantined or aborted.
 v_denied:=false;
 begin
   perform public.community_gallery_media_intent_cancel_v1(v_auth,v_key);
 exception when others then
   if position('GALLERY_MEDIA_ALREADY_BOUND' in sqlerrm)>0 then
      v_denied:=true; else raise;end if;
 end;
 if not v_denied then raise exception 'COVER_ONLY_OWNER_ABORT_PERMITTED';end if;
 if (select processing_state from public.media_assets where media_id=v_cover_only)<>'ready'
 or (select state from public.community_media_upload_intents where storage_key=v_key)<>'finalized'
 then raise exception 'COVER_ONLY_ABORT_MUTATED_MEDIA_OR_JOURNAL';end if;
 v_denied:=false;
 begin perform public.community_gallery_media_intent_cancel_v1(v_other,v_key);
 exception when others then
  if position('GALLERY_UPLOAD_FORBIDDEN' in sqlerrm)>0 then v_denied:=true;
  else raise;end if;
 end;
 if not v_denied then raise exception 'COVER_ONLY_NONOWNER_ABORT_AUTHORIZED';end if;
 -- Unreferenced pending intent remains cancelable and idempotent.
 v_unbound_key:=v_auth::text||'/'||gen_random_uuid()::text||'.png';
 perform public.community_gallery_media_intent_open_v1(v_auth,v_unbound_key,'image/png',128);
 v_result:=public.community_gallery_media_intent_cancel_v1(v_auth,v_unbound_key);
 if (v_result->>'aborted')::boolean is distinct from true
 or (v_result->>'alreadyAborted')::boolean is distinct from false
 then raise exception 'UNBOUND_PENDING_ABORT_DENIED';end if;
 v_result:=public.community_gallery_media_intent_cancel_v1(v_auth,v_unbound_key);
 if (v_result->>'alreadyAborted')::boolean is distinct from true
 then raise exception 'UNBOUND_PENDING_ABORT_NOT_IDEMPOTENT';end if;
 if (public.community_gallery_physical_cleanup_gate_v1()->>'physicalDeleteAuthorized')::boolean is distinct from false
 then raise exception 'GALLERY_PHYSICAL_GATE_BYPASS';end if;
 if has_function_privilege('anon','public.community_gallery_media_intent_cancel_v1(uuid,text)','EXECUTE')
 or has_function_privilege('authenticated','public.community_gallery_media_intent_cancel_v1(uuid,text)','EXECUTE')
 or not has_function_privilege('service_role','public.community_gallery_media_intent_cancel_v1(uuid,text)','EXECUTE')
 then raise exception 'COVER_ABORT_PUBLIC_EXECUTE';end if;
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

 raise notice 'GALLERY_OWNER_ABORT_COVER_ONLY_IMMUTABLE_AND_IDEMPOTENT_PASS';
end $$;
rollback;
