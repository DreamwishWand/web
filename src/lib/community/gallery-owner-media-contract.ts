/**
 * 03 COMM #124 — one owner-scoped upload flow over EXISTING Community Media.
 * Server never trusts this transport's client-side booleans as authority.
 * Shared storage / Auth / Gallery publication commands remain unchanged.
 */
import type {PublishGalleryPhotoV1,PublishGalleryPhotoResultV1} from './gallery-photo-contract.ts';

export type GalleryOwnerUploadFileV1=Readonly<{
  mimeType:'image/jpeg'|'image/png'|'image/webp';
  byteSize:number;
}>;
export type GalleryOwnerPrepareV1=Readonly<{
  ok:true;
  action:'galleryPrepare';
  storageKey:string;
  maxBytes:20971520;
  signedUpload:{path?:string;token?:string;signedUrl?:string};
}>;
export type GalleryOwnerReadyMediaV1=Readonly<{
  mediaId:string;storageKey:string;state:'ready';moderationState:'clear';
  mimeType:string;byteSize:number;width:number;height:number;
  checksumSha256:string;replayed:boolean;
}>;
export type GalleryOwnerAbortV1=Readonly<{
  aborted:true;alreadyAborted:boolean;cleanupEligibleAt:string;
}>;
export type GalleryOwnerMediaErrorV1 =
  | 'SESSION_REVOKED_OR_INVALID'|'RATE_LIMITED'
  | 'GALLERY_UPLOAD_INTENT_FAILED'|'GALLERY_UPLOAD_NOT_ACTIVE'
  | 'GALLERY_UPLOAD_FINALIZE_CONFLICT'|'GALLERY_UPLOAD_CANCEL_FORBIDDEN'
  | 'GALLERY_UPLOAD_CLEANUP_NOT_DUE'|'GALLERY_UPLOAD_STORAGE_CLEANUP_RETRY'
  | 'GALLERY_UPLOAD_DB_CLEANUP_RETRY'
  | 'GALLERY_UPLOAD_CLEANUP_WORKER_ONLY'
  | 'GALLERY_UPLOAD_PREPARE_ABORT_REQUIRES_RETRY'
  | 'GALLERY_UPLOAD_OUTSTANDING_COUNT_EXCEEDED'
  | 'GALLERY_UPLOAD_RESERVED_BYTES_EXCEEDED'
  | 'GALLERY_GLOBAL_BACKLOG_COUNT_EXCEEDED'
  | 'GALLERY_GLOBAL_RESERVED_BYTES_EXCEEDED'
  | 'GALLERY_GLOBAL_CLEANUP_STALLED'
  | 'GALLERY_UPLOAD_FORBIDDEN'|'GALLERY_OWNER_STATUS_UNAVAILABLE'
  | 'GALLERY_MEDIA_STORAGE_OBJECT_UNAVAILABLE'
  | 'GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED'|'GALLERY_MEDIA_SELECTION_INVALID'
  | 'GALLERY_ROW_VERSION_CONFLICT'|'GALLERY_IDEMPOTENCY_CONFLICT'
  | 'COMMAND_FAILED';
export type GalleryOwnerMediaTransportV1=Readonly<{
  /** Signed Auth/session-protected existing community-media Edge */
  prepare(input:GalleryOwnerUploadFileV1):Promise<GalleryOwnerPrepareV1>;
  /** Existing Supabase Storage uploadToSignedUrl; never bypass server-side finalize */
  upload(signed:GalleryOwnerPrepareV1,file:Uint8Array):Promise<void>;
  /** Existing community-media Edge galleryFinalize: byte scan + SHA256 + READY/CLEAR */
  finalize(storageKey:string):Promise<GalleryOwnerReadyMediaV1>;
  /** Server-declared ABORT immediately denies finalize; object cleanup is expiry-delayed */
  abort(storageKey:string):Promise<GalleryOwnerAbortV1>;
  /** Queues an expired/aborted key with the existing hourly retention worker; does NOT synchronously delete bytes. */
  cleanup(storageKey:string):Promise<{queued:true;alreadyClaimed:boolean}>;
  /** Owner read-only: no browser-local fake expiry or Cloud durability claim */
  status(storageKey:string):Promise<GalleryOwnerTemporaryStatusV1>;
  /** Quota reconciliation from authoritative DB account ledger */
  capacity():Promise<GalleryOwnerCapacityV1>;
  /** Existing community-command publishGalleryPhoto, no alternate publication API */
  publish(input:PublishGalleryPhotoV1):Promise<PublishGalleryPhotoResultV1>;
}>;
export function assertGalleryPhotoMediaV1(files:readonly GalleryOwnerReadyMediaV1[],
  coverMediaId:string):readonly string[] {
  if(files.length<1||files.length>10)throw new Error('GALLERY_MEDIA_SELECTION_INVALID');
  const ids=new Set<string>();
  for(const m of files){
    if(m.state!=='ready'||m.moderationState!=='clear'||!m.mediaId ||
      !m.storageKey||!Number.isSafeInteger(m.byteSize)||m.byteSize<1||m.byteSize>20971520||
      !['image/jpeg','image/png','image/webp'].includes(m.mimeType)||
      !Number.isSafeInteger(m.width)||m.width<1||
      !Number.isSafeInteger(m.height)||m.height<1||
      !/^[0-9a-f]{64}$/i.test(m.checksumSha256)||ids.has(m.mediaId))
      throw new Error('GALLERY_MEDIA_NOT_READY_OR_NOT_OWNED');
    ids.add(m.mediaId);
  }
  if(!ids.has(coverMediaId))throw new Error('GALLERY_MEDIA_SELECTION_INVALID');
  return Object.freeze(files.map(m=>m.mediaId));
}
export function validateGalleryOwnerUploadFileV1(file:GalleryOwnerUploadFileV1):void {
  if(!['image/jpeg','image/png','image/webp'].includes(file.mimeType)
    ||!Number.isSafeInteger(file.byteSize)||file.byteSize<1||file.byteSize>20971520)
    throw new Error('GALLERY_UPLOAD_FILE_INVALID');
}
export type GalleryUploadOutcomeV1=Readonly<{
  ready:GalleryOwnerReadyMediaV1;
  /** Keep the key for expiry-based recovery/cleanup if Publish later fails. */
  storageKey:string;
}>;
/** Upload+finalize; if completion fails, fail closed and mark the intent aborted.
 * A failure to abort is surfaced as a remediation obligation, not hidden.
 * Do not auto-abort on a normal PUBLIC Publish conflict; user may retry Publish.
 */
export async function uploadGalleryOwnerMediaV1(transport:GalleryOwnerMediaTransportV1,
  file:GalleryOwnerUploadFileV1,bytes:Uint8Array):Promise<GalleryUploadOutcomeV1>{
  validateGalleryOwnerUploadFileV1(file);
  if(bytes.byteLength!==file.byteSize)throw new Error('GALLERY_UPLOAD_SIZE_MISMATCH');
  const prepared=await transport.prepare(file);
  try{
    await transport.upload(prepared,bytes);
    const ready=await transport.finalize(prepared.storageKey);
    if(ready.state!=='ready'||ready.moderationState!=='clear'
      ||ready.storageKey!==prepared.storageKey||ready.byteSize!==file.byteSize)
      throw new Error('GALLERY_UPLOAD_FINALIZE_CONFLICT');
    return {ready,storageKey:prepared.storageKey};
  }catch(error){
    try{await transport.abort(prepared.storageKey);}
    catch(abortError){throw new AggregateError([error,abortError],'GALLERY_UPLOAD_ABORT_REQUIRES_RETRY');}
    throw error;
  }
}
export const GALLERY_OWNER_MEDIA_FLOW_V1=Object.freeze({
  mediaEdge:'community-media',
  prepareAction:'galleryPrepare',
  finalizeAction:'galleryFinalize',
  abortAction:'galleryAbort',
  cleanupAction:'galleryCleanup',
  publishEdge:'community-command',
  publishCommand:'publishGalleryPhoto',
  subjectLookupEdge:'community-public-query',
  subjectLookupRpc:'community_list_verified_gallery_subjects_v1',
  maxImages:10,
  maxBytesEach:20971520,
  signedUploadLifetimeSeconds:7200,
  cleanupGraceSeconds:300,
  immediateCancelledStorageTokenRevocation:false,
  cleanupUsesExistingRetentionCron:true,
  cleanupOwnerCallQueuesOnly:true,
  cleanupBatchMax:20,
  cleanupIsAutomatic:true,
  deleteAuthorized:false,
  cloudKeepPrivateAuthorized:false,
  ddvNativeWriteAuthorized:false
} as const);

/** 06 PRODUCT #128: ttl is INACTIVE; never show invented 72h countdown.
 * Quotas count physically reserved aborted bytes until Worker confirms removal.
 */
export type GalleryOwnerCapacityV1=Readonly<{
  activeUnboundCount:number;
  reservedBytes:number;
  abortedAwaitingPhysicalCleanup:number;
  finalizedUnboundCount:number;
  maxActiveUnbound:number;
  maxReservedBytes:number;
  quotaEnforced:boolean;
  ttlActive:false;
}>;
export type GalleryOwnerTemporaryStatusV1=Readonly<{
  contract:'ddv.gallery-owned-media-status@1';
  uploadState:'pending'|'finalized'|'aborted';
  mediaId:string|null;
  finalizedAt:string|null;
  temporary:boolean;
  durablyReferenced:boolean;
  processingState:'quarantined'|'processing'|'ready'|'rejected'|null;
  moderationState:'clear'|'under_review'|'restricted'|'removed'|null;
  ttlActive:false;
  reuseExpiresAt:null;
  reuseEligible:boolean;
  reuploadRequired:boolean;
  cleanupQueued:boolean;
  cleanupEligibleAt:string|null;
  capacity:GalleryOwnerCapacityV1;
}>;
export const GALLERY_OWNER_RETENTION_SAFETY_V1=Object.freeze({
  conditionalRetentionHours:72,
  ttlEnforcementActivated:false,
  autoDeleteFinalizedUnbound:false,
  legacyExpiryBackfilled:false,
  maximumOutstandingUnboundIntents:10,
  maximumPhysicalReservationBytes:200*1024*1024,
  maximumGalleryImageBytes:20*1024*1024,
  quotaAdmissionAtomic:true,
  abortedStillConsumesPhysicalReservedBytes:true,
  durableRevisionExemptsTemporaryQuota:true,
  currentPhysicalRemovalOnlyAfterOwnerAbortOrExpiredPending:true,
  signedOwnerStorageDeletionAccepted:false,
  globalBackpressureEnabled:true,
  provisionalGlobalActiveOrUncleanedIntentCeiling:100,
  provisionalGlobalReservedBytesCeiling:2000*1024*1024,
  provisionalMaxOldestDueAgeHours:6,
  physicalOrphanCleanupAccepted:false,
  workerPhysicalRemovalFailClosed:true,
  uiShowActive72HourCountdown:false
} as const);
