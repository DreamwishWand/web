-- #124: protect existing account-level moderation/security/legal holds even
-- for the pre-existing user-abort cleanup path. No 72h finalized delete.
-- Same RPC signatures; server-only owner auth and leases retained.
CREATE OR REPLACE FUNCTION public.community_gallery_media_intent_cancel_v1(p_auth_subject uuid, p_storage_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_account uuid;v_intent public.community_media_upload_intents%rowtype;
 v_media public.media_assets%rowtype;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_intent from public.community_media_upload_intents
 where storage_key=p_storage_key and owner_account_id=v_account and auth_subject=p_auth_subject
 for update;
 if v_intent.storage_key is null then raise exception 'GALLERY_UPLOAD_FORBIDDEN'; end if;
 if v_intent.state='aborted' then
   return jsonb_build_object('aborted',true,'alreadyAborted',true,
     'cleanupEligibleAt',v_intent.expires_at+interval '5 minutes');
 end if;
 if exists(select 1 from private.account_retention_holds h
 where h.account_id=v_intent.owner_account_id and h.released_at is null
 and (h.expires_at is null or h.expires_at>now())) then raise exception 'GALLERY_UPLOAD_RETENTION_HOLD';end if;
 if v_intent.media_id is not null or exists(select 1 from public.media_assets where storage_key=p_storage_key) then
   select * into v_media from public.media_assets
   where storage_key=p_storage_key and owner_account_id=v_account for update;
   if v_media.media_id is null then raise exception 'GALLERY_MEDIA_NOT_FOUND'; end if;
   if exists(select 1 from public.work_revision_media where media_id=v_media.media_id)
     or exists(select 1 from public.creator_profiles where avatar_media_id=v_media.media_id) then
       raise exception 'GALLERY_MEDIA_ALREADY_BOUND';
   end if;
   -- Publisher must lock READY Media FOR SHARE in same transaction (see guard below).
   update public.media_assets set processing_state='quarantined'
   where media_id=v_media.media_id;
 end if;
 update public.community_media_upload_intents
 set state='aborted',aborted_at=now(),updated_at=now()
 where storage_key=p_storage_key;
 return jsonb_build_object('aborted',true,'alreadyAborted',false,
   'cleanupEligibleAt',v_intent.expires_at+interval '5 minutes');
end $function$
;
CREATE OR REPLACE FUNCTION public.community_claim_gallery_media_orphans_v1(p_limit integer, p_lock_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_intent public.community_media_upload_intents%rowtype;
  v_media public.media_assets%rowtype;v_jobs jsonb:='[]'::jsonb;v_count int:=0;
begin
 if p_lock_token is null or p_limit is null or p_limit not between 1 and 25
 then raise exception 'GALLERY_CLEANUP_CLAIM_INVALID';end if;
 for v_intent in
 select * from public.community_media_upload_intents i
 where i.state in ('pending','aborted')
 and i.expires_at+interval '5 minutes'<=now()
 and i.cleanup_retry_at<=now()
 and (i.cleanup_lease_until is null or i.cleanup_lease_until<=now())
 order by i.expires_at,i.storage_key
 for update skip locked limit p_limit
 loop
   if exists(select 1 from private.account_retention_holds h
 where h.account_id=v_intent.owner_account_id and h.released_at is null
 and (h.expires_at is null or h.expires_at>now())) then
      update public.community_media_upload_intents
      set cleanup_last_error='ACCOUNT_RETENTION_HOLD',
          cleanup_retry_at=now()+interval '1 hour',updated_at=now()
      where storage_key=v_intent.storage_key;
      continue;
   end if;
   select * into v_media from public.media_assets
   where storage_key=v_intent.storage_key for update;
   if v_media.media_id is not null and
      (v_media.owner_account_id<>v_intent.owner_account_id or
       exists(select 1 from public.work_revision_media where media_id=v_media.media_id) or
       exists(select 1 from public.gallery_photo_revision_fields where cover_media_id=v_media.media_id) or
       exists(select 1 from public.creator_profiles where avatar_media_id=v_media.media_id))
   then
     -- Conflicting owner or any reference must NEVER be deleted.
     -- An owner-matched, referenced upload is preserved; a foreign-owned
     -- key is permanently deferred for operator review.
     if v_media.owner_account_id=v_intent.owner_account_id then
       update public.community_media_upload_intents
       set state='finalized',media_id=v_media.media_id,aborted_at=null,
           cleanup_lease_token=null,cleanup_lease_until=null,
           cleanup_last_error='PRESERVED_REFERENCED_MEDIA',updated_at=now()
       where storage_key=v_intent.storage_key;
     else
       update public.community_media_upload_intents
       set cleanup_retry_at=now()+interval '365 days',
           cleanup_last_error='OWNER_CONFLICT_OPERATOR_REVIEW',
           cleanup_lease_token=null,cleanup_lease_until=null,updated_at=now()
       where storage_key=v_intent.storage_key;
     end if;
     insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
     values(v_intent.owner_account_id,'gallery_media_orphan_preserved',v_media.media_id,
       jsonb_build_object('reason',case when v_media.owner_account_id<>v_intent.owner_account_id
         then 'OWNER_CONFLICT' else 'REFERENCED' end));
     continue;
   end if;
   if v_media.media_id is not null then
     update public.media_assets set processing_state='quarantined'
     where media_id=v_media.media_id;
   end if;
   update public.community_media_upload_intents
    set state='aborted',aborted_at=coalesce(aborted_at,now()),
       cleanup_lease_token=p_lock_token,cleanup_lease_until=now()+interval '10 minutes',
       cleanup_attempt_count=cleanup_attempt_count+1,
       cleanup_last_attempt_at=now(),cleanup_last_error=null,
       updated_at=now()
    where storage_key=v_intent.storage_key;
   v_jobs:=v_jobs||jsonb_build_array(jsonb_build_object(
      'storageKey',v_intent.storage_key,'mediaId',v_media.media_id,
      'attempt',v_intent.cleanup_attempt_count+1));
   v_count:=v_count+1;
 end loop;
 return jsonb_build_object('jobs',v_jobs,'claimed',v_count);
end $function$
;
CREATE OR REPLACE FUNCTION public.community_complete_gallery_media_orphan_v1(p_storage_key text, p_lock_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_intent public.community_media_upload_intents%rowtype;
  v_media public.media_assets%rowtype;
begin
 select * into v_intent from public.community_media_upload_intents
 where storage_key=p_storage_key for update;
 if v_intent.storage_key is null or v_intent.state<>'aborted'
 or v_intent.cleanup_lease_token is distinct from p_lock_token
 or v_intent.cleanup_lease_until<=now()
 then raise exception 'GALLERY_CLEANUP_LEASE_INVALID';end if;
 if exists(select 1 from private.account_retention_holds h
 where h.account_id=v_intent.owner_account_id and h.released_at is null
 and (h.expires_at is null or h.expires_at>now())) then raise exception 'GALLERY_UPLOAD_RETENTION_HOLD';end if;
 select * into v_media from public.media_assets
 where storage_key=p_storage_key for update;
 if v_media.media_id is not null then
   if v_media.owner_account_id<>v_intent.owner_account_id
   or v_media.processing_state<>'quarantined'
   or exists(select 1 from public.work_revision_media where media_id=v_media.media_id)
   or exists(select 1 from public.gallery_photo_revision_fields where cover_media_id=v_media.media_id)
   or exists(select 1 from public.creator_profiles where avatar_media_id=v_media.media_id)
   then raise exception 'GALLERY_CLEANUP_MEDIA_REFERENCED_OR_FOREIGN';end if;
   delete from public.media_assets where media_id=v_media.media_id;
   delete from public.community_entities where entity_id=v_media.media_id;
 end if;
 -- Audit success before intent deletion; any DB fault rolls all back.
 insert into public.audit_events(actor_account_id,action_type,target_entity_id,metadata)
 values(v_intent.owner_account_id,'gallery_media_orphan_cleaned',v_media.media_id,
  jsonb_build_object('attempts',v_intent.cleanup_attempt_count,
     'mediaPresent',v_media.media_id is not null));
 delete from public.community_media_upload_intents where storage_key=p_storage_key;
 return jsonb_build_object('cleaned',true,'storageKey',p_storage_key);
end $function$
; 
-- Preserve existing service-only privileges after CREATE OR REPLACE.
revoke all on function public.community_gallery_media_intent_cancel_v1(uuid,text) from public,anon,authenticated;
revoke all on function public.community_claim_gallery_media_orphans_v1(integer,uuid) from public,anon,authenticated;
revoke all on function public.community_complete_gallery_media_orphan_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.community_gallery_media_intent_cancel_v1(uuid,text) to service_role;
grant execute on function public.community_claim_gallery_media_orphans_v1(integer,uuid) to service_role;
grant execute on function public.community_complete_gallery_media_orphan_v1(text,uuid) to service_role;
