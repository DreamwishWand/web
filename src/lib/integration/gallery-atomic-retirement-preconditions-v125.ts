import type {
  GalleryCrossProductSnapshotV1, GallerySnapshotPinV1, GalleryCoverageClassV1
} from './gallery-dependency-coverage-v125.ts';
import { classifyGalleryRetirementGraphV1 } from './gallery-dependency-coverage-v125.ts';

/**
 * 09 INT: Source-audited DB paths and atomic-retirement *preconditions*, not
 * an action, transaction lock or alternative 03 COMM lifecycle service.
 * Nintendo Switch DDV v1.25.0 schema624 / BID52BD625D9B4E0053 ONLY.
 */
export const GALLERY_ATOMIC_RETIREMENT_PRECONDITIONS_V1 =
  'ddv.gallery-atomic-retirement-preconditions@1';

export type GalleryRegistryStatusV1 =
  'VERIFIED'|'VERIFIED_EMPTY'|'REGISTRY_MISSING'|'SEMANTICS_UNKNOWN'|'VERSION_UNSUPPORTED';

export type GalleryRegistryAuditEntryV1 = Readonly<{
  kind: 'scene'|'biome'|'floating_island'|'tom_furniture'|'tom_clothing'|'native_listing';
  sharedPresetSchemaDeployed:boolean;
  sharedPresetPublisherDeployed:boolean;
  sharedPublicationMappingDeployed:boolean;
  publicWorkSearchProjectionDeployed:boolean;
  sourceBackedCompleteGalleryReverseReferences:boolean;
  coverage: GalleryRegistryStatusV1;
  reason:string;
}>;

const preset = (
 kind:GalleryRegistryAuditEntryV1['kind'],reason:string
):GalleryRegistryAuditEntryV1 => Object.freeze({
 kind,sharedPresetSchemaDeployed:true,sharedPresetPublisherDeployed:true,
 sharedPublicationMappingDeployed:true,publicWorkSearchProjectionDeployed:true,
 sourceBackedCompleteGalleryReverseReferences:false,
 coverage:'SEMANTICS_UNKNOWN',reason
});

/** Verified deployment of *shared infrastructure* is not proof that a
 * particular Preset type's full reverse-reference namespace is enumerated.
 * Verified Gallery Subjects are game definitions, NOT publication references.
 */
export const GALLERY_REGISTRY_AUDIT_V125:readonly GalleryRegistryAuditEntryV1[] =
  Object.freeze([
    preset('scene','EXISTING_SCENE_GALLERY_REVISION_AND_ASSOCIATION_FK_PATHS_ARE_PARTIAL'),
    preset('biome','SHARED_PUBLISHER_ACCEPTS_KIND_BUT_REVERSE_LINK_SEMANTICS_UNPROVEN'),
    preset('floating_island','SHARED_PUBLISHER_ACCEPTS_KIND_BUT_REVERSE_LINK_SEMANTICS_UNPROVEN'),
    preset('tom_furniture','TOM_BASE_ITEM_VERIFICATION_IS_NOT_PUBLIC_PRESET_GALLERY_LINKAGE'),
    preset('tom_clothing','TOM_BASE_ITEM_VERIFICATION_IS_NOT_PUBLIC_PRESET_GALLERY_LINKAGE'),
    Object.freeze({
      kind:'native_listing' as const,sharedPresetSchemaDeployed:false,
      sharedPresetPublisherDeployed:false,sharedPublicationMappingDeployed:false,
      publicWorkSearchProjectionDeployed:false,
      sourceBackedCompleteGalleryReverseReferences:false,
      coverage:'REGISTRY_MISSING' as const,
      reason:'NATIVE_WORLD_DECORATION_PRESETS_ARE_LOCAL_SAVE_STATE_NOT_A_DEPLOYED_PUBLIC_LISTING_REGISTRY'
    })
  ]);

/** Sourced existing paths. A record being indexed or saved is *not* a
 * dependent Preset publication and does not transfer creator ownership.
 */
export const GALLERY_PUBLIC_REFERENCE_PATH_AUDIT_V125 = Object.freeze({
  presetRegistry:'public.preset_artifacts -> public.preset_revisions',
  presetPublication:'public.preset_revision_publications -> public.community_work_revisions',
  publishPresetRpc:'public.community_publish_preset_envelope',
  galleryRevisionPreset:'public.gallery_revision_presets',
  presetAssociatedGallery:'public.preset_artifacts.associated_gallery_work_id',
  galleryPublicPublisher:'public.community_publish_gallery_v3 / v4',
  galleryPhotoPublisher:'public.community_publish_gallery_photo_v1',
  discovery:'public.search_documents / public.community_search_public',
  savedReuse:'public.saved_items',
  nativeLocalReader:'src/lib/presets/native-preset-runtime.js',
  sceneProductBridge:'src/lib/wep/preset-community-bridge.ts',
  publicWorkSearchDoesNotProveGraphCompleteness:true,
  savedItemDoesNotConferOwnership:true,
  photoVerifiedSubjectDoesNotProvePublication:true,
  nativeLocalBackupIsNotServerPublicListing:true
} as const);

/** An explicit future write-path proof checklist. Existing per-account
 * idempotency advisory locks are not locks on the Gallery dependency graph.
 */
export const RETIREMENT_SHARED_FENCE_REQUIRED_V1=Object.freeze([
  'community_works Gallery lifecycle/current revision writer',
  'community_work_revisions/gallery_work_revisions new revision writer',
  'gallery_revision_presets insertion before revision seal',
  'preset_artifacts.associated_gallery_work_id insert/update',
  'preset_revision_publications and dependent Preset current-publication writer',
  'public search/detail/Creator/media projection writers',
  'future Biome/Floating Island/ToM/public Native listing dependency writers'
] as const);

export type GalleryAtomicRetirementPreconditionInputV1 = Readonly<{
  snapshot?:GalleryCrossProductSnapshotV1|null;
  pin?:GallerySnapshotPinV1|null;
  gamePlatform:string;
  gameVersion:string;
  buildId:string;
  profileSchema:number;
  /** Real DB transaction with all publisher/edge writers participating, not a frontend lock */
  allReferenceWritersSerializingOnOneGalleryFence:boolean;
  allProductRegistriesClosed:boolean;
  immutabilityAndCurrentPublicationValidated:boolean;
  staleReadRecheckedUnderDbLocks:boolean;
  ownerAndVisibilityRevalidatedUnderDbLocks:boolean;
  issuedUrlsAndCdnPrivacyAccepted:boolean;
  cloudPrivateDurabilityAccepted:boolean;
  serverOwnedAtomicDelistImplemented:boolean;
}>;

export type GalleryAtomicRetirementPreconditionResultV1=Readonly<{
  contract:typeof GALLERY_ATOMIC_RETIREMENT_PRECONDITIONS_V1;
  readOnly:true;
  operationAuthorized:false;
  graphComplete:false;
  blockedReasons:readonly string[];
  missingKinds:readonly string[];
  requiredWriterFences:typeof RETIREMENT_SHARED_FENCE_REQUIRED_V1;
}>;

export function assessGalleryAtomicRetirementPreconditionsV1(
  v:GalleryAtomicRetirementPreconditionInputV1
):GalleryAtomicRetirementPreconditionResultV1{
  const reasons:string[]=[];
  const target=v.gamePlatform==='switch'&&v.gameVersion==='1.25.0'&&
    v.buildId==='52BD625D9B4E0053'&&v.profileSchema===624;
  if(!target)reasons.push('GALLERY_DEPENDENCY_GAME_VERSION_UNSUPPORTED');
  const graph=classifyGalleryRetirementGraphV1(v.snapshot,v.pin);
  if(graph.reason!=='GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED')
    reasons.push(graph.reason);
  if(!v.allProductRegistriesClosed ||
     GALLERY_REGISTRY_AUDIT_V125.some(r=>!r.sourceBackedCompleteGalleryReverseReferences))
    reasons.push('GALLERY_DEPENDENCY_PUBLIC_REGISTRY_NAMESPACE_INCOMPLETE');
  if(!v.allReferenceWritersSerializingOnOneGalleryFence)
    reasons.push('GALLERY_DEPENDENCY_SHARED_WRITER_FENCE_UNPROVEN');
  if(!v.immutabilityAndCurrentPublicationValidated)
    reasons.push('GALLERY_DEPENDENCY_REVISION_PUBLICATION_SEMANTICS_UNPROVEN');
  if(!v.staleReadRecheckedUnderDbLocks)
    reasons.push('GALLERY_DEPENDENCY_FINGERPRINT_NOT_ATOMIC_LOCK');
  if(!v.ownerAndVisibilityRevalidatedUnderDbLocks)
    reasons.push('GALLERY_DEPENDENCY_OWNER_VISIBILITY_LOCK_UNPROVEN');
  if(!v.issuedUrlsAndCdnPrivacyAccepted)
    reasons.push('GALLERY_PREVIOUS_SIGNED_URL_REPLAY_UNPROVEN');
  if(!v.cloudPrivateDurabilityAccepted)
    reasons.push('GALLERY_CLOUD_PRIVATE_DURABILITY_UNVERIFIED');
  if(!v.serverOwnedAtomicDelistImplemented)
    reasons.push('GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED');
  // Never escalate even hypothetical "all green" input into a mutation grant.
  reasons.push('GALLERY_POSITIVE_RETIREMENT_NOT_IMPLEMENTED');
  return Object.freeze({
    contract:GALLERY_ATOMIC_RETIREMENT_PRECONDITIONS_V1,
    readOnly:true,operationAuthorized:false,graphComplete:false,
    blockedReasons:Object.freeze([...new Set(reasons)]),
    missingKinds:Object.freeze(GALLERY_REGISTRY_AUDIT_V125
      .filter(x=>!x.sourceBackedCompleteGalleryReverseReferences).map(x=>x.kind)),
    requiredWriterFences:RETIREMENT_SHARED_FENCE_REQUIRED_V1
  });
}
