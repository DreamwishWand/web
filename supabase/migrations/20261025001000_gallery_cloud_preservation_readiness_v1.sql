-- #116 additive read-only preservation/entitlement/restore preflight.
-- Product: Free manages PUBLIC Works; Cloud PRIVATE requires a real verified
-- entitlement source, which does not yet exist in this staging deployment.
-- No entitlement flag or subscription/payment truth is fabricated.

-- #116: observe EXISTING immutable Work/Media rows; no invented entitlement,
-- new media service, publication mutation, retention timer or cloud claim.
-- Only the owner-validated service-only retirement preflight invokes this.
create or replace function private.gallery_cloud_preservation_snapshot_v1(p_work_id uuid)
returns jsonb language plpgsql stable
set search_path=pg_catalog,public,private as $$
declare
 v_work public.community_works%rowtype;
 v_revisions bigint:=0;v_sealed bigint:=0;v_historical bigint:=0;
 v_current_present boolean:=false;v_current_sealed boolean:=false;
 v_cover_refs bigint:=0;v_cover_unbound bigint:=0;
 v_media_refs bigint:=0;v_unique_media bigint:=0;v_invalid_media bigint:=0;
 v_creator_match boolean:=false;
begin
 select * into v_work from public.community_works w
 where w.work_id=p_work_id and w.work_type='gallery'
   and exists(select 1 from public.gallery_photo_subjects s where s.work_id=w.work_id);
 if v_work.work_id is null then raise exception 'GALLERY_CLOUD_SNAPSHOT_NOT_GALLERY'; end if;
 select count(*),count(*) filter(where r.sealed_at is not null),
   count(*) filter(where r.revision_id is distinct from v_work.current_published_revision_id),
   coalesce(bool_or(r.revision_id=v_work.current_published_revision_id),false),
   coalesce(bool_or(r.revision_id=v_work.current_published_revision_id and r.sealed_at is not null),false)
 into v_revisions,v_sealed,v_historical,v_current_present,v_current_sealed
 from public.community_work_revisions r where r.work_id=p_work_id;
 select count(*),count(*) filter(where rm.media_id is null)
 into v_cover_refs,v_cover_unbound
 from public.gallery_photo_revision_fields f
 join public.community_work_revisions r on r.revision_id=f.revision_id
 left join public.work_revision_media rm
   on rm.work_revision_id=f.revision_id and rm.media_id=f.cover_media_id
 where r.work_id=p_work_id;
 with refs as (
   select rm.media_id from public.work_revision_media rm
   join public.community_work_revisions r on r.revision_id=rm.work_revision_id
   where r.work_id=p_work_id
   union all
   select f.cover_media_id from public.gallery_photo_revision_fields f
   join public.community_work_revisions r on r.revision_id=f.revision_id
   where r.work_id=p_work_id
 ), distinct_refs as (
   select distinct media_id from refs
 )
 select (select count(*) from refs),
        count(*),
        count(*) filter(where m.media_id is null
            or m.owner_account_id is distinct from v_work.owner_account_id
            or m.processing_state<>'ready'
            or m.moderation_state<>'clear'
            or m.purged_at is not null
            or m.mime_type not in ('image/jpeg','image/png','image/webp')
            or m.byte_size not between 1 and 20971520
            or m.width is null or m.width<=0 or m.height is null or m.height<=0
            or m.checksum_sha256 !~ '^[0-9a-fA-F]{64}$')
 into v_media_refs,v_unique_media,v_invalid_media
 from distinct_refs d left join public.media_assets m on m.media_id=d.media_id;
 select exists(select 1 from public.creator_profiles c
   where c.creator_profile_id=v_work.creator_profile_id
     and c.owner_account_id=v_work.owner_account_id
     and c.moderation_state='clear')
 into v_creator_match;
 return jsonb_build_object(
  'contract','ddv.gallery-cloud-preservation-readiness@1',
  'entitlement',jsonb_build_object(
    'source','not_configured','state','unverified',
    'verified',false,'active',false,'providerEvidencePresent',false),
  'ownerAccountResolved',true,
  'creatorOwnershipAndModerationValid',v_creator_match,
  'databaseManifest',jsonb_build_object(
    'workRowFound',true,
    'currentRevisionId',v_work.current_published_revision_id,
    'currentRevisionPresent',v_current_present,
    'currentRevisionSealed',v_current_sealed,
    'revisionRowCount',v_revisions,
    'historicalRevisionRowCount',v_historical,
    'sealedRevisionRowCount',v_sealed,
    'coverReferenceCount',v_cover_refs,
    'coverWithoutCompositionCount',v_cover_unbound,
    'mediaReferenceCount',v_media_refs,
    'distinctMediaCount',v_unique_media,
    'invalidOrNonOwnedMediaCount',v_invalid_media,
    'structuralIntegrityObserved',
      v_current_present and v_current_sealed and v_revisions=v_sealed
      and v_cover_refs>0 and v_cover_unbound=0 and v_invalid_media=0
      and v_creator_match),
  'storageObjectByteReadbackVerified',false,
  'cloudPrivateStorageAclVerified',false,
  'cloudBackupAndRestoreVerified',false,
  'cloudEntitlementVerified',false,
  'dependencyGraphCoverageVerified',false,
  'signedUrlAndCacheRevocationProven',false,
  'privateSaveAuthorized',false,
  'privateDetailAuthorized',false,
  'restoreAuthorized',false,
  'republishAuthorized',false,
  'blockedReasons',jsonb_build_array(
    'GALLERY_CLOUD_ENTITLEMENT_SOURCE_NOT_CONFIGURED',
    'GALLERY_CLOUD_PRIVATE_MEDIA_DURABILITY_UNVERIFIED',
    'GALLERY_PRIVATE_MEDIA_ACL_NOT_ACCEPTED',
    'GALLERY_CLOUD_BACKUP_RESTORE_NOT_ACCEPTED',
    'GALLERY_DEPENDENCY_GRAPH_INCOMPLETE',
    'GALLERY_PREVIOUS_SIGNED_URL_REPLAY_UNPROVEN')
 );
end $$;
revoke all on function private.gallery_cloud_preservation_snapshot_v1(uuid)
 from public,anon,authenticated;
-- Service boundary is retained in existing authenticated community-query
-- which calls public.community_gallery_retirement_preflight_v1 only.

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
