-- #116: close PUBLIC historical Cover-only Media token fallback.
-- Owner issuer was already guarded in 20261025000800; public transport
-- must also classify all immutable Gallery Cover references before using
-- the legacy non-Gallery (DreamSnaps) signed Storage URL issuer.
-- No change to positive-public Media predicate, no new permission to delete,
-- retire, unpublish, or backfill missing revision Media membership.
-- 03 COMM #116: service-only PUBLIC Gallery media transport selector.
-- No new Storage bucket, signed token, Gallery publisher, lifecycle status or
-- permission to retire. Existing DreamSnaps serving stays separate.
create or replace function public.community_gallery_media_gateway_v1(
  p_media_id uuid
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare v_gallery_managed boolean:=false;
 v_media jsonb;
begin
 -- Historical revisions remain part of the Gallery security boundary:
 -- do not fall through to the legacy 300-second token issuer when a
 -- Gallery image is no longer the current publicly discoverable revision.
 select exists(
  select 1 from public.work_revision_media rm
  join public.community_work_revisions r on r.revision_id=rm.work_revision_id
  join public.gallery_photo_subjects g on g.work_id=r.work_id
  where rm.media_id=p_media_id
 ) OR EXISTS(
   -- A cover is an authoritative Gallery revision reference even when
   -- the WorkRevision Media membership is absent/inconsistent. It is
   -- never permission to stream unless the positive membership test
   -- below independently succeeds.
   SELECT 1 FROM public.gallery_photo_revision_fields f
   JOIN public.community_work_revisions r ON r.revision_id=f.revision_id
   JOIN public.gallery_photo_subjects g ON g.work_id=r.work_id
   WHERE f.cover_media_id=p_media_id
 ) INTO v_gallery_managed;
 if not v_gallery_managed then
   return jsonb_build_object('galleryManaged',false,'publiclyAccessible',false);
 end if;
 select jsonb_build_object(
    'mediaId',m.media_id,'storageKey',m.storage_key,
    'mimeType',m.mime_type,'byteSize',m.byte_size,
    'width',m.width,'height',m.height,'checksumSha256',m.checksum_sha256)
 into v_media
 from public.work_revision_media rm
 join public.community_work_revisions r on r.revision_id=rm.work_revision_id
 join public.gallery_photo_subjects g on g.work_id=r.work_id
 join public.community_works w on w.work_id=g.work_id
 join public.media_assets m on m.media_id=rm.media_id
 where rm.media_id=p_media_id
   and w.current_published_revision_id=r.revision_id
   and private.is_discoverable_work(w.work_id)
   and m.processing_state='ready' and m.moderation_state='clear'
   and m.purged_at is null
   and m.mime_type in ('image/jpeg','image/png','image/webp')
   and m.byte_size between 1 and 20971520
   and m.width>0 and m.height>0
 order by r.created_at desc limit 1;
 if v_media is null then
    return jsonb_build_object('galleryManaged',true,'publiclyAccessible',false);
 end if;
 return v_media||jsonb_build_object('galleryManaged',true,'publiclyAccessible',true);
end $$;
revoke all on function public.community_gallery_media_gateway_v1(uuid)
 from public,anon,authenticated;
grant execute on function public.community_gallery_media_gateway_v1(uuid)
 to service_role;

