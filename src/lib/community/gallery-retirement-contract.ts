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
  currentlyVerifiedKinds:['floating_island'],
  otherKindsVerified:false,
  unverifiedSubjectAllowed:false,
  mustNotInferOwnershipOrImport:true
} as const);

/** Media retirement is NOT immediate when Supabase Storage signed URLs already exist.
 * See docs/community/gallery-retirement-media-cloud-20261024.md.
 */
export const GALLERY_MEDIA_RETIREMENT_V1=Object.freeze({
  existingSignedUrlMaxLifetimeSeconds:300,
  newPublicMediaResponseCacheControl:'private, no-store',
  newPublicPhotoDetailResponseCacheControl:'private, no-store',
  previouslyIssuedUrlsRevoked:false,
  oldUrlReplayTested:false,
  cacheOrCDNRevocationProven:false,
  deletionAuthorized:false,
  cloudPrivateTransitionAuthorized:false,
  signedChromeAcceptance:'CONFIGURATION_BLOCKED',
  publicVisibilityCannotGuaranteeImmediateErase:true
} as const);
