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
 ) into v_gallery_managed;
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

-- Owner-facing *read-only* preflight. 09 INT remains the sole authority for
-- link graph semantics: consume its existing service-only snapshot, never
-- replace 'unknown_not_deployed' with a fabricated empty set.
create or replace function public.community_gallery_retirement_preflight_v1(
 p_auth_subject uuid,p_gallery_work_id uuid
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare v_account uuid;v_work public.community_works%rowtype;
 v_dep jsonb;v_coverage jsonb;
begin
 v_account:=private.resolve_active_account(p_auth_subject);
 select * into v_work from public.community_works w
 where w.work_id=p_gallery_work_id and w.owner_account_id=v_account
 and w.work_type='gallery' and exists(
   select 1 from public.gallery_photo_subjects g where g.work_id=w.work_id
 );
 if v_work.work_id is null then raise exception 'GALLERY_RETIREMENT_NOT_OWNER'; end if;
 v_dep:=private.gallery_photo_dependency_snapshot_v1(p_gallery_work_id);
 v_coverage:=coalesce(v_dep->'coverage','{}'::jsonb);
 return jsonb_build_object(
  'contract','ddv.gallery-public-retirement-preflight@1',
  'workId',v_work.work_id,'rowVersion',v_work.row_version,
  'revisionId',v_work.current_published_revision_id,
  'ownerEligible',true,
  'lifecycleState',v_work.lifecycle_state,
  'visibility',v_work.visibility,
  'moderationState',v_work.moderation_state,
  'graphComplete',coalesce((v_dep->>'graphComplete')::boolean,false),
  'dependencyCoverage',v_coverage,
  'linkedPresetRevisionCount',jsonb_array_length(coalesce(v_dep->'linkedPresetRevisionReferences','[]'::jsonb)),
  'associatedPresetArtifactCount',jsonb_array_length(coalesce(v_dep->'associatedPresetArtifacts','[]'::jsonb)),
  'newGallerySignedStorageUrlIssued',false,
  'galleryNewTransport','per_request_authorized_edge_proxy',
  'historicallyIssuedStorageSignedUrlMaxSeconds',300,
  'previousSignedUrlsRevoked',false,
  'cdnAndBrowserPurgeProven',false,
  'cloudEntitlementVerified',false,
  'cloudPrivateStorageVerified',false,
  'cloudOwnerRestoreVerified',false,
  'operationAuthorized',false,
  'deleteAuthorized',false,
  'unpublishKeepPrivateAuthorized',false,
  'retryEligible',false,
  'blockedReasons',jsonb_build_array(
    'GALLERY_DEPENDENCY_GRAPH_INCOMPLETE',
    'GALLERY_PREVIOUS_SIGNED_URL_REPLAY_UNPROVEN',
    'GALLERY_CDN_BROWSER_CACHE_REVOCATION_UNPROVEN',
    'GALLERY_CLOUD_ENTITLEMENT_UNVERIFIED',
    'GALLERY_PRIVATE_DURABILITY_UNVERIFIED')
 );
end $$;
revoke all on function public.community_gallery_retirement_preflight_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.community_gallery_retirement_preflight_v1(uuid,uuid)
 to service_role;
