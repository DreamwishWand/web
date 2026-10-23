-- SQL-only #124 negative/ACL supplement; no object writes and no permanent fixtures.
begin;
do $$
declare v_auth uuid;v_account uuid;v_other uuid;v_key text;v_media uuid:=gen_random_uuid();
 v_bad boolean;v_subject uuid;
begin
 select ai.provider_subject::uuid,wa.account_id into v_auth,v_account
 from public.wand_accounts wa join public.auth_identities ai
 on ai.account_id=wa.account_id and ai.provider='supabase' and ai.identity_state='active'
 where wa.status='active' order by wa.account_id limit 1;
 select ai.provider_subject::uuid into v_other
 from public.wand_accounts wa join public.auth_identities ai on ai.account_id=wa.account_id
 where ai.provider='supabase' and ai.identity_state='active' and wa.account_id<>v_account limit 1;
 if v_auth is null or v_other is null then raise exception 'ACTOR_FIXTURE_MISSING';end if;
 v_key:=v_auth::text||'/'||gen_random_uuid()||'.png';
 perform public.community_gallery_media_intent_open_v1(v_auth,v_key,'image/png',128);
 v_bad:=false;
 begin
   insert into public.community_entities(entity_id,entity_type) values(v_media,'media_asset');
   insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
   values(v_media,v_account,v_key,'image/jpeg',128,16,16,repeat('b',64),'ready','clear');
 exception when others then
 if position('GALLERY_UPLOAD_BODY_MISMATCH' in sqlerrm)>0 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'MIME_MISMATCH_ACCEPTED';end if;
 v_bad:=false;
 begin
  insert into public.community_entities(entity_id,entity_type) values(v_media,'media_asset');
  insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
  values(v_media,v_account,v_key,'image/png',127,16,16,repeat('b',64),'ready','clear');
 exception when others then
 if position('GALLERY_UPLOAD_BODY_MISMATCH' in sqlerrm)>0 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'SIZE_MISMATCH_ACCEPTED';end if;
 update public.community_media_upload_intents set expires_at=now()-interval '1 minute' where storage_key=v_key;
 v_bad:=false;
 begin
  insert into public.community_entities(entity_id,entity_type) values(v_media,'media_asset');
  insert into public.media_assets(media_id,owner_account_id,storage_key,mime_type,byte_size,width,height,checksum_sha256,processing_state,moderation_state)
  values(v_media,v_account,v_key,'image/png',128,16,16,repeat('b',64),'ready','clear');
 exception when others then
 if position('GALLERY_UPLOAD_EXPIRED_OR_CLOSED' in sqlerrm)>0 then v_bad:=true;else raise;end if;
 end;
 if not v_bad then raise exception 'EXPIRED_UPLOAD_REPLAY_ACCEPTED';end if;
 if has_table_privilege('anon','public.community_media_upload_intents','SELECT')
 or has_table_privilege('authenticated','public.community_media_upload_intents','SELECT')
 or has_function_privilege('anon','public.community_gallery_media_intent_open_v1(uuid,text,text,bigint)','EXECUTE')
 or has_function_privilege('authenticated','public.community_gallery_media_intent_cancel_v1(uuid,text)','EXECUTE')
 or has_function_privilege('anon','public.community_gallery_photo_owned_media_manifest_v1(uuid,uuid[])','EXECUTE')
 or not has_function_privilege('service_role','public.community_gallery_photo_owned_media_manifest_v1(uuid,uuid[])','EXECUTE')
 then raise exception 'MEDIA_INTENT_ACL_BYPASS';end if;
 if (select count(*) from pg_trigger where tgname='community_media_lock_ready_gallery_link' and not tgisinternal)<>1
 or (select count(*) from pg_trigger where tgname='community_media_reject_aborted_gallery_upload' and not tgisinternal)<>1
 then raise exception 'MEDIA_GUARD_TRIGGER_MISSING';end if;
 raise notice 'GALLERY_MEDIA_MIME_SIZE_EXPIRY_RLS_ROLLBACK_PASS';
end $$;
rollback;