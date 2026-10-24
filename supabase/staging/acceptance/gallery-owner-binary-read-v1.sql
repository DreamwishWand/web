-- #116: owner binary no-signed-URL classification; SQL rollback only.
-- No JWT spoof, no Storage HTTP upload and no secret/public bearer URL.
begin;
do $$
declare a uuid;b uuid;owner_a uuid;creator uuid;subject uuid;
 key1 text;key2 text;media1 uuid:=gen_random_uuid();media2 uuid:=gen_random_uuid();
 work jsonb;updated jsonb;gate jsonb;bad boolean;
begin
 select ai.provider_subject::uuid,w.account_id,c.creator_profile_id
 into a,owner_a,creator
 from public.wand_accounts w join public.auth_identities ai
  on ai.account_id=w.account_id and ai.provider='supabase' and ai.identity_state='active'
 join public.creator_profiles c on c.owner_account_id=w.account_id and c.moderation_state='clear'
 where w.status='active' order by w.account_id limit 1;
 select ai.provider_subject::uuid into b from public.wand_accounts w
 join public.auth_identities ai on ai.account_id=w.account_id
   and ai.provider='supabase' and ai.identity_state='active'
 where w.status='active' and w.account_id<>owner_a limit 1;
 select subject_id into subject from public.gallery_verified_subjects
 where verification_state='verified' and subject_type='floating_island'
 order by canonical_target_id limit 1;
 if a is null or b is null or subject is null then raise exception 'MISSING_OWNER_ACTORS';end if;
 key1:=a::text||'/'||gen_random_uuid()||'.png';
 key2:=a::text||'/'||gen_random_uuid()||'.png';
 perform public.community_gallery_media_intent_open_v1(a,key1,'image/png',128);
 perform public.community_gallery_media_intent_open_v1(a,key2,'image/png',128);
 insert into public.community_entities(entity_id,entity_type) values(media1,'media_asset'),(media2,'media_asset');
 insert into public.media_assets(media_id,owner_account_id,storage_key,
  mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values(media1,owner_a,key1,'image/png',128,20,20,repeat('a',64),'ready','clear'),
 (media2,owner_a,key2,'image/png',128,20,20,repeat('b',64),'ready','clear');
 gate:=public.community_gallery_owner_media_read_v1(a,media1);
 if gate->>'galleryManaged'<>'true' or gate->>'ownerAuthorized'<>'false' or gate ? 'storageKey'
 then raise exception 'PENDING_GALLERY_OWNER_READ_WAS_SIGNABLE';end if;
 perform public.community_gallery_media_intent_complete_v1(a,key1,media1);
 perform public.community_gallery_media_intent_complete_v1(a,key2,media2);
 gate:=public.community_gallery_owner_media_read_v1(a,media1);
 if gate->>'ownerAuthorized'<>'true'
   or gate->>'transport'<>'authenticated_edge_binary_post'
   or gate->>'signedStorageUrlIssued'<>'false' or gate->>'storageKey'<>key1
 then raise exception 'FINALIZED_OWNER_PROXY_DENIED';end if;
 gate:=public.community_gallery_owner_media_read_v1(b,media1);
 if gate->>'galleryManaged'<>'true' or gate->>'ownerAuthorized'<>'false'
   or gate ? 'storageKey' then raise exception 'NONOWNER_STORAGE_KEY_LEAK';end if;
 work:=public.community_publish_gallery_photo_v1(
   a,creator,null,null,'outdoor',subject,'Historical owner binary',null,
   array[media1],media1,true,'gallery-owner-binary-'||gen_random_uuid());
 updated:=public.community_publish_gallery_photo_v1(
   a,creator,(work->>'workId')::uuid,(work->>'rowVersion')::bigint,
   'outdoor',subject,'Historical owner binary newer',null,
   array[media2],media2,true,'gallery-owner-binary-update-'||gen_random_uuid());
 gate:=public.community_gallery_owner_media_read_v1(a,media1);
 if gate->>'ownerAuthorized'<>'true' then raise exception 'HISTORICAL_OWNER_PROXY_DENIED';end if;
 gate:=public.community_gallery_owner_media_read_v1(b,media2);
 if gate->>'ownerAuthorized'<>'false' or gate ? 'storageKey'
 then raise exception 'PUBLISHED_NONOWNER_PROXY_LEAK';end if;
 if has_function_privilege('anon','public.community_gallery_owner_media_read_v1(uuid,uuid)','EXECUTE')
   or has_function_privilege('authenticated','public.community_gallery_owner_media_read_v1(uuid,uuid)','EXECUTE')
   or not has_function_privilege('service_role','public.community_gallery_owner_media_read_v1(uuid,uuid)','EXECUTE')
 then raise exception 'GALLERY_OWNER_BINARY_SERVICE_GRANTS';end if;
 raise notice 'OWNER_HISTORICAL_NO_RAW_SIGNED_URL_ROLLBACK_PASS';
end $$;
rollback;