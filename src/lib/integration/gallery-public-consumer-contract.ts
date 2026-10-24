import type { GalleryVerifiedSubjectPublicV1, GalleryVerifiedSubjectPublicResultV1 } from '../community/gallery-retirement-contract.ts';
import { reviewedAllV125GallerySubjectCandidates } from './gallery-subject-provenance.ts';
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
  verifiedSubjectCatalogRead:'community_list_verified_gallery_subjects_v1',
  dependentGraph:'private.gallery_photo_dependency_snapshot_v1',
  linkedRetirement:'NOT_AUTHORIZED',
  keepPrivateCloud:'NOT_AUTHORIZED',
  issuedMediaUrlImmediateRevocation:'NOT_PROVEN',
  sourceSchema:'gallery_verified_subjects',
  registeredSubjectKinds:['floating_island','biome','tom_furniture','tom_clothing'],
  unverifiedSubjectKinds:['room'],
  persistentWriteAuthorized:false,
  productApplyAuthorized:false,
  directSourceReplacementAuthorized:false
} as const);

export type GalleryVerifiedSubjectV125 = GalleryVerifiedSubjectPublicV1;

export type GalleryPublishAvailabilityV1 =
  | Readonly<{status:'READY';subject:GalleryVerifiedSubjectV125;command:'publishGalleryPhoto'}>
  | Readonly<{status:'BLOCKED';reason:'GALLERY_VERIFIED_SUBJECT_REQUIRED'|'GALLERY_SUBJECT_CATALOG_UNAVAILABLE'|'GALLERY_SUBJECT_VERSION_PLATFORM_UNPROVEN'|'GALLERY_SUBJECT_NOT_IN_REVIEWED_AUTHORITY'}>;

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
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject.subjectId))
    return {status:'BLOCKED',reason:'GALLERY_VERIFIED_SUBJECT_REQUIRED'};
  if(!reviewedAllV125GallerySubjectCandidates().some(row=>
    row.galleryKind===subject.galleryKind && row.subjectType===subject.subjectType &&
    row.canonicalTargetId===subject.canonicalTargetId &&
    row.baseItemId===subject.baseItemId && row.evidenceRef===subject.evidenceRef))
    return {status:'BLOCKED',reason:'GALLERY_SUBJECT_NOT_IN_REVIEWED_AUTHORITY'};
  return {status:'READY',subject,command:'publishGalleryPhoto'};
}

/** Fail closed on malformed/unreviewed public-query responses. The server-owned
 * subjectId is never calculated from Base Item IDs or a local Save identifier. */
export function bindVerifiedGallerySubjectLookupV1(payload:unknown):
  | Readonly<{status:'READY'; subjects:readonly GalleryVerifiedSubjectV125[]; partial:true}>
  | Readonly<{status:'BLOCKED';reason:'GALLERY_SUBJECT_CATALOG_UNAVAILABLE'|'GALLERY_SUBJECT_NOT_IN_REVIEWED_AUTHORITY'}> {
  if(!payload || typeof payload!=='object')return {status:'BLOCKED',reason:'GALLERY_SUBJECT_CATALOG_UNAVAILABLE'};
  const p=payload as Partial<GalleryVerifiedSubjectPublicResultV1>;
  if(p.contract!=='ddv.gallery-verified-subject-public-lookup@1' ||
     p.catalogStatus!=='partial_verified_only' || p.displayNamesVerified!==false ||
     !Array.isArray(p.subjects) || p.subjects.length>100)
    return {status:'BLOCKED',reason:'GALLERY_SUBJECT_CATALOG_UNAVAILABLE'};
  for(const subject of p.subjects){
    if(galleryPublishAvailabilityV1(subject).status!=='READY')
      return {status:'BLOCKED',reason:'GALLERY_SUBJECT_NOT_IN_REVIEWED_AUTHORITY'};
  }
  return {status:'READY',subjects:p.subjects,partial:true};
}
