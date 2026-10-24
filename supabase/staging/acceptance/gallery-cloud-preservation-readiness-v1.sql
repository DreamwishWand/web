-- #116 Owner-only read-only Wand Cloud preservation audit.
-- BEGIN/ROLLBACK: canonical published Work, immutable Update, owner/other.
-- No fake Cloud entitlement or private visibility transition.
begin;
do $$
declare
 a uuid;b uuid;v_account uuid;v_creator uuid;v_subject uuid;
 mid1 uuid:=gen_random_uuid();mid2 uuid:=gen_random_uuid();wid uuid;
 initial jsonb;updated jsonb;preflight jsonb;manifest jsonb;cloud jsonb;
 deny boolean:=false;nonce text:=gen_random_uuid()::text;
begin
 select ai.provider_subject::uuid,w.account_id,c.creator_profile_id
 into a,v_account,v_creator
 from public.wand_accounts w
 join public.auth_identities ai on ai.account_id=w.account_id
  and ai.provider='supabase' and ai.identity_state='active'
 join public.creator_profiles c on c.owner_account_id=w.account_id
  and c.moderation_state='clear'
 where w.status='active' order by w.account_id limit 1;
 select ai.provider_subject::uuid into b
 from public.wand_accounts w
 join public.auth_identities ai on ai.account_id=w.account_id
  and ai.provider='supabase' and ai.identity_state='active'
 where w.status='active' and w.account_id<>v_account limit 1;
 if a is null or b is null then raise exception 'SIGNED_OWNER_DB_FIXTURE_ACTORS_MISSING';end if;
 select s.subject_id into v_subject from public.gallery_verified_subjects s
 where s.subject_type='floating_island' and s.verification_state='verified'
 order by canonical_target_id limit 1;
 if v_subject is null then raise exception 'REVIEWED_GALLERY_SUBJECT_MISSING';end if;
 insert into public.community_entities(entity_id,entity_type)
 values(mid1,'media_asset'),(mid2,'media_asset');
 insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
 byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values(mid1,v_account,'rollback/'||mid1||'.png','image/png',128,20,20,
  repeat('a',64),'ready','clear'),
       (mid2,v_account,'rollback/'||mid2||'.png','image/png',128,20,20,
  repeat('b',64),'ready','clear');
 initial:=public.community_publish_gallery_photo_v1(
 a,v_creator,null,null,'outdoor',v_subject,'Cloud audit rev 1',null,
 array[mid1],mid1,true,'gallery-cloud-readiness-1:'||nonce);
 wid:=(initial->>'workId')::uuid;
 preflight:=public.community_gallery_retirement_preflight_v1(a,wid);
 cloud:=preflight->'cloudPreservation';
 manifest:=cloud->'databaseManifest';
 if cloud->>'contract' is distinct from 'ddv.gallery-cloud-preservation-readiness@1'
 or cloud->'entitlement'->>'source' is distinct from 'not_configured'
 or (cloud->'entitlement'->>'verified')::boolean is distinct from false
 or (cloud->>'privateSaveAuthorized')::boolean is distinct from false
 or (cloud->>'restoreAuthorized')::boolean is distinct from false
 or (manifest->>'currentRevisionPresent')::boolean is distinct from true
 or (manifest->>'currentRevisionSealed')::boolean is distinct from true
 or (manifest->>'revisionRowCount')::bigint<>1
 or (manifest->>'coverReferenceCount')::bigint<>1
 or (manifest->>'distinctMediaCount')::bigint<>1
 or (manifest->>'invalidOrNonOwnedMediaCount')::bigint<>0
 or (manifest->>'structuralIntegrityObserved')::boolean is distinct from true
 then raise exception 'INITIAL_CLOUD_AUDIT_INCORRECT: %',cloud::text;end if;
 updated:=public.community_publish_gallery_photo_v1(
 a,v_creator,wid,(initial->>'rowVersion')::bigint,
 'outdoor',v_subject,'Cloud audit rev 2',null,array[mid2],mid2,true,
 'gallery-cloud-readiness-2:'||nonce);
 preflight:=public.community_gallery_retirement_preflight_v1(a,wid);
 cloud:=preflight->'cloudPreservation';
 manifest:=cloud->'databaseManifest';
 if (manifest->>'revisionRowCount')::bigint<>2
 or (manifest->>'sealedRevisionRowCount')::bigint<>2
 or (manifest->>'historicalRevisionRowCount')::bigint<>1
 or (manifest->>'coverReferenceCount')::bigint<>2
 or (manifest->>'distinctMediaCount')::bigint<>2
 or (manifest->>'invalidOrNonOwnedMediaCount')::bigint<>0
 or (manifest->>'structuralIntegrityObserved')::boolean is distinct from true
 or (preflight->>'rowVersion')::bigint is distinct from
    (updated->>'rowVersion')::bigint
 or (preflight->>'graphComplete')::boolean is distinct from false
 or (preflight->>'unpublishKeepPrivateAuthorized')::boolean is distinct from false
 then raise exception 'HISTORY_OR_CLOUD_PERMISSION_INCORRECT: %',cloud::text;end if;
 -- DB-only negative fixture: an immutable historical media reference is
 -- still present, but its registry checksum has become invalid. The owner
 -- manifest MUST reject a preservation-safe interpretation without altering
 -- any Gallery visibility or asserting real Storage corruption.
 update public.media_assets set checksum_sha256=repeat('z',64) where media_id=mid1;
 preflight:=public.community_gallery_retirement_preflight_v1(a,wid);
 cloud:=preflight->'cloudPreservation';
 manifest:=cloud->'databaseManifest';
 if (manifest->>'invalidOrNonOwnedMediaCount')::bigint<>1
 or (manifest->>'structuralIntegrityObserved')::boolean is distinct from false
 or (cloud->>'privateSaveAuthorized')::boolean is distinct from false
 or (cloud->>'restoreAuthorized')::boolean is distinct from false
 or (preflight->>'graphComplete')::boolean is distinct from false
 then raise exception 'INVALID_HISTORICAL_MEDIA_NOT_FAIL_CLOSED: %',cloud::text;end if;

 deny:=false;
 begin
   perform public.community_gallery_retirement_preflight_v1(b,wid);
 exception when others then
   if position('GALLERY_RETIREMENT_NOT_OWNER' in sqlerrm)>0
    then deny:=true;else raise;end if;
 end;
 if not deny then raise exception 'CLOUD_PREFLIGHT_NONOWNER_LEAK';end if;
 if has_function_privilege('anon','public.community_gallery_retirement_preflight_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.community_gallery_retirement_preflight_v1(uuid,uuid)','EXECUTE')
 or has_function_privilege('anon','private.gallery_cloud_preservation_snapshot_v1(uuid)','EXECUTE')
 or has_function_privilege('authenticated','private.gallery_cloud_preservation_snapshot_v1(uuid)','EXECUTE')
 or not has_function_privilege('service_role','public.community_gallery_retirement_preflight_v1(uuid,uuid)','EXECUTE')
 then raise exception 'CLOUD_PREFLIGHT_PRIVILEGE_BYPASS';end if;
 raise notice 'GALLERY_CLOUD_PRESERVATION_OWNER_READONLY_SQL_ROLLBACK_PASS';
end $$;
rollback;
