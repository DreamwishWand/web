-- 03 COMM #124/#116: owner abort cover-only immutable photo Media safety.
-- Existing Media, Account, and owner-scoped RPC; no new tables or positive writes.
-- Abort must not quarantine image media referenced as ONLY a Cover, even if
-- WorkRevisionMedia membership is inconsistent or absent. Claim/Completion
-- already reject these references. Physical Storage deletion remains OFF.
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
     or exists(select 1 from public.gallery_photo_revision_fields where cover_media_id=v_media.media_id)
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

revoke all on function public.community_gallery_media_intent_cancel_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.community_gallery_media_intent_cancel_v1(uuid,text) to service_role;
