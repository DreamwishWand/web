-- #116 / #119 integrated 03 COMM owner-only preflight projection after 09 INT #123.
-- No new public Gallery RPC or Preset model. All operations stay false.
-- Materialized path: 09 INT read-only graph -> owner-validated Community preflight.
-- This additive migration is intentionally later than 20261025002000.
CREATE OR REPLACE FUNCTION public.community_gallery_retirement_preflight_v1(p_auth_subject uuid, p_gallery_work_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_account uuid;v_work public.community_works%rowtype;
 v_dep jsonb;v_coverage jsonb;v_preservation jsonb;
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
 v_preservation:=private.gallery_cloud_preservation_snapshot_v1(v_work.work_id);
 return jsonb_build_object(
  'contract','ddv.gallery-public-retirement-preflight@1',
  'workId',v_work.work_id,'rowVersion',v_work.row_version,
  'revisionId',v_work.current_published_revision_id,
  'ownerEligible',true,
  'cloudPreservation',v_preservation,
  'lifecycleState',v_work.lifecycle_state,
  'visibility',v_work.visibility,
  'moderationState',v_work.moderation_state,
  'graphComplete',coalesce((v_dep->>'graphComplete')::boolean,false),
  'dependencyCoverage',v_coverage,
  -- 09 INT service-only authoritative graph observability: safe owner diagnostics.
  -- A fingerprint is not a lock, atomic mutation fence, or publish permission.
  'dependencyCoverageContract',v_dep->>'coverageContract',
  'dependencyCoverageClassification',coalesce(v_dep->'coverageClassification','{}'::jsonb),
  'dependencyRelationCoverage',coalesce(v_dep->'relationCoverage','{}'::jsonb),
  'dependencyMissingSources',coalesce(v_dep->'missingDependencySources','[]'::jsonb),
  'dependencyBlockedReasons',coalesce(v_dep->'blockedRetirementReasons','[]'::jsonb),
  'dependencyGraphFingerprintSha256',case
    when coalesce(v_dep->>'graphFingerprintSha256','') ~ '^[0-9a-f]{64}
  'linkedPresetRevisionCount',jsonb_array_length(coalesce(v_dep->'linkedPresetRevisionReferences','[]'::jsonb)),
  'associatedPresetArtifactCount',jsonb_array_length(coalesce(v_dep->'associatedPresetArtifacts','[]'::jsonb)),
  'newPublicGalleryStorageSignedUrlIssued',false,
  'authenticatedOwnerReadMayMintStorageSignedUrl',false,
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
end $function$
;
revoke all on function public.community_gallery_retirement_preflight_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.community_gallery_retirement_preflight_v1(uuid,uuid)
 to service_role;

    then v_dep->>'graphFingerprintSha256' else null end,
  'dependencySnapshotNotAtomicMutationFence',true,
  'dependencySnapshotRowVersion',v_work.row_version,
  'dependencySourceVersionState',v_dep->>'sourceVersionState',
  'dependencyOwnerMismatchEdgeCount',coalesce((v_dep->>'ownerMismatchEdgeCount')::integer,0),
  'dependencyCreatorMismatchEdgeCount',coalesce((v_dep->>'creatorMismatchEdgeCount')::integer,0),
  'linkedPresetRevisionCount',jsonb_array_length(coalesce(v_dep->'linkedPresetRevisionReferences','[]'::jsonb)),
  'associatedPresetArtifactCount',jsonb_array_length(coalesce(v_dep->'associatedPresetArtifacts','[]'::jsonb)),
  'newPublicGalleryStorageSignedUrlIssued',false,
  'authenticatedOwnerReadMayMintStorageSignedUrl',false,
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
end $function$
;
revoke all on function public.community_gallery_retirement_preflight_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.community_gallery_retirement_preflight_v1(uuid,uuid)
 to service_role;
