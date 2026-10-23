/**
 * 09 INT Gallery retirement planning. This is an authorization NEGATIVE GATE,
 * not an alternate 03 COMM command implementation.
 *
 * A declared absence of an API/table is UNKNOWN, never zero dependents.
 * SavedItems do not transfer ownership. Historical revision citations do not
 * imply ownership or automatic deletion of a private master.
 */
export const GALLERY_RETIREMENT_CONTRACT='ddv.gallery-public-dependency-retirement@1';
export const DEPENDENCY_KINDS=Object.freeze([
  'scene','biome','floating_island','tom_furniture','tom_clothing','native_listing'
]);
export const PUBLIC_PROJECTION_SURFACES=Object.freeze([
  'public_discovery','public_detail','creator_profile','saved_library',
  'direct_url','linked_preset_listing','public_media_authorization','search_index'
]);
export type GalleryDependencyEdgeV1 = {
  kind:string;galleryWorkId:string;ownerAccountId:string;dependentId:string;
  state:'public_active'|'private_retained'|'historical_reference';
};
export type GalleryRetirementInputV1 = {
  galleryWorkId?:string;
  ownerAccountId?:string;
  mode?:'delete'|'unpublish_keep_private';
  dependencies?:GalleryDependencyEdgeV1[];
  coverage?:Record<string,string>;
  revisionPin?:{galleryWorkId:string;ownerAccountId:string;currentPublishedRevisionId:string}|null;
  cloudPreservation?:{
    provider:string;durablyStored?:boolean;aclVerified?:boolean;restoreVerified?:boolean;
    ownerAccountId?:string;galleryWorkId?:string;
  }|null;
  issuedMediaRevocation?:{
    alreadyIssuedUrlsRevoked?:boolean;verifiedForWorkId?:string;verifiedRevisionId?:string;
    newIssuanceDenied?:boolean;
  }|null;
};
const fail=(code:string,extra:Record<string,unknown>={})=>Object.freeze({
  ok:false,retirementAuthorized:false,code,...extra
});
export function planGalleryRetirement({
  galleryWorkId,ownerAccountId,mode,dependencies,coverage,
  cloudPreservation=null,issuedMediaRevocation=null,revisionPin=null
}:GalleryRetirementInputV1={}){
  if(!galleryWorkId||!ownerAccountId||(mode!=='delete'&&mode!=='unpublish_keep_private'))
    return fail('GALLERY_RETIREMENT_INPUT_INVALID');
  if(!Array.isArray(dependencies)||!coverage||typeof coverage!=='object')
    return fail('GALLERY_DEPENDENCY_SNAPSHOT_UNAVAILABLE');
  const missing=DEPENDENCY_KINDS.filter(k=>coverage[k]!=='complete');
  if(missing.length)return fail('GALLERY_DEPENDENCY_COVERAGE_UNKNOWN',{missing});
  if(!revisionPin||revisionPin.galleryWorkId!==galleryWorkId ||
      !revisionPin.currentPublishedRevisionId||revisionPin.ownerAccountId!==ownerAccountId)
    return fail('GALLERY_RETIREMENT_REVISION_PIN_INVALID');
  for(const edge of dependencies){
    if(!edge||!DEPENDENCY_KINDS.includes(edge.kind) ||
      edge.galleryWorkId!==galleryWorkId ||
      edge.ownerAccountId!==ownerAccountId ||
      !edge.dependentId ||
      !['public_active','private_retained','historical_reference'].includes(edge.state))
      return fail('GALLERY_DEPENDENCY_EDGE_UNVERIFIED');
  }
  const publicDependents=dependencies.filter(edge=>edge.state==='public_active');
  if(publicDependents.length){
    // Current server code has no all-or-nothing linked-public retirement RPC.
    return fail('GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED',{
      dependentKinds:[...new Set(publicDependents.map(edge=>edge.kind))]
    });
  }
  if(mode==='unpublish_keep_private' && !(
    cloudPreservation?.provider==='wand_cloud' &&
    cloudPreservation?.durablyStored===true &&
    cloudPreservation?.aclVerified===true &&
    cloudPreservation?.restoreVerified===true &&
    cloudPreservation?.ownerAccountId===ownerAccountId &&
    cloudPreservation?.galleryWorkId===galleryWorkId
  ))return fail('GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED');

  // No issued-URL revocation proof in accepted 03 COMM API (TTL <= 300s).
  if(!(issuedMediaRevocation?.alreadyIssuedUrlsRevoked===true &&
    issuedMediaRevocation?.verifiedForWorkId===galleryWorkId &&
    issuedMediaRevocation?.verifiedRevisionId===revisionPin.currentPublishedRevisionId))
    return fail('GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN');

  // A passing pure gate is still not a server-side authority to change state.
  return Object.freeze({
    ok:true,retirementAuthorized:false,
    code:'GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED',
    requiredSurfaces:PUBLIC_PROJECTION_SURFACES,
    stateTransition:'NOT_EXECUTED'
  });
}
export const GALLERY_DEPENDENCY_CONSUMER_V1=Object.freeze({
  canonicalPhotoEdge:'community-command',
  acceptedDeleteCommand:'deleteGalleryPhoto',
  acceptedPublicPhotoDetail:'community_get_gallery_photo_public_v1',
  exactGraph:'private.gallery_photo_dependency_snapshot_v1',
  linkedRetirementCommand:null,
  cloudKeepPrivateCommand:null,
  issuedUrlRevocationProven:false,
  independentPresetEditOwnership:false,
  supportedPublicListingKinds:['scene'],
  unsupportedPublicListingKinds:['biome','floating_island','tom_furniture','tom_clothing','native_listing'],
  currentPublishContract:'src/lib/community/gallery-photo-contract.ts',
  persistentWriteAuthorized:false,
  productApplyAuthorized:false,
  directSourceReplacementAuthorized:false
});
