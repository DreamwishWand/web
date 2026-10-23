-- 03 COMM #124 SQL-only live-STAGING rollback. No Storage object is forged.
-- Exercise *server RPC and DB concurrency guards*; signed upload + actual Storage.info require authenticated HTTP.
begin;
do $$
declare
 v_auth uuid;v_other uuid;v_owner uuid;v_creator uuid;v_subject uuid;
 v_key text;v_key2 text;v_media uuid:=gen_random_uuid();
 v_response jsonb;v_public jsonb;v_update jsonb;v_work uuid;
 v_row bigint;v_error boolean;v_nonce text:=gen_random_uuid()::text;
 v_account_count int;
begin
 select ai.provider_subject::uuid,wa.account_id,c.creator_profile_id
 into v_auth,v_owner,v_creator
 from public.wand_accounts wa
 join public.auth_identities ai on ai.account_id=wa.account_id
   and ai.provider='supabase' and ai.identity_state='active'
 join public.creator_profiles c on c.owner_account_id=wa.account_id
   and c.moderation_state='clear'
 where wa.status='active'
 order by wa.account_id limit 1;
 select ai.provider_subject::uuid into v_other
 from public.wand_accounts wa join public.auth_identities ai on ai.account_id=wa.account_id
 and ai.provider='supabase' and ai.identity_state='active'
 where wa.status='active' and wa.account_id<>v_owner limit 1;
 if v_auth is null or v_other is null then raise exception 'OWNER_FIXTURES_MISSING';end if;
 select subject_id into v_subject from public.gallery_verified_subjects
 where verification_state='verified' and subject_type='floating_island' order by canonical_target_id limit 1;
 if v_subject is null then raise exception 'AUDITED_ISLAND_SUBJECT_MISSING';end if;

 v_key:=v_auth::text||'/'||gen_random_uuid()||'.png';
 v_response:=public.community_gallery_media_intent_open_v1(v_auth,v_key,'image/png',128);
 if v_response->>'state'<>'pending' then raise exception 'PREPARE_FAILED';end if;
 v_error:=false;
 begin
   perform public.community_gallery_media_intent_probe_v1(v_other,v_key);
 exception when others then
   if position('GALLERY_UPLOAD_FORBIDDEN' in sqlerrm)>0 then v_error:=true;else raise;end if;
 end;
 if not v_error then raise exception 'NONOWNER_PROBE_ACCEPTED';end if;

 v_response:=public.community_gallery_media_intent_cancel_v1(v_auth,v_key);
 if (v_response->>'aborted')::boolean<>true then raise exception 'ABORT_FAILED';end if;
 v_response:=public.community_gallery_media_intent_cancel_v1(v_auth,v_key);
 if (v_response->>'alreadyAborted')::boolean<>true then raise exception 'ABORT_REPLAY_FAILED';end if;
 v_error:=false;
 begin
   insert into public.community_entities(entity_id,entity_type) values(v_media,'media_asset');
   insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
    byte_size,width,height,checksum_sha256,processing_state,moderation_state)
   values(v_media,v_owner,v_key,'image/png',128,64,64,repeat('a',64),'ready','clear');
 exception when others then
   if position('GALLERY_UPLOAD_ABORTED' in sqlerrm)>0 then v_error:=true;else raise;end if;
 end;
 if not v_error then raise exception 'GENERIC_FINALIZE_BYPASSED_ABORT';end if;
 v_error:=false;
 begin perform public.community_gallery_media_intent_cleanup_probe_v1(v_auth,v_key);
 exception when others then
   if position('GALLERY_UPLOAD_CLEANUP_NOT_DUE' in sqlerrm)>0 then v_error:=true;else raise;end if;
 end;
 if not v_error then raise exception 'EARLY_CLEANUP_ACCEPTED';end if;
 update public.community_media_upload_intents
   set expires_at=now()-interval '6 minutes' where storage_key=v_key;
 perform public.community_gallery_media_intent_cleanup_probe_v1(v_auth,v_key);
 perform public.community_gallery_media_intent_cleanup_finish_v1(v_auth,v_key);
 if exists(select 1 from public.community_media_upload_intents where storage_key=v_key)
 then raise exception 'CLEANUP_INTENT_REMAINED';end if;

 v_key2:=v_auth::text||'/'||gen_random_uuid()||'.png';
 perform public.community_gallery_media_intent_open_v1(v_auth,v_key2,'image/png',128);
 v_media:=gen_random_uuid();
 insert into public.community_entities(entity_id,entity_type) values(v_media,'media_asset');
 insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,
    byte_size,width,height,checksum_sha256,processing_state,moderation_state)
 values(v_media,v_owner,v_key2,'image/png',128,64,64,repeat('a',64),'ready','clear');
 v_response:=public.community_gallery_media_intent_complete_v1(v_auth,v_key2,v_media);
 if v_response->>'state'<>'ready' or v_response->>'moderationState'<>'clear' or
 (v_response->>'mediaId')::uuid<>v_media then raise exception 'READY_FINALIZE_INVALID';end if;
 v_response:=public.community_gallery_media_intent_complete_v1(v_auth,v_key2,v_media);
 if (v_response->>'replayed')::boolean<>true then raise exception 'READY_IDEMPOTENCY_FAILED';end if;
 v_error:=false;
 begin
  perform public.community_gallery_media_intent_complete_v1(v_other,v_key2,v_media);
 exception when others then
  if position('GALLERY_UPLOAD_FORBIDDEN' in sqlerrm)>0 then v_error:=true;else raise;end if;
 end;
 if not v_error then raise exception 'NONOWNER_FINALIZE_ACCEPTED';end if;

 select jsonb_array_length(x->'items') into v_account_count
 from (select public.community_gallery_photo_owned_media_manifest_v1(v_auth,array[v_media]) x) t;
 if v_account_count<>1 then raise exception 'OWNED_READY_MANIFEST_FAILED';end if;
 v_error:=false;
 begin perform public.community_gallery_photo_owned_media_manifest_v1(v_other,array[v_media]);
 exception when others then
   if position('GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED' in sqlerrm)>0 then v_error:=true;else raise;end if;
 end;
 if not v_error then raise exception 'NONOWNER_MANIFEST_ACCEPTED';end if;

 v_public:=public.community_publish_gallery_photo_v1(v_auth,v_creator,null,null,
   'outdoor',v_subject,'Owner uploaded photo A',null,array[v_media],v_media,true,v_nonce);
 v_work:=(v_public->>'workId')::uuid;
 if (v_public->>'subjectId')::uuid<>v_subject or (v_public->>'created')::boolean<>true
 or (public.community_get_gallery_photo_public_v1(v_work)->>'subjectId')::uuid<>v_subject
 then raise exception 'PUBLIC_CREATE_WRONG_CANONICAL_SUBJECT';end if;
 v_row:=(v_public->>'rowVersion')::bigint;
 v_response:=public.community_publish_gallery_photo_v1(v_auth,v_creator,null,null,
   'outdoor',v_subject,'Owner uploaded photo A',null,array[v_media],v_media,true,v_nonce);
 if v_public<>v_response then raise exception 'PUBLISH_REPLAY_FAILED';end if;
 v_error:=false;
 begin perform public.community_gallery_media_intent_cancel_v1(v_auth,v_key2);
 exception when others then
 if position('GALLERY_MEDIA_ALREADY_BOUND' in sqlerrm)>0 then v_error:=true;else raise;end if;
 end;
 if not v_error then raise exception 'PUBLISHED_MEDIA_CANCELLATION_ACCEPTED';end if;
 v_update:=public.community_publish_gallery_photo_v1(v_auth,v_creator,v_work,v_row,
   'outdoor',v_subject,'Owner uploaded photo B',null,array[v_media],v_media,true,v_nonce||':update');
 if (v_update->>'revisionId')=(v_public->>'revisionId')
 or (public.community_get_gallery_photo_public_v1(v_work)->>'title')<>'Owner uploaded photo B'
 then raise exception 'IMMUTABLE_UPDATE_INVALID';end if;
 v_error:=false;
 begin perform public.community_publish_gallery_photo_v1(v_auth,v_creator,v_work,v_row,
   'outdoor',v_subject,'Stale update',null,array[v_media],v_media,true,v_nonce||':stale');
 exception when others then
 if position('GALLERY_ROW_VERSION_CONFLICT' in sqlerrm)>0 then v_error:=true;else raise;end if;
 end;
 if not v_error then raise exception 'STALE_UPDATE_ACCEPTED';end if;
 if (select title from public.gallery_work_revisions
 where revision_id=(v_public->>'revisionId')::uuid)<>'Owner uploaded photo A' then
 raise exception 'ORIGINAL_REVISION_CHANGED';end if;
 raise notice 'GALLERY_OWNER_MEDIA_PUBLIC_CREATE_UPDATE_ROLLBACK_PASS';
end $$;
rollback;