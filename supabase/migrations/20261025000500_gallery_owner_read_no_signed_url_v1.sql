-- #116: authoritatively classifies Gallery owner-upload and historical
-- Gallery Photo Media before legacy community-media.read may sign Storage URLs.
-- Existing non-Gallery/DreamSnaps signed reader remains untouched.
create or replace function public.community_gallery_owner_media_read_v1(
 p_auth_subject uuid,p_media_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;v_media public.media_assets%rowtype;
 v_gallery boolean:=false;v_valid_intent boolean:=false;v_photo_bound boolean:=false;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_media from public.media_assets where media_id=p_media_id;
 if v_media.media_id is null then
   return jsonb_build_object('galleryManaged',false,'ownerAuthorized',false);
 end if;
 select exists(select 1 from public.community_media_upload_intents i
   where i.media_id=p_media_id or i.storage_key=v_media.storage_key),
 exists(select 1 from public.community_media_upload_intents i
   where i.media_id=p_media_id and i.storage_key=v_media.storage_key
     and i.owner_account_id=v_media.owner_account_id and i.state='finalized'),
 exists(select 1 from public.work_revision_media rm
   join public.community_work_revisions r on r.revision_id=rm.work_revision_id
   join public.gallery_photo_subjects g on g.work_id=r.work_id
   where rm.media_id=p_media_id)
 into v_gallery,v_valid_intent,v_photo_bound;
 v_gallery:=v_gallery or v_photo_bound;
 if not v_gallery then
   return jsonb_build_object('galleryManaged',false,'ownerAuthorized',false);
 end if;
 if v_media.owner_account_id is distinct from v_account
    or v_media.processing_state<>'ready'
    or v_media.moderation_state<>'clear'
    or v_media.purged_at is not null
    or v_media.mime_type not in ('image/jpeg','image/png','image/webp')
    or v_media.byte_size not between 1 and 20971520
    or v_media.width<=0 or v_media.height<=0
    or not (v_valid_intent or v_photo_bound)
 then
   return jsonb_build_object('galleryManaged',true,'ownerAuthorized',false);
 end if;
 return jsonb_build_object('galleryManaged',true,'ownerAuthorized',true,
   'mediaId',v_media.media_id,'storageKey',v_media.storage_key,
   'mimeType',v_media.mime_type,'byteSize',v_media.byte_size,
   'width',v_media.width,'height',v_media.height,
   'checksumSha256',v_media.checksum_sha256,
   'transport','authenticated_edge_binary_post',
   'signedStorageUrlIssued',false);
end $$;
revoke all on function public.community_gallery_owner_media_read_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.community_gallery_owner_media_read_v1(uuid,uuid)
 to service_role;
