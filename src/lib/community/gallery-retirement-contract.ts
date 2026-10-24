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

/** Gallery Owner Media Read uses fresh JWT-gated Edge binary bytes without
 * minting a new raw Storage bearer URL. This DOES NOT revoke older-issued
 * 300-second Storage URLs, CDN/browser copies, in-flight or downloaded bytes.
 * Non-Gallery/DreamSnaps retain their separate legacy signed URL path.
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
  publicVisibilityCannotGuaranteeImmediateErase:true,
  authenticatedOwnerReadMayCreateNewSignedUrl:false
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
/** #116 Owner-validated metadata audit only. Cloud entitlement authority is
 * NOT configured. SQL row counts/relationships are not a backup, verified
 * Storage object nor proof of successful Cloud restoration.
 */
export type GalleryCloudPreservationReadinessV1=Readonly<{
  contract:'ddv.gallery-cloud-preservation-readiness@1';
  entitlement:Readonly<{
    source:'not_configured';state:'unverified';
    verified:false;active:false;providerEvidencePresent:false;
  }>;
  ownerAccountResolved:true;
  creatorOwnershipAndModerationValid:boolean;
  databaseManifest:Readonly<{
    workRowFound:true;
    currentRevisionId:string|null;
    currentRevisionPresent:boolean;
    currentRevisionSealed:boolean;
    revisionRowCount:number;
    historicalRevisionRowCount:number;
    sealedRevisionRowCount:number;
    coverReferenceCount:number;
    coverWithoutCompositionCount:number;
    mediaReferenceCount:number;
    distinctMediaCount:number;
    invalidOrNonOwnedMediaCount:number;
    structuralIntegrityObserved:boolean;
  }>;
  storageObjectByteReadbackVerified:false;
  cloudPrivateStorageAclVerified:false;
  cloudBackupAndRestoreVerified:false;
  cloudEntitlementVerified:false;
  dependencyGraphCoverageVerified:false;
  signedUrlAndCacheRevocationProven:false;
  privateSaveAuthorized:false;
  privateDetailAuthorized:false;
  restoreAuthorized:false;
  republishAuthorized:false;
  blockedReasons:readonly string[];
}>;

export const GALLERY_CLOUD_PRESERVATION_READINESS_V1=Object.freeze({
  edge:'community-query',
  query:'galleryRetirementPreflight',
  ownerJwtAndActiveAccountRequired:true,
  cloudEntitlementSourceConfigured:false,
  serverSqlSnapshotIsNotCloudBackup:true,
  restoreCreatesNewImmutableRevisionOnceAuthorized:true,
  restoreRequiresRowVersionAndReferencedMediaPreflight:true,
  noPersistentPrivateFreeWork:true,
  incompleteCrossProductGraphFailsClosed:true,
  requiresPhysicalStorageAclAndReadbackProof:true,
  oldSignedTokensMaySurviveUpTo300Seconds:true,
  currentOperations:['readOnlyPreflight'],
  disabledOperations:['unpublishKeepPrivate','delete','restorePrivate','republishPrivate'],
  nativeWriterAuthorized:false
} as const);

export type GalleryRetirementPreflightV1=Readonly<{
  contract:'ddv.gallery-public-retirement-preflight@1';
  workId:string;
  rowVersion:number;
  revisionId:string|null;
  ownerEligible:true;
  cloudPreservation:GalleryCloudPreservationReadinessV1;
  lifecycleState:string;
  visibility:string;
  moderationState:string;
  graphComplete:boolean;
  dependencyCoverage:Readonly<Record<string,string>>;
  // 09 INT service-only snapshot; owner diagnostics, never a retire permission.
  dependencyCoverageContract:string|null;
  dependencyCoverageClassification:Readonly<Record<string,string>>;
  dependencyRelationCoverage:Readonly<Record<string,string>>;
  dependencyMissingSources:readonly string[];
  dependencyBlockedReasons:readonly string[];
  dependencyGraphFingerprintSha256:string|null;
  dependencySnapshotNotAtomicMutationFence:true;
  dependencySnapshotRowVersion:number;
  dependencySourceVersionState:string|null;
  dependencyOwnerMismatchEdgeCount:number;
  dependencyCreatorMismatchEdgeCount:number;
  linkedPresetRevisionCount:number;
  associatedPresetArtifactCount:number;
  newPublicGalleryStorageSignedUrlIssued:false;
  authenticatedOwnerReadMayMintStorageSignedUrl:false;
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
  authenticatedOwnerReadStillMintsSignedStorageUrl:false,
  historicalStorageURLsMayStillBeRedeemed:true,
  listDetailNewTokensRevokedOnlyOnFutureRetirement:false,
  supportedOperations:['retirementPreflight'],
  blockedOperations:['delete','unpublishKeepPrivate','restorePrivate','republishPrivate'],
  nativeWriterAuthorized:false
} as const);

/** #116: authenticated owner Gallery media never mints bearer Storage URL.
 * Caller must POST {action:'galleryReadBytes',mediaId} with the same valid
 * current Owner JWT to read immutable or current Gallery photo bytes.
 * Other non-Gallery and DreamSnaps media keep legacy signed URL reader.
 */
export type GalleryOwnerBinaryReadV1=Readonly<{
 ok:true;action:'read';
 media:Readonly<{
   mediaId:string;
   transport:'authenticated_edge_binary_post';
   readAction:'galleryReadBytes';
   requiresOwnerBearer:true;
   rawStorageSignedUrlIssued:false;
   mimeType:'image/jpeg'|'image/png'|'image/webp';
   byteSize:number;width:number;height:number;checksumSha256:string;
 }>;
}>;
export const GALLERY_OWNER_CLOUD_RETIREMENT_BOUNDARY_V1=Object.freeze({
  ownerReadIssuer:'jwt_authenticated_binary_post',
  galleryOwnerStorageSignedUrlIssuerEnabled:false,
  nonGalleryLegacySignedUrlIssuerPreserved:true,
  oldStorageBearerTokensImmediatelyRevoked:false,
  distributedCDNCachePurged:false,
  cloudEntitlementVerified:false,
  cloudPrivateRevisionPersistenceVerified:false,
  cloudOwnerOnlyACLVerified:false,
  cloudPrivateRestoreVerified:false,
  crossProductDependencyGraphComplete:false,
  deleteAuthorized:false,
  unpublishKeepPrivateAuthorized:false,
  restorePrivateAuthorized:false,
  republishPrivateAuthorized:false
} as const);
