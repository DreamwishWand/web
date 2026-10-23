import type {
  GalleryPhotoTarget,
  PublishGalleryPhotoV1,
  PublishGalleryPhotoResultV1,
  DeleteGalleryPhotoV1,
  GalleryPhotoErrorCode
} from '../community/gallery-photo-contract.ts';

/**
 * 09 INT -> 08 WEB. This is a consumer contract over the SINGLE 03 COMM PR #108
 * Gallery API, not another publication API.
 */
export const GALLERY_VERIFIED_SUBJECT_INTEGRATION_API_V1 = Object.freeze({
  version:'ddv.gallery-verified-subject-consumer@1',
  publishEdge:'community-command',
  publishCommand:'publishGalleryPhoto',
  updateCommand:'publishGalleryPhoto',
  deleteCommand:'deleteGalleryPhoto',
  detailEdge:'community-public-query',
  detailRpc:'community_get_gallery_photo_public_v1',
  verifiedSubjectCatalogRead:'03_COMM_PENDING',
  dependentGraph:'private.gallery_photo_dependency_snapshot_v1',
  linkedRetirement:'NOT_AUTHORIZED',
  keepPrivateCloud:'NOT_AUTHORIZED',
  issuedMediaUrlImmediateRevocation:'NOT_PROVEN',
  sourceSchema:'gallery_verified_subjects',
  registeredSubjectKinds:['floating_island'],
  unverifiedSubjectKinds:['biome','room','tom_furniture','tom_clothing'],
  persistentWriteAuthorized:false,
  productApplyAuthorized:false,
  directSourceReplacementAuthorized:false
} as const);

export type GalleryVerifiedSubjectV125 = GalleryPhotoTarget & Readonly<{
  /** SubjectId issued by the existing 03 COMM registry, not a client-computed UUID. */
  evidenceRef:string;
  verificationState:'verified';
}>;

export type GalleryPublishAvailabilityV1 =
  | Readonly<{status:'READY';subject:GalleryVerifiedSubjectV125;command:'publishGalleryPhoto'}>
  | Readonly<{status:'BLOCKED';reason:'GALLERY_VERIFIED_SUBJECT_REQUIRED'|'GALLERY_SUBJECT_CATALOG_UNAVAILABLE'|'GALLERY_SUBJECT_VERSION_PLATFORM_UNPROVEN'}>;

export type GalleryRetirementAvailabilityV1 =
  | Readonly<{status:'BLOCKED';code:
    | 'GALLERY_DEPENDENCY_COVERAGE_UNKNOWN'
    | 'GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED'
    | 'GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED'
    | 'GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN'
    | 'GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED'}>
  | Readonly<{status:'CONFIGURATION_BLOCKED';code:'SIGNED_GALLERY_BROWSER_NOT_CONFIGURED'}>;

export type GalleryPublicPhotoCommandsV1 = Readonly<{
  publish(payload:PublishGalleryPhotoV1):Promise<PublishGalleryPhotoResultV1>;
  /** Only when the retirement availability has been positively closed by 03 COMM + 04 QR. */
  delete(payload:DeleteGalleryPhotoV1):Promise<never>;
  /** No Cloud private workflow is implemented/authorized. */
  unpublishKeepPrivate:never;
}>;

export type GalleryPhotoIntegrationErrorCode = GalleryPhotoErrorCode
  | 'GALLERY_ISSUED_MEDIA_URL_REVOKE_UNPROVEN'
  | 'GALLERY_DEPENDENCY_COVERAGE_UNKNOWN'
  | 'GALLERY_SERVER_ATOMIC_RETIREMENT_REQUIRED'
  | 'GALLERY_SUBJECT_CATALOG_UNAVAILABLE';

export function galleryPublishAvailabilityV1(subject:GalleryVerifiedSubjectV125|null|undefined):GalleryPublishAvailabilityV1 {
  if(!subject)return {status:'BLOCKED',reason:'GALLERY_SUBJECT_CATALOG_UNAVAILABLE'};
  if(subject.verificationState!=='verified')return {status:'BLOCKED',reason:'GALLERY_VERIFIED_SUBJECT_REQUIRED'};
  if(subject.platform!=='switch'||subject.gameVersion!=='1.25.0'||
    subject.buildId!=='52BD625D9B4E0053'||subject.profileSchema!==624)
    return {status:'BLOCKED',reason:'GALLERY_SUBJECT_VERSION_PLATFORM_UNPROVEN'};
  return {status:'READY',subject,command:'publishGalleryPhoto'};
}
