/** 03 COMM reviewed public Gallery verified-subject picker contract.
 * 09 INT owns canonical classification and provenance. This is a projection only.
 * These records do not prove DDV ownership, ToM importability or native write safety.
 */
export type GalleryVerifiedSubjectPublicV1=Readonly<{
  subjectId:string;
  galleryKind:'outdoor'|'indoor'|'tom_furniture'|'tom_clothing';
  subjectType:'biome'|'floating_island'|'room'|'tom_furniture'|'tom_clothing';
  canonicalTargetId:string;
  baseItemId:number|null;
  platform:'switch';
  gameVersion:'1.25.0';
  buildId:'52BD625D9B4E0053';
  profileSchema:624;
  displayIdentity:string; // explicit Core ID fallback, not a localized display name
  displayName:string|null; // must remain null until independently source-reviewed
  verificationState:'verified';
  evidenceRef:string;
}>;
export type GalleryVerifiedSubjectPublicResultV1=Readonly<{
  contract:'ddv.gallery-verified-subject-public-lookup@1';
  subjects:readonly GalleryVerifiedSubjectPublicV1[];
  catalogStatus:'partial_verified_only';
  displayNamesVerified:false;
}>;
export const GALLERY_VERIFIED_SUBJECT_PUBLIC_LOOKUP_V1=Object.freeze({
  edge:'community-public-query',
  rpc:'community_list_verified_gallery_subjects_v1',
  payload:{p_gallery_kind:null,p_limit:50},
  rawAnonymousRegistryAccess:false,
  currentlyVerifiedKinds:['floating_island','biome','tom_furniture','tom_clothing'],
  globallyVerifiedRoomCount:0,
  subjectVerificationIsNotContentOwnership:true,
  unverifiedSubjectAllowed:false,
  mustNotInferOwnershipOrImport:true
} as const);

/** Media retirement is NOT immediate when Supabase Storage signed URLs already exist.
 * See docs/community/gallery-retirement-media-cloud-20261024.md.
 */
export const GALLERY_MEDIA_RETIREMENT_V1=Object.freeze({
  existingSignedUrlMaxLifetimeSeconds:300,
  newPublicMediaResponseCacheControl:'private, no-store',
  galleryNewPublicMediaTransport:'per_request_authorized_edge_proxy',
  nonGalleryDreamsnapsTransport:'legacy_signed_storage_url',
  gatewayDisallowsHistoricalRevisionMedia:true,
  inFlightResponsesCannotBeRevoked:true,
  newPublicPhotoDetailResponseCacheControl:'private, no-store',
  previouslyIssuedUrlsRevoked:false,
  oldUrlReplayTested:false,
  cacheOrCDNRevocationProven:false,
  deletionAuthorized:false,
  cloudPrivateTransitionAuthorized:false,
  signedChromeAcceptance:'CONFIGURATION_BLOCKED',
  publicVisibilityCannotGuaranteeImmediateErase:true
} as const);

/** The existing public-media Edge now routes Gallery photo revisions through
 * a per-request authorized binary gateway. Legacy Dreamsnap media is unaffected.
 * This does NOT revoke any previously issued Storage signed URL or browser copy.
 */
export type GalleryMediaPublicGatewayV1 = Readonly<{
  ok:true;
  media:Readonly<{
    mediaId:string;
    transport:'edge_proxy';
    streamUrl:string;
    rawStorageSignedUrlIssued:false;
    mimeType:'image/jpeg'|'image/png'|'image/webp';
    byteSize:number;
    width:number;
    height:number;
    checksumSha256:string;
  }>;
}>;
export type GalleryRetirementPreflightV1=Readonly<{
  contract:'ddv.gallery-public-retirement-preflight@1';
  workId:string;
  rowVersion:number;
  revisionId:string|null;
  ownerEligible:true;
  lifecycleState:string;
  visibility:string;
  moderationState:string;
  graphComplete:boolean;
  dependencyCoverage:Readonly<Record<string,string>>;
  linkedPresetRevisionCount:number;
  associatedPresetArtifactCount:number;
  newGallerySignedStorageUrlIssued:false;
  galleryNewTransport:'per_request_authorized_edge_proxy';
  historicallyIssuedStorageSignedUrlMaxSeconds:300;
  previousSignedUrlsRevoked:false;
  cdnAndBrowserPurgeProven:false;
  cloudEntitlementVerified:false;
  cloudPrivateStorageVerified:false;
  cloudOwnerRestoreVerified:false;
  operationAuthorized:false;
  deleteAuthorized:false;
  unpublishKeepPrivateAuthorized:false;
  retryEligible:false;
  blockedReasons:readonly string[];
}>;
export type GalleryRetirementPublicOperation =
  'retirementPreflight'|'delete'|'unpublishKeepPrivate'|'restorePrivate'|'republishPrivate';
export type GalleryRetirementAvailabilityV1=Readonly<{
  operation:GalleryRetirementPublicOperation;
  supported:boolean;
  requiresOwner:boolean;
  enabled:boolean;
  reason:'GALLERY_DEPENDENCY_GRAPH_INCOMPLETE'|
     'GALLERY_PREVIOUS_SIGNED_URL_REPLAY_UNPROVEN'|
     'GALLERY_CLOUD_ENTITLEMENT_UNVERIFIED'|
     'GALLERY_PRIVATE_DURABILITY_UNVERIFIED'|
     'GALLERY_RESTRICTED_TO_READ_ONLY_PREFLIGHT';
}>;
export const GALLERY_RETIREMENT_OWNER_PREFLIGHT_V1=Object.freeze({
  edge:'community-query',
  query:'galleryRetirementPreflight',
  parameter:'workId',
  ownerAuthenticationRequired:true,
  immutableRevisionPreserved:true,
  stateMutationPerformed:false,
  certifiedPublicUrlRevocation:false,
  databaseCloudEntitlementAvailable:false,
  privateDurableMediaCopyAvailable:false,
  privateRestoreVerified:false,
  graphComplete:false,
  priorStorageTokensRevoked:false,
  listDetailNewTokensRevokedOnlyOnFutureRetirement:false,
  supportedOperations:['retirementPreflight'],
  blockedOperations:['delete','unpublishKeepPrivate','restorePrivate','republishPrivate'],
  nativeWriterAuthorized:false
} as const);
