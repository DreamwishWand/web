-- 03 COMM #124 / 06 PRODUCT #128 source-backed Staging DB acceptance.
-- NO physical signed Storage test and no durable synthetic commit.
begin;
do $$
declare
 v_auth uuid;v_other uuid;v_account uuid;v_creator uuid;v_subject uuid;
 v_key text;v_keys text[]:='{}';v_media uuid:=gen_random_uuid();
 v_final jsonb;v_pre jsonb;v_capacity jsonb;v_op jsonb;v_pub jsonb;
 v_clock timestamptz;v_count int;v_bad boolean;v_nonce text:=gen_random_uuid()::text;
begin
 select ai.provider_subject::uuid,w.account_id,c.creator_profile_id
 into v_auth,v_account,v_creator
 from public.wand_accounts w
 join public.auth_identities ai on ai.account_id=w.account_id
   and ai.provider='supabase' and ai.identity_state='active'
 join public.creator_profiles c on c.owner_account_id=w.account_id and c.moderation_state='clear'
 where w.status='active' order by w.account_id limit 1;
 select ai.provider_subject::uuid into v_other
 from public.wand_accounts w join public.auth_identities ai
   on ai.account_id=w.account_id and ai.provider='supabase' and ai.identity_state='active'
 where w.status='active' and w.account_id<>v_account limit 1;
 select subject_id into v_subject from public.gallery_verified_subjects
 where subject_type='floating_island' and verification_state='verified'
 order by canonical_target_id limit 1;
 if v_auth is null or v_other is null or v_subject is null
 then raise exception 'ACCOUNT_SUBJECT_FIXTURES_MISSING';end if;
 v_capacity:=private.gallery_media_capacity_snapshot_v1(v_account);
 if (v_capacity->>'maxActiveUnbound')::int<>10 or
    (v_capacity->>'maxReservedBytes')::bigint<>209715200 or
    (v_capacity->>'quotaEnforced')::boolean<>true or
    (v_capacity->>'ttlActive')::boolean<>false
 then raise exception 'QUOTA_OR_TTL_GATE_WRONG';end if;
 for v_count in 1..10 loop
   v_key:=v_auth::text||'/'||gen_random_uuid()::text||'.png';
   v_pre:=public.community_gallery_media_intent_open_v1(v_auth,v_key,'image/png',20971520);
   if v_pre->>'state'<>'pending' or (v_pre->>'reuseExpiresAt') is not null
    then raise exception 'PREPARE_WRONG_STATUS';end if;
   v_keys:=array_append(v_keys,v_key);
 end loop;
 v_capacity:=private.gallery_media_capacity_snapshot_v1(v_account);
 if (v_capacity->>'activeUnboundCount')::int<>10 or
    (v_capacity->>'reservedBytes')::bigint<>209715200
 then raise exception 'QUOTA_RESERVATION_NOT_ACCOUNTED';end if;
 v_key:=v_auth::text||'/'||gen_random_uuid()::text||'.png';
 v_bad:=false;
 begin
   perform public.community_gallery_media_intent_open_v1(v_auth,v_key,'image/png',128);
 exception when others then
   if position('GALLERY_UPLOAD_OUTSTANDING_COUNT_EXCEEDED' in sqlerrm)>0
      then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'ELEVENTH_INTENT_ALLOWED';end if;
 v_bad:=false;
 begin perform public.community_gallery_media_intent_open_v1(v_other,
    v_auth::text||'/'||gen_random_uuid()||'.png','image/png',128);
 exception when others then
 if position('GALLERY_UPLOAD_INTENT_INVALID' in sqlerrm)>0 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'NONOWNER_UNSCOPED_OPEN_ACCEPTED';end if;
 -- Aborted records stop using a live count slot but reserve physical bytes
 -- until worker actually removes them: immediate retry must not bypass storage cap.
 perform public.community_gallery_media_intent_cancel_v1(v_auth,v_keys[2]);
 v_capacity:=private.gallery_media_capacity_snapshot_v1(v_account);
 if (v_capacity->>'activeUnboundCount')::int<>9 or
    (v_capacity->>'reservedBytes')::bigint<>209715200 or
    (v_capacity->>'abortedAwaitingPhysicalCleanup')::int<>1
 then raise exception 'ABORTED_PHYSICAL_RESERVATION_RELEASED_EARLY';end if;
 v_bad:=false;
 begin perform public.community_gallery_media_intent_open_v1(v_auth,v_key,'image/png',128);
 exception when others then
 if position('GALLERY_UPLOAD_RESERVED_BYTES_EXCEEDED' in sqlerrm)>0
 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'ABORTED_BYTES_QUOTA_BYPASS';end if;
 insert into public.community_entities(entity_id,entity_type) values(v_media,'media_asset');
 insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
 byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values(v_media,v_account,v_keys[1],'image/png',20971520,64,64,
 repeat('a',64),'ready','clear');
 v_final:=public.community_gallery_media_intent_complete_v1(v_auth,v_keys[1],v_media);
 select finalized_at into v_clock from public.community_media_upload_intents
 where storage_key=v_keys[1];
 if v_clock is null or (v_final->>'replayed')::boolean<>false then
   raise exception 'FINALIZE_TIMESTAMP_NOT_SET';end if;
 v_final:=public.community_gallery_media_intent_complete_v1(v_auth,v_keys[1],v_media);
 if (v_final->>'replayed')::boolean<>true or
   (select finalized_at from public.community_media_upload_intents where storage_key=v_keys[1])<>v_clock
 then raise exception 'FINALIZE_REPLAY_RESET_CLOCK';end if;
 if (select reuse_expires_at from public.community_media_upload_intents where storage_key=v_keys[1]) is not null
 then raise exception 'INACTIVE_TTL_ADVERTISED';end if;
 v_bad:=false;
 begin
 update public.community_media_upload_intents
 set finalized_at=v_clock+interval '1 hour' where storage_key=v_keys[1];
 exception when others then
   if position('GALLERY_FINALIZATION_IDENTITY_IMMUTABLE' in sqlerrm)>0
      then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'IMMUTABLE_FINALIZE_TIME_EDITABLE';end if;
 v_bad:=false;
 begin update public.community_media_upload_intents
 set expires_at=expires_at+interval '1 day' where storage_key=v_keys[1];
 exception when others then
   if position('GALLERY_FINALIZATION_IDENTITY_IMMUTABLE' in sqlerrm)>0
      then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'UPLOAD_TOKEN_EXPIRY_RESETTABLE';end if;
 v_pre:=public.community_gallery_media_owner_status_v1(v_auth,v_keys[1]);
 if (v_pre->>'finalizedAt')::timestamptz is distinct from v_clock or
    (v_pre->>'ttlActive')::boolean is distinct from false or
    v_pre->>'reuseExpiresAt' is not null or
    (v_pre->>'reuseEligible')::boolean is distinct from true
 then raise exception 'OWNER_STATUS_TEMPORARY_TRUTH_FALSE';end if;
 v_bad:=false;
 begin perform public.community_gallery_media_owner_status_v1(v_other,v_keys[1]);
 exception when others then
   if position('GALLERY_UPLOAD_FORBIDDEN' in sqlerrm)>0 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'NONOWNER_TEMPORARY_STATUS_EXPOSED';end if;
 v_pub:=public.community_publish_gallery_photo_v1(
   v_auth,v_creator,null,null,'outdoor',v_subject,'Durable quota release',null,
   array[v_media],v_media,true,'gallery-capacity-'||v_nonce);
 if (v_pub->>'created')::boolean is distinct from true then
    raise exception 'DURABLE_PUBLISH_FAILED';end if;
 v_capacity:=private.gallery_media_capacity_snapshot_v1(v_account);
 if (v_capacity->>'reservedBytes')::bigint<>188743680 or
    (v_capacity->>'activeUnboundCount')::int<>8
 then raise exception 'DURABLE_REVISION_QUOTA_RELEASE_FAILED';end if;
 v_pre:=public.community_gallery_media_owner_status_v1(v_auth,v_keys[1]);
 if (v_pre->>'durablyReferenced')::boolean is distinct from true or
    (v_pre->>'temporary')::boolean is distinct from false or
    (v_pre->>'reuseEligible')::boolean is distinct from false
 then raise exception 'DURABLE_STATUS_MISSING';end if;
 v_key:=v_auth::text||'/'||gen_random_uuid()||'.png';
 perform public.community_gallery_media_intent_open_v1(v_auth,v_key,'image/png',20971520);
 v_capacity:=private.gallery_media_capacity_snapshot_v1(v_account);
 if (v_capacity->>'reservedBytes')::bigint<>209715200 then
   raise exception 'RECLAIMED_TEMP_CAPACITY_NOT_REUSABLE';end if;
 v_op:=public.community_gallery_media_capacity_ops_v1();
 if (v_op->>'ttlPhysicalDeletionEnabled')::boolean is distinct from false
  or (v_op->>'workerMaxPerHourlyRun')::int<>20
 then raise exception 'UNSAFE_WORKER_TTL_METRICS';end if;
 if has_function_privilege('anon','public.community_gallery_media_owner_status_v1(uuid,text)','EXECUTE')
  or has_function_privilege('authenticated','public.community_gallery_media_capacity_ops_v1()','EXECUTE')
  or not has_function_privilege('service_role','public.community_gallery_media_owner_status_v1(uuid,text)','EXECUTE')
 then raise exception 'OWNER_STATUS_OPERATOR_ACL_BROKEN';end if;
 raise notice 'GALLERY_IMMUTABLE_FINALIZE_QUOTA_TTL_DISABLED_SQL_PASS';
end $$;
rollback;