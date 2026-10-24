-- #124 origin reconciliation SQL acceptance: BEGIN/ROLLBACK ONLY.
-- No Storage object content or Storage metadata are modified.
begin;
do $$
declare a uuid;account_id uuid;k text;mid uuid:=gen_random_uuid();
 before_state jsonb;after_state jsonb;bad boolean:=false;
begin
 before_state:=public.community_gallery_storage_reconciliation_v1('community-media-staging');
 if before_state->>'bucketChecked' is distinct from 'true'
   or before_state->>'safeToAutoDelete' is distinct from 'false'
 then raise exception 'STORAGE_RECONCILIATION_FALSE_AUTHORIZATION';end if;
 select ai.provider_subject::uuid,w.account_id into a,account_id
 from public.wand_accounts w
 join public.auth_identities ai on ai.account_id=w.account_id
  and ai.provider='supabase' and ai.identity_state='active'
 where w.status='active' order by w.account_id limit 1;
 if a is null then raise exception 'NO_STAGING_OWNER';end if;
 k:=a::text||'/'||gen_random_uuid()||'.png';
 perform public.community_gallery_media_intent_open_v1(a,k,'image/png',128);
 insert into public.community_entities(entity_id,entity_type)
 values(mid,'media_asset');
 insert into public.media_assets(media_id,owner_account_id,storage_key,
  mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values(mid,account_id,k,'image/png',128,20,20,repeat('a',64),'ready','clear');
 perform public.community_gallery_media_intent_complete_v1(a,k,mid);
 after_state:=public.community_gallery_storage_reconciliation_v1('community-media-staging');
 if (after_state->>'finalizedReadyMissingOriginCount')::bigint <>
   (before_state->>'finalizedReadyMissingOriginCount')::bigint + 1
 then raise exception 'MISSING_ORIGIN_NOT_DETECTED';end if;
 if (after_state->>'originObjectCount')::bigint <>
   (before_state->>'originObjectCount')::bigint
 then raise exception 'FIXTURE_TOUCHED_STORAGE_ORIGIN';end if;
 begin
   perform public.community_gallery_storage_reconciliation_v1('not-an-existing-bucket-for-acceptance');
 exception when others then
   if position('GALLERY_STORAGE_RECONCILIATION_BUCKET_INVALID' in sqlerrm)>0
      then bad:=true;else raise;end if;
 end;
 if not bad then raise exception 'UNKNOWN_ORIGIN_BUCKET_ACCEPTED';end if;
 if has_function_privilege('anon','public.community_gallery_storage_reconciliation_v1(text)','EXECUTE')
 or has_function_privilege('authenticated','public.community_gallery_storage_reconciliation_v1(text)','EXECUTE')
 or not has_function_privilege('service_role','public.community_gallery_storage_reconciliation_v1(text)','EXECUTE')
 then raise exception 'RECONCILIATION_ACL_UNSAFE';end if;
 raise notice 'GALLERY_ORIGIN_METADATA_READONLY_RECONCILIATION_PASS';
end $$;
rollback;