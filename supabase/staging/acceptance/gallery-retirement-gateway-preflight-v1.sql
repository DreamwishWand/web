-- 03 COMM #116: actual Staging SQL-only positive/negative gateway/preflight.
-- No HTTP Storage bytes fabricated; all synthetic media/Work are rolled back.
begin;
do $$
declare
 v_auth uuid;v_other uuid;v_account uuid;v_creator uuid;v_subject uuid;
 v_media1 uuid:=gen_random_uuid();v_media2 uuid:=gen_random_uuid();
 v_work uuid;v_published jsonb;v_updated jsonb;v_gateway jsonb;v_pref jsonb;
 v_rejected boolean:=false;v_nonce text:=gen_random_uuid()::text;
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
 select ai.provider_subject::uuid into v_other
 from public.wand_accounts wa join public.auth_identities ai
   on ai.account_id=wa.account_id and ai.provider='supabase'
   and ai.identity_state='active'
 where wa.status='active' and wa.account_id<>v_account limit 1;
 if v_auth is null or v_other is null then raise exception 'ACCEPTANCE_ACTORS_MISSING'; end if;
 select subject_id into v_subject from public.gallery_verified_subjects
 where verification_state='verified' and subject_type='floating_island'
 order by canonical_target_id limit 1;
 if v_subject is null then raise exception 'VERIFIED_ISLAND_MISSING';end if;
 if (public.community_gallery_media_gateway_v1(gen_random_uuid())->>'galleryManaged')::boolean
 then raise exception 'UNRELATED_IMAGE_CLASSIFIED_GALLERY';end if;

 insert into public.community_entities(entity_id,entity_type)
 values(v_media1,'media_asset'),(v_media2,'media_asset');
 insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
 byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values(v_media1,v_account,'rollback/'||v_media1||'.png','image/png',128,20,20,
   repeat('a',64),'ready','clear'),
       (v_media2,v_account,'rollback/'||v_media2||'.png','image/png',128,20,20,
   repeat('b',64),'ready','clear');
 v_published:=public.community_publish_gallery_photo_v1(
 v_auth,v_creator,null,null,'outdoor',v_subject,'Gallery stream first',null,
 array[v_media1],v_media1,true,'retire-gateway-create:'||v_nonce);
 v_work:=(v_published->>'workId')::uuid;
 v_gateway:=public.community_gallery_media_gateway_v1(v_media1);
 if (v_gateway->>'galleryManaged')::boolean is distinct from true
 or (v_gateway->>'publiclyAccessible')::boolean is distinct from true
 or (v_gateway->>'mediaId')::uuid is distinct from v_media1
 or v_gateway->>'storageKey' is null then
   raise exception 'GALLERY_CURRENT_PUBLIC_GATEWAY_MISSING'; end if;
 v_pref:=public.community_gallery_retirement_preflight_v1(v_auth,v_work);
 if (v_pref->>'ownerEligible')::boolean is distinct from true
 or (v_pref->>'operationAuthorized')::boolean is distinct from false
 or (v_pref->>'graphComplete')::boolean is distinct from false
 or (v_pref->>'previousSignedUrlsRevoked')::boolean is distinct from false
 or (v_pref->>'cloudEntitlementVerified')::boolean is distinct from false
 or (v_pref->>'rowVersion')::bigint is distinct from (v_published->>'rowVersion')::bigint
 then raise exception 'RETIREMENT_PREFLIGHT_NOT_FAIL_CLOSED';end if;
 v_rejected:=false;
 begin
  perform public.community_gallery_retirement_preflight_v1(v_other,v_work);
 exception when others then
  if position('GALLERY_RETIREMENT_NOT_OWNER' in sqlerrm)>0 then v_rejected:=true;
  else raise;end if;
 end;
 if not v_rejected then raise exception 'NONOWNER_PREFLIGHT_SUCCEEDED';end if;
 if (select lifecycle_state::text from public.community_works where work_id=v_work)<>'published'
 then raise exception 'PREFLIGHT_MUTATED_WORK';end if;

 v_updated:=public.community_publish_gallery_photo_v1(
 v_auth,v_creator,v_work,(v_published->>'rowVersion')::bigint,
 'outdoor',v_subject,'Gallery stream newer',null,array[v_media2],v_media2,true,
 'retire-gateway-update:'||v_nonce);
 v_gateway:=public.community_gallery_media_gateway_v1(v_media1);
 if (v_gateway->>'galleryManaged')::boolean is distinct from true
 or (v_gateway->>'publiclyAccessible')::boolean is distinct from false
 or v_gateway ? 'storageKey' then
 raise exception 'HISTORICAL_GALLERY_IMAGE_STILL_TOKENABLE';end if;
 v_gateway:=public.community_gallery_media_gateway_v1(v_media2);
 if (v_gateway->>'galleryManaged')::boolean is distinct from true
 or (v_gateway->>'publiclyAccessible')::boolean is distinct from true
 then raise exception 'NEW_CURRENT_REVISION_NOT_ACCESSIBLE';end if;
 -- The original #113 trigger must reject premature direct PRIVATE
 -- transitions even for SQL-only fixtures; never bypass the protection.
 v_rejected:=false;
 begin
   update public.community_works set visibility='private' where work_id=v_work;
 exception when others then
   if position('GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED' in sqlerrm)>0
   then v_rejected:=true;else raise;end if;
 end;
 if not v_rejected then raise exception 'PREMATURE_PRIVATE_TRANSITION_ACCEPTED';end if;
 v_gateway:=public.community_gallery_media_gateway_v1(v_media2);
 if (v_gateway->>'publiclyAccessible')::boolean is distinct from true
 then raise exception 'BLOCKED_PRIVATE_CHANGED_PUBLIC_DETAIL';end if;
 if has_function_privilege('anon','public.community_gallery_media_gateway_v1(uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.community_gallery_retirement_preflight_v1(uuid,uuid)','EXECUTE')
 or not has_function_privilege('service_role','public.community_gallery_media_gateway_v1(uuid)','EXECUTE')
 then raise exception 'PUBLIC_SQL_AUTH_BYPASS';end if;
 raise notice 'RETIREMENT_GATEWAY_PREFLIGHT_SQL_ROLLBACK_PASS';
end $$;
rollback;