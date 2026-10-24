-- 03 COMM #124 automatic orphan cleaner service RPC acceptance.
-- BEGIN/ROLLBACK only: NEVER writes or deletes real Storage objects.
begin;
do $$
declare a uuid;account_id uuid; creator uuid; subject_id uuid;
 key_a text;key_b text;key_c text;
 media_a uuid:=gen_random_uuid();media_c uuid:=gen_random_uuid();
 token_a uuid:=gen_random_uuid();token_b uuid:=gen_random_uuid();
 res jsonb; public_work jsonb; v_bad boolean;
begin
 select ai.provider_subject::uuid,wa.account_id,cp.creator_profile_id
 into a,account_id,creator
 from public.wand_accounts wa
 join public.auth_identities ai on ai.account_id=wa.account_id and ai.provider='supabase'
   and ai.identity_state='active'
 join public.creator_profiles cp on cp.owner_account_id=wa.account_id and cp.moderation_state='clear'
 where wa.status='active'
 order by wa.account_id limit 1;
 if a is null then raise exception 'NO_STAGING_OWNER';end if;
 select g.subject_id into subject_id from public.gallery_verified_subjects g
 where subject_type='floating_island' and verification_state='verified'
 order by canonical_target_id limit 1;
 if subject_id is null then raise exception 'NO_CANONICAL_SUBJECT';end if;
 key_a:=a::text||'/'||gen_random_uuid()||'.png';
 key_b:=a::text||'/'||gen_random_uuid()||'.png';
 key_c:=a::text||'/'||gen_random_uuid()||'.png';
 -- Backdated fixtures are born expired; never mutate the immutable URL
 -- deadline after prepare, even in acceptance tests.
 insert into public.community_media_upload_intents(
   storage_key,owner_account_id,auth_subject,mime_type,expected_bytes,issued_at,expires_at)
 select k,account_id,a,'image/png',128,now()-interval '3 hours',now()-interval '10 minutes'
 from unnest(array[key_a,key_b,key_c]) k;

 -- A: abandoned pending key, nothing attached, automatic orphan claim.

 res:=public.community_claim_gallery_media_orphans_v1(1,token_a);
 if (res->>'claimed')::integer<>1
 or (res->'jobs'->0->>'storageKey')<>key_a then
   raise exception 'AUTO_CLAIM_PENDING_FAILED';end if;
 if (select state from public.community_media_upload_intents where storage_key=key_a)<>'aborted'
 then raise exception 'CLAIM_DID_NOT_ABORT_PENDING';end if;
 v_bad:=false;
 begin
 perform public.community_gallery_media_intent_probe_v1(a,key_a);
 exception when others then
 if position('GALLERY_UPLOAD_ABORTED' in sqlerrm)>0 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'CLAIMED_PENDING_REFINALIZED';end if;
 if (public.community_claim_gallery_media_orphans_v1(5,token_b)->>'claimed')::int<>0
 then raise exception 'ACTIVE_LEASE_DOUBLE_CLAIMED';end if;
 v_bad:=false;
 begin
 perform public.community_complete_gallery_media_orphan_v1(key_a,token_b);
 exception when others then
 if position('GALLERY_CLEANUP_LEASE_INVALID' in sqlerrm)>0 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'FOREIGN_LEASE_COMPLETED';end if;
 res:=public.community_fail_gallery_media_orphan_v1(key_a,token_a,'SIMULATED_STORAGE_503');
 if (res->>'retry')::boolean<>true then raise exception 'FAILED_RETRY_NOT_RECORDED';end if;
 if (select cleanup_last_error from public.community_media_upload_intents where storage_key=key_a)<>'SIMULATED_STORAGE_503'
 then raise exception 'RETRY_AUDIT_MISSING';end if;
 update public.community_media_upload_intents set cleanup_retry_at=now()-interval '1 minute'
 where storage_key=key_a;
 res:=public.community_claim_gallery_media_orphans_v1(1,token_b);
 if (res->>'claimed')::int<>1 then raise exception 'RECLAIM_FAILED';end if;
 perform public.community_complete_gallery_media_orphan_v1(key_a,token_b);
 if exists(select 1 from public.community_media_upload_intents where storage_key=key_a)
 then raise exception 'COMPLETED_INTENT_NOT_DELETED';end if;

 -- B: owner-aborted pending, expired. The worker must reclaim automatically.
 perform public.community_gallery_media_intent_cancel_v1(a,key_b);

 res:=public.community_claim_gallery_media_orphans_v1(1,token_a);
 if (res->'jobs'->0->>'storageKey')<>key_b then raise exception 'ABORT_NOT_CLAIMED';end if;
 perform public.community_complete_gallery_media_orphan_v1(key_b,token_a);
 if exists(select 1 from public.community_media_upload_intents where storage_key=key_b)
 then raise exception 'ABORT_CLEANUP_FAILED';end if;

 -- C: an old generic Finalize somehow left intent PENDING with a media
 -- already published. Even after expiry NO physical delete job may be issued.
 insert into public.community_entities(entity_id,entity_type)
 values(media_c,'media_asset');
 insert into public.media_assets(media_id,owner_account_id,storage_key,
  mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values(media_c,account_id,key_c,'image/png',128,64,64,repeat('a',64),'ready','clear');
 public_work:=public.community_publish_gallery_photo_v1(a,creator,null,null,
  'outdoor',subject_id,'Protected published gallery media',null,array[media_c],media_c,true,
  'gallery-cleaner-rollback-'||gen_random_uuid()::text);

 res:=public.community_claim_gallery_media_orphans_v1(5,token_b);
 if (res->>'claimed')::int<>0 then raise exception 'REFERENCED_MEDIA_CLAIMED_FOR_DELETION';end if;
 if (select state from public.community_media_upload_intents where storage_key=key_c)<>'finalized'
 or (select processing_state::text from public.media_assets where media_id=media_c)<>'ready'
 or not exists(select 1 from public.work_revision_media where media_id=media_c)
 then raise exception 'REFERENCED_MEDIA_NOT_PRESERVED';end if;
 if (select count(*) from public.audit_events where action_type='gallery_media_orphan_cleaned')<2
 then raise exception 'CLEANUP_AUDIT_MISSING';end if;

 -- Legacy manual/direct Storage deletion is revoked.
 v_bad:=false;
 begin perform public.community_gallery_media_intent_cleanup_probe_v1(a,key_c);
 exception when others then
 if position('GALLERY_CLEANUP_WORKER_ONLY' in sqlerrm)>0 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'LEGACY_CLEANUP_STILL_ENABLED';end if;
 if has_function_privilege('anon','public.community_claim_gallery_media_orphans_v1(integer,uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.community_complete_gallery_media_orphan_v1(text,uuid)','EXECUTE')
 or has_function_privilege('anon','public.community_fail_gallery_media_orphan_v1(text,uuid,text)','EXECUTE')
 or not has_function_privilege('service_role','public.community_claim_gallery_media_orphans_v1(integer,uuid)','EXECUTE')
 then raise exception 'ORPHAN_WORKER_SQL_EXPOSED';end if;
 raise notice 'GALLERY_ORPHAN_RETENTION_LEASE_ROLLBACK_PASS';
end $$;
rollback;