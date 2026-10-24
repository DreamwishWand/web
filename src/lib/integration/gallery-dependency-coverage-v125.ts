/**
 * 09 INT → 03 COMM and 04 QR, source-backed read-only graph coverage contract.
 * Supports the original snapshot contract consumed by PR #129 owner preflight.
 * No client mutation authority and no alternative Gallery publisher.
 */
export const GALLERY_DEPENDENCY_COVERAGE_CONTRACT_V1='ddv.gallery-cross-product-coverage@1';
export const GALLERY_SOURCE_VERSION_V125=Object.freeze({
 platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624
});
export const GALLERY_COVERAGE_CLASSIFICATIONS=Object.freeze([
 'VERIFIED','VERIFIED_EMPTY','REGISTRY_MISSING','SEMANTICS_UNKNOWN','VERSION_UNSUPPORTED'
] as const);
export type GalleryCoverageClassV1=typeof GALLERY_COVERAGE_CLASSIFICATIONS[number];
export type GalleryGraphRevisionV1=Readonly<{
 workRevisionId:string;revisionNumber:number;sealed:boolean;current:boolean;
}>;
export type GalleryLinkedPresetReferenceV1=Readonly<{
 kind:'scene'|'biome'|'floating_island'|'tom_furniture'|'tom_clothing';
 galleryRevisionId:string;presetRevisionId:string;presetArtifactId:string;
 currentGalleryRevision:boolean;dependentCurrentPublished:boolean;
 presetWorkId:string|null;ownerAccountId:string;creatorProfileId:string;
 ownerMatchesGallery:boolean;creatorMatchesGallery:boolean;
 state:'public_active'|'historical_reference';
}>;
export type GalleryAssociatedPresetArtifactV1=Readonly<{
 kind:GalleryLinkedPresetReferenceV1['kind'];
 presetArtifactId:string;presetWorkId:string|null;
 ownerAccountId:string;creatorProfileId:string;
 ownerMatchesGallery:boolean;creatorMatchesGallery:boolean;
 state:'public_active'|'private_retained';
}>;
export type GalleryCrossProductSnapshotV1=Readonly<{
 contract:'ddv.gallery-public-dependency-retirement@1';
 coverageContract:'ddv.gallery-cross-product-coverage@1';
 galleryWorkId:string;galleryCurrentRevisionId:string|null;
 galleryOwnerAccountId:string;galleryCreatorProfileId:string;
 galleryRowVersion:number;graphFingerprintSha256:string;
 snapshotNotAnAtomicMutationFence:true;
 sourceVersionState:GalleryCoverageClassV1;
 workRevisions:readonly GalleryGraphRevisionV1[];
 workRevisionCount:number;currentRevisionExists:boolean;
 linkedPresetRevisionReferences:readonly GalleryLinkedPresetReferenceV1[];
 associatedPresetArtifacts:readonly GalleryAssociatedPresetArtifactV1[];
 activeCurrentGalleryPresetRevisionLinks:number;
 ownerMismatchEdgeCount:number;creatorMismatchEdgeCount:number;
 relationCoverage:Readonly<Record<string,GalleryCoverageClassV1|string>>;
 coverageClassification:Readonly<Record<
 'scene'|'biome'|'floating_island'|'tom_furniture'|'tom_clothing'|'native_listing',
 GalleryCoverageClassV1>>;
 coverage:Readonly<Record<string,string>>;
 missingDependencySources:readonly string[];
 blockedRetirementReasons:readonly string[];
 graphComplete:false;retirementAuthorized:false;issuedSignedUrlRevocationProven:false;
}>;
export type GallerySnapshotPinV1=Readonly<{
 galleryWorkId:string;ownerAccountId:string;
 currentPublishedRevisionId:string|null;rowVersion:number;
 graphFingerprintSha256:string;
}>;
export type GallerySafeRetirementGraphV1=Readonly<{
 authorized:false;readOnly:true;
 reason:
 'GALLERY_DEPENDENCY_SNAPSHOT_UNAVAILABLE'|
 'GALLERY_DEPENDENCY_SNAPSHOT_CHANGED'|
 'GALLERY_DEPENDENCY_VERSION_UNSUPPORTED'|
 'GALLERY_RETIREMENT_CURRENT_REVISION_UNVERIFIED'|
 'GALLERY_DEPENDENCY_OWNER_MISMATCH'|
 'GALLERY_DEPENDENCY_COVERAGE_UNKNOWN'|
 'GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED'|
 'GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED';
 graphComplete:false;missing:readonly string[];
 knownPublicDependents:number;
}>;
const block=(reason:GallerySafeRetirementGraphV1['reason'],missing:string[]=[],knownPublicDependents=0):
 GallerySafeRetirementGraphV1=>Object.freeze({authorized:false,readOnly:true,reason,
 graphComplete:false,missing,knownPublicDependents});
const sha64=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
export function classifyGalleryRetirementGraphV1(
 snapshot:GalleryCrossProductSnapshotV1|null|undefined,
 pin:GallerySnapshotPinV1|null|undefined
):GallerySafeRetirementGraphV1 {
 if(!snapshot||!pin||
  snapshot.contract!=='ddv.gallery-public-dependency-retirement@1'||
  snapshot.coverageContract!==GALLERY_DEPENDENCY_COVERAGE_CONTRACT_V1||
  !sha64(snapshot.graphFingerprintSha256)||
  !Array.isArray(snapshot.linkedPresetRevisionReferences)||
  !Array.isArray(snapshot.associatedPresetArtifacts)||
  !Array.isArray(snapshot.workRevisions)||
  !snapshot.coverageClassification||
  !snapshot.relationCoverage||
  snapshot.graphComplete!==false||snapshot.retirementAuthorized!==false||
  snapshot.issuedSignedUrlRevocationProven!==false)
   return block('GALLERY_DEPENDENCY_SNAPSHOT_UNAVAILABLE');
 const publicCount=snapshot.linkedPresetRevisionReferences.filter(r=>
   r.state==='public_active'||r.dependentCurrentPublished===true).length+
   snapshot.associatedPresetArtifacts.filter(r=>r.state==='public_active').length;
 if(snapshot.galleryWorkId!==pin.galleryWorkId||
    snapshot.galleryOwnerAccountId!==pin.ownerAccountId||
    snapshot.galleryCurrentRevisionId!==pin.currentPublishedRevisionId||
    snapshot.galleryRowVersion!==pin.rowVersion||
    snapshot.graphFingerprintSha256!==pin.graphFingerprintSha256)
  return block('GALLERY_DEPENDENCY_SNAPSHOT_CHANGED',[],publicCount);
 if(snapshot.sourceVersionState!=='VERIFIED')
  return block('GALLERY_DEPENDENCY_VERSION_UNSUPPORTED',[],publicCount);
 if(!snapshot.currentRevisionExists||!snapshot.galleryCurrentRevisionId||
    snapshot.workRevisions.filter(r=>r.current).length!==1||
    snapshot.workRevisions.some(r=>!r.sealed))
  return block('GALLERY_RETIREMENT_CURRENT_REVISION_UNVERIFIED',[],publicCount);
 if(snapshot.ownerMismatchEdgeCount!==0||snapshot.creatorMismatchEdgeCount!==0||
    snapshot.linkedPresetRevisionReferences.some(r=>r.ownerMatchesGallery!==true)||
    snapshot.associatedPresetArtifacts.some(r=>r.ownerMatchesGallery!==true))
  return block('GALLERY_DEPENDENCY_OWNER_MISMATCH',[],publicCount);
 const missing=Object.entries(snapshot.coverageClassification)
  .filter(([,v])=>v!=='VERIFIED'&&v!=='VERIFIED_EMPTY')
  .map(([kind,v])=>kind+':'+v);
 if(missing.length||snapshot.missingDependencySources.length)
  return block('GALLERY_DEPENDENCY_COVERAGE_UNKNOWN',
    missing.concat(snapshot.missingDependencySources),publicCount);
 if(publicCount)return block('GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED',[],publicCount);
 // Hypothetical full graph is still NOT a server-side atomic delisting.
 return block('GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED',[],0);
}
export const GALLERY_GRAPH_03_COMM_HANDOFF_V1=Object.freeze({
 existingOwnerPreflight:'community-query/galleryRetirementPreflight',
 privateServiceSnapshot:'private.gallery_photo_dependency_snapshot_v1',
 cloudStructuralPreservationOwner:'03 COMM / gallery_cloud_preservation_snapshot_v1',
 graphCoverageOwner:'09 INT',
 expectsSnapshotFingerprintBeforeAtomicTransaction:true,
 fingerprintAloneDoesNotLockOrPreventConcurrentWriters:true,
 missingNativeListingRegistry:'REGISTRY_MISSING',
 typedPresetRegistrySupportsFiveKindsButNonSceneSemantics:'SEMANTICS_UNKNOWN',
 gallerySubjectDefinitionsNotPublishedWorks:true,
 deleteAuthorized:false,unpublishAuthorized:false,
 persistentWriteAuthorized:false,productApplyAuthorized:false
} as const);
