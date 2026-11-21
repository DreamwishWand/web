-- Supersede the owner preflight proof after auditing the EXISTING authenticated
-- community-media action 'read' (which still issues 300s signed Storage URLs).
-- Until that separate owner-reader is redesigned, DO NOT claim universal issuance halt.
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
  'newPublicGalleryStorageSignedUrlIssued',false,
  'authenticatedOwnerReadMayMintStorageSignedUrl',true,
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
    'GALLERY_AUTHENTICATED_MEDIA_READ_STILL_MINTS_SIGNED_URL',
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
