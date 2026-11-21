/**
 * 03 COMM photo-only Gallery lifecycle, version 1.
 * PUBLIC server publication only. DDV save writers are not part of this API.
 * A 09 INT-owned canonical subject registry must have verification_state='verified'.
 * The first image in the returned mediaIds is the cover.
 */
export type GalleryPhotoKind = 'outdoor'|'indoor'|'tom_furniture'|'tom_clothing';
export type GalleryPhotoSubjectType = 'biome'|'floating_island'|'room'|'tom_furniture'|'tom_clothing';
export type GalleryPhotoTarget = Readonly<{
  subjectId: string;
  subjectType: GalleryPhotoSubjectType;
  canonicalTargetId: string;
  baseItemId: number|null;
  platform: 'switch';
  gameVersion: '1.25.0';
  buildId: '52BD625D9B4E0053';
  profileSchema: 624;
}>;
export type PublishGalleryPhotoV1 = Readonly<{
  creatorProfileId: string;
  /** Omit for atomic PUBLIC create; set both workId and expectedVersion for update. */
  workId?: string|null;
  expectedVersion?: number|null;
  galleryKind: GalleryPhotoKind;
  /** 09 INT-verified registry entry; never arbitrary client-only labels. */
  subjectId: string;
  title: string;
  description?: string|null;
  /** 1..10 unique owner-controlled, READY/CLEAR non-purged images. */
  mediaIds: readonly string[];
  coverMediaId: string;
  /** Explicit image origin attestation, not game-save ownership proof. */
  originalityAttested: true;
  idempotencyKey: string;
}>;
export type PublishGalleryPhotoResultV1 = GalleryPhotoTarget & Readonly<{
  workId: string;
  revisionId: string;
  rowVersion: number;
  galleryKind: GalleryPhotoKind;
  creatorProfileId: string;
  coverMediaId: string;
  mediaIds: readonly string[];
  visibility:'public';
  lifecycleState:'published';
  created:boolean;
}>;
export type DeleteGalleryPhotoV1 = Readonly<{
  workId: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;
export type DeleteGalleryPhotoResultV1=Readonly<{
  workId:string;
  lifecycleState:'deleted';
  rowVersion:number;
}>;
export type GalleryPhotoErrorCode =
  | 'GALLERY_IDEMPOTENCY_KEY_INVALID'
  | 'GALLERY_IDEMPOTENCY_CONFLICT'
  | 'GALLERY_KIND_UNSUPPORTED'
  | 'GALLERY_PRESENTATION_INVALID'
  | 'GALLERY_ORIGINALITY_ATTESTATION_REQUIRED'
  | 'GALLERY_MEDIA_SELECTION_INVALID'
  | 'GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED'
  | 'GALLERY_MEDIA_ALREADY_PUBLIC_ON_DIFFERENT_WORK'
  | 'GALLERY_VERIFIED_SUBJECT_REQUIRED'
  | 'GALLERY_CREATOR_FORBIDDEN'
  | 'GALLERY_WORK_FORBIDDEN'
  | 'GALLERY_ROW_VERSION_CONFLICT'
  | 'GALLERY_WORK_NOT_PUBLIC_EDITABLE'
  | 'GALLERY_SUBJECT_OR_CREATOR_IMMUTABLE'
  | 'GALLERY_PRESET_DEPENDENCY_REQUIRES_09_INT'
  | 'GALLERY_PUBLIC_DELETE_ONLY'
  | 'GALLERY_DEPENDENT_PUBLIC_RETIREMENT_09_INT_REQUIRED'
  | 'GALLERY_CLOUD_PRIVATE_PRESERVATION_09_INT_REQUIRED'
  | 'GALLERY_PHOTO_PUBLIC_BINDING_MISSING'
  | 'RATE_LIMITED'
  | 'SESSION_REVOKED_OR_INVALID'
  | 'COMMAND_FAILED';
export type GalleryPhotoCommandResponse<T>=
  | Readonly<{ok:true;command:'publishGalleryPhoto'|'deleteGalleryPhoto';data:T}>
  | Readonly<{ok:false;error:'CONFLICT'|'FORBIDDEN'|'RATE_LIMITED'|'COMMAND_FAILED'|GalleryPhotoErrorCode;message?:string}>;
export const GALLERY_PHOTO_API_V1=Object.freeze({
  commandEdge:'community-command',
  createAndUpdateCommand:'publishGalleryPhoto',
  deleteCommand:'deleteGalleryPhoto',
  publicQueryEdge:'community-public-query',
  publicDetailRpc:'community_get_gallery_photo_public_v1',
  subjectSource:'gallery_verified_subjects',
  subjectOwner:'09 INT / Game DB provenance',
  dependentRetirementOwner:'09 INT',
  cloudPrivateKeepAuthorized:false,
  persistentDdvSaveWriteAuthorized:false,
  /** public-media signed CDN URL can remain valid for up to 300 seconds. */
  immediateIssuedSignedUrlRevocationProven:false
} as const);
