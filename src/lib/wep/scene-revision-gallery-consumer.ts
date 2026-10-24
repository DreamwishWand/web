/**
 * WEP consumer of PR #134 Scene PUBLIC CURRENT read and owner READINESS.
 * No new Gallery/Creator/Media model, no storage mutation, no Scene revision writer.
 * Only trust IDs/links issued by the existing 03 COMM current read projection.
 */
export const SCENE_REVISION_CONSUMER_CONTRACT = 'ddv.wep.scene-revision-gallery-readonly@1';
export const SCENE_PUBLIC_CURRENT_RPC = 'community_get_scene_preset_public_v1';
export const SCENE_OWNER_READINESS_CONTRACT = 'ddv.scene-revision-readiness@1';
export const SCENE_REVISION_WRITE_BLOCKERS = Object.freeze([
  'SCENE_REVISION_ATOMIC_WRITER_NOT_APPROVED',
  'GALLERY_ALL_WRITER_LOCK_PROTOCOL_UNVERIFIED',
  'SCENE_PAIRED_MEDIA_COVER_PUBLICATION_NOT_ACCEPTED',
  'SCENE_STORAGE_ROLLBACK_AND_RETRY_NOT_ACCEPTED'
] as const);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const validId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
const invalid = (code: string): never => { throw new SceneRevisionConsumerError(code); };

export class SceneRevisionConsumerError extends Error {
  constructor(code: string) { super(code); this.name = 'SceneRevisionConsumerError'; }
}

export interface ScenePublicCurrentRead {
  workId: string;
  workRevisionId: string;
  presetArtifactId: string;
  presetRevisionId: string;
  presetRevisionNumber: number;
  creatorProfileId: string;
  title: string;
  description: string | null;
  galleryWorkId: string | null;
  galleryWorkRevisionId: string | null;
  mediaIds: string[];
  coverMediaId: string | null;
  checksumSha256: string;
  byteSize: number;
  schemaVersion: number;
  publishedAt: string | null;
  readonly currentOnly: true;
  readonly historicalMediaAvailable: false;
  readonly saveRevisionAuthorized: false;
  readonly pairedGalleryPublishAuthorized: false;
}

export interface SceneOwnerReadiness {
  contract: typeof SCENE_OWNER_READINESS_CONTRACT;
  presetArtifactId: string;
  presetWorkId: string;
  presetType: 'scene';
  ownerEligible: true;
  // Owner RPC verifies creator internally but does not return its ID in @1.
  ownerCreatorProfileId: string | null;
  workRowVersion: number;
  lifecycleState: string;
  visibility: string;
  currentPresetRevisionId: string | null;
  revisionCount: number;
  latestRevisionNumber: number;
  currentArtifactAvailable: boolean;
  hasAssociatedGallery: boolean;
  // Owner-only, non-atomic hints from 03 COMM Readiness @1.
  pairedGalleryWorkId: string | null;
  pairedGalleryWorkRowVersion: number | null;
  pairedGalleryCurrentWorkRevisionId: string | null;
  pairedGallerySnapshotIsAtomicFence: false;
  historicalEdgeSetScope: 'scene-historical-edges-v1' | null;
  historicalEdgeSetSha256: string | null;
  historicalEdgeSetIsAtomicFence: false;
  contractGapReasons: string[];
  knownHistoricalGalleryCount: number;
  knownGalleryReferenceCount: number;
  crossOwnerOrUnresolvedGalleryCount: number;
  dependencyFingerprintSha256: string;
  dependencyFingerprintIsAtomicFence: false;
  graphComplete: false;
  saveRevisionAuthorized: false;
  pairedGalleryPublishAuthorized: false;
  unpublishAuthorized: false;
  deleteAuthorized: false;
  restoreAuthorized: false;
  blockedReasons: string[];
}

export function parseScenePublicCurrent(rawInput: unknown, expectedWorkId: string): ScenePublicCurrentRead {
  const raw = rawInput as Record<string, any>;
  if (!validId(expectedWorkId)) invalid('WEP_SCENE_WORK_ID_INVALID');
  if (!object(rawInput) || raw.presetType !== 'scene' ||
    raw.workId !== expectedWorkId ||
    !validId(raw.workRevisionId) || !validId(raw.presetArtifactId) ||
    !validId(raw.presetRevisionId) || !validId(raw.creatorProfileId)) {
    invalid('WEP_SCENE_PUBLIC_CURRENT_IDENTITY_INVALID');
  }
  if (!Number.isSafeInteger(raw.presetRevisionNumber) || Number(raw.presetRevisionNumber) < 1 ||
      !Number.isSafeInteger(raw.schemaVersion) || Number(raw.schemaVersion) < 1 ||
      !Number.isSafeInteger(raw.byteSize) || Number(raw.byteSize) < 1 ||
      typeof raw.checksumSha256 !== 'string' || !SHA256.test(raw.checksumSha256)) {
    invalid('WEP_SCENE_PUBLIC_CURRENT_ARTIFACT_PROOF_INVALID');
  }
  const mediaIds = raw.mediaIds;
  if (!Array.isArray(mediaIds) || mediaIds.length > 10 ||
      mediaIds.some((v: unknown) => !validId(v)) || new Set(mediaIds).size !== mediaIds.length) {
    invalid('WEP_SCENE_PUBLIC_CURRENT_MEDIA_SET_INVALID');
  }
  const gallery = raw.galleryWorkId;
  const galleryRevision = raw.galleryWorkRevisionId;
  const cover = raw.coverMediaId;
  if ((gallery !== null && !validId(gallery)) ||
      (galleryRevision !== null && !validId(galleryRevision)) ||
      (cover !== null && !validId(cover))) {
    invalid('WEP_SCENE_PUBLIC_CURRENT_GALLERY_ID_INVALID');
  }
  if ((gallery === null) !== (galleryRevision === null) ||
      (gallery === null && (mediaIds.length > 0 || cover !== null)) ||
      (gallery !== null && (mediaIds.length < 1 || !cover || !mediaIds.includes(cover)))) {
    invalid('WEP_SCENE_PUBLIC_CURRENT_GALLERY_COVER_UNBOUND');
  }
  if (typeof raw.title !== 'string' || raw.title.length > 512 ||
      (raw.description !== null && typeof raw.description !== 'string') ||
      (raw.publishedAt !== null && typeof raw.publishedAt !== 'string')) {
    invalid('WEP_SCENE_PUBLIC_CURRENT_METADATA_INVALID');
  }
  return Object.freeze({
    workId: raw.workId as string,
    workRevisionId: raw.workRevisionId as string,
    presetArtifactId: raw.presetArtifactId as string,
    presetRevisionId: raw.presetRevisionId as string,
    presetRevisionNumber: raw.presetRevisionNumber as number,
    creatorProfileId: raw.creatorProfileId as string,
    title: raw.title as string,
    description: raw.description as string | null,
    galleryWorkId: gallery as string | null,
    galleryWorkRevisionId: galleryRevision as string | null,
    mediaIds: Object.freeze([...mediaIds]) as unknown as string[],
    coverMediaId: cover as string | null,
    checksumSha256: (raw.checksumSha256 as string).toLowerCase(),
    byteSize: raw.byteSize as number,
    schemaVersion: raw.schemaVersion as number,
    publishedAt: raw.publishedAt as string | null,
    currentOnly: true,
    historicalMediaAvailable: false,
    saveRevisionAuthorized: false,
    pairedGalleryPublishAuthorized: false
  });
}

export function parseSceneOwnerReadiness(rawInput: unknown, expectedPresetArtifactId: string): SceneOwnerReadiness {
  const raw = rawInput as Record<string, any>;
  if (!validId(expectedPresetArtifactId)) invalid('WEP_SCENE_OWNER_PRESET_ID_INVALID');
  if (!object(rawInput) ||
    raw.contract !== SCENE_OWNER_READINESS_CONTRACT ||
    raw.presetArtifactId !== expectedPresetArtifactId ||
    !validId(raw.presetWorkId) || raw.presetType !== 'scene' ||
    raw.ownerEligible !== true) {
    invalid('WEP_SCENE_OWNER_READINESS_IDENTITY_INVALID');
  }
  for (const key of ['workRowVersion','revisionCount','latestRevisionNumber',
    'knownHistoricalGalleryCount','knownGalleryReferenceCount','crossOwnerOrUnresolvedGalleryCount']) {
    if (!Number.isSafeInteger(raw[key]) || Number(raw[key]) < 0) {
      invalid('WEP_SCENE_OWNER_READINESS_COUNTER_INVALID');
    }
  }
  if ((raw.currentPresetRevisionId !== null && !validId(raw.currentPresetRevisionId)) ||
      typeof raw.lifecycleState !== 'string' || typeof raw.visibility !== 'string' ||
      typeof raw.currentArtifactAvailable !== 'boolean' ||
      typeof raw.hasAssociatedGallery !== 'boolean' ||
      typeof raw.dependencyFingerprintSha256 !== 'string' ||
      !SHA256.test(raw.dependencyFingerprintSha256) ||
      !Array.isArray(raw.blockedReasons) ||
      raw.blockedReasons.some((x: unknown) => typeof x !== 'string')) {
    invalid('WEP_SCENE_OWNER_READINESS_DETAIL_INVALID');
  }
  // Backward-compatible READ contract: older Staging deployments can omit
  // newer keys, but they MUST NOT silently appear complete. Unknown scope is
  // not a valid pin; malformed IDs/versions or optimistic flags fail closed.
  const optionalUuid = (v: unknown) => v === null || validId(v);
  const ownerCreatorProfileId = raw.creatorProfileId ?? null;
  if (ownerCreatorProfileId !== null && !validId(ownerCreatorProfileId)) {
    invalid('WEP_SCENE_OWNER_CREATOR_IDENTITY_INVALID');
  }
  const galleryId = raw.pairedGalleryWorkId ?? null;
  const galleryVersion = raw.pairedGalleryWorkRowVersion ?? null;
  const galleryRevision = raw.pairedGalleryCurrentWorkRevisionId ?? null;
  const scope = raw.historicalEdgeSetScope ?? null;
  const edgeSha = raw.historicalEdgeSetSha256 ?? null;
  if (!optionalUuid(galleryId) || !optionalUuid(galleryRevision) ||
      (galleryVersion !== null && (!Number.isSafeInteger(galleryVersion) || galleryVersion < 0)) ||
      (edgeSha !== null && (typeof edgeSha !== 'string' || !SHA256.test(edgeSha)))) {
    invalid('WEP_SCENE_OWNER_GALLERY_VERSION_OR_HISTORY_INVALID');
  }
  if (raw.pairedGallerySnapshotIsAtomicFence !== undefined &&
      raw.pairedGallerySnapshotIsAtomicFence !== false ||
      raw.historicalEdgeSetIsAtomicFence !== undefined &&
      raw.historicalEdgeSetIsAtomicFence !== false) {
    invalid('WEP_SCENE_OWNER_UNAPPROVED_ATOMIC_FENCE');
  }
  const contractGapReasons: string[] = [];
  const paired = raw.hasAssociatedGallery === true;
  if (paired && galleryId === null) contractGapReasons.push('SCENE_PAIRED_GALLERY_OWNER_ID_UNAVAILABLE');
  if (paired && galleryVersion === null) contractGapReasons.push('SCENE_PAIRED_GALLERY_ROWVERSION_UNAVAILABLE');
  if (paired && galleryRevision === null) contractGapReasons.push('SCENE_PAIRED_GALLERY_CURRENT_REVISION_UNAVAILABLE');
  if (paired && (scope !== 'scene-historical-edges-v1' || edgeSha === null)) {
    contractGapReasons.push('SCENE_HISTORICAL_EDGE_SET_SCOPE_OR_SHA_UNAVAILABLE');
  }
  if (paired && raw.crossOwnerOrUnresolvedGalleryCount > 0) {
    contractGapReasons.push('SCENE_REFERENCE_IDENTITY_CONFLICT');
  }
  if (!paired && (galleryId !== null || galleryVersion !== null || galleryRevision !== null)) {
    contractGapReasons.push('SCENE_PAIRED_GALLERY_UNEXPECTED_OWNER_VERSION');
  }
  if (galleryId === null && (galleryVersion !== null || galleryRevision !== null)) {
    contractGapReasons.push('SCENE_PAIRED_GALLERY_PARTIAL_VERSION_UNTRUSTED');
  }
  if (scope !== null && scope !== 'scene-historical-edges-v1') {
    contractGapReasons.push('SCENE_HISTORICAL_EDGE_SET_SCOPE_UNSUPPORTED');
  }
  if ((scope === null) !== (edgeSha === null)) {
    contractGapReasons.push('SCENE_HISTORICAL_EDGE_SET_PARTIAL');
  }
  // A positive upstream flag is NOT an invitation for WEP to enable writing.
  const disabled = ['dependencyFingerprintIsAtomicFence','graphComplete',
    'saveRevisionAuthorized','pairedGalleryPublishAuthorized','unpublishAuthorized',
    'deleteAuthorized','restoreAuthorized'];
  if (disabled.some(key => raw[key] !== false)) {
    invalid('WEP_SCENE_OWNER_READINESS_UNAPPROVED_WRITER');
  }
  for (const mandatory of SCENE_REVISION_WRITE_BLOCKERS) {
    if (!raw.blockedReasons.includes(mandatory)) invalid('WEP_SCENE_OWNER_READINESS_MISSING_BLOCKER');
  }
  return Object.freeze({
    ...raw,
    ownerCreatorProfileId: ownerCreatorProfileId as string | null,
    pairedGalleryWorkId: galleryId as string | null,
    pairedGalleryWorkRowVersion: galleryVersion as number | null,
    pairedGalleryCurrentWorkRevisionId: galleryRevision as string | null,
    pairedGallerySnapshotIsAtomicFence: false,
    historicalEdgeSetScope: scope === 'scene-historical-edges-v1' ? scope : null,
    historicalEdgeSetSha256: scope === 'scene-historical-edges-v1'
      ? (edgeSha as string | null)?.toLowerCase() ?? null : null,
    historicalEdgeSetIsAtomicFence: false,
    contractGapReasons: Object.freeze(contractGapReasons),
    blockedReasons: Object.freeze([...new Set([...raw.blockedReasons, ...contractGapReasons])])
  }) as unknown as SceneOwnerReadiness;
}

/** Authenticated owner diagnostics only: never call this from a PUBLIC reader. */
export function diagnoseSceneRevisionPairing(
  current: ScenePublicCurrentRead | null,
  owner: SceneOwnerReadiness
) {
  const issues = [...owner.blockedReasons];
  if (!current) {
    issues.push('SCENE_PUBLIC_CURRENT_NOT_COMPARED');
  } else {
    if (owner.ownerCreatorProfileId === null) {
      issues.push('SCENE_OWNER_CREATOR_CROSSREAD_UNAVAILABLE');
    } else if (current.creatorProfileId !== owner.ownerCreatorProfileId) {
      issues.push('SCENE_PUBLIC_OWNER_CREATOR_MISMATCH');
    }
    if (current.presetArtifactId !== owner.presetArtifactId ||
        current.workId !== owner.presetWorkId ||
        current.presetRevisionId !== owner.currentPresetRevisionId) {
      issues.push('SCENE_CURRENT_PRESET_REVISION_STALE_OR_MISMATCHED');
    }
    if (owner.hasAssociatedGallery) {
      if (current.galleryWorkId !== owner.pairedGalleryWorkId ||
          !current.galleryWorkId) {
        issues.push('SCENE_PAIRED_GALLERY_WORK_ID_MISMATCH');
      }
      if (current.galleryWorkRevisionId !== owner.pairedGalleryCurrentWorkRevisionId ||
          !current.galleryWorkRevisionId) {
        issues.push('SCENE_PAIRED_GALLERY_CURRENT_REVISION_STALE');
      }
      if (!current.coverMediaId || !current.mediaIds.includes(current.coverMediaId)) {
        issues.push('SCENE_CURRENT_MEDIA_COVER_NOT_VERIFIED');
      }
    } else if (current.galleryWorkId || current.galleryWorkRevisionId) {
      issues.push('SCENE_PUBLIC_GALLERY_WITHOUT_OWNER_ASSOCIATION');
    }
  }
  if (owner.hasAssociatedGallery && owner.pairedGalleryWorkRowVersion === null) {
    issues.push('SCENE_PAIRED_GALLERY_ROWVERSION_UNAVAILABLE');
  }
  // Neither Public Current nor this owner Readiness contains an atomic
  // snapshot of the caller-approved graph. An R9 SHA is scoped and observed.
  issues.push('SCENE_HISTORICAL_EDGE_SET_NOT_ATOMIC');
  issues.push('SCENE_PAIRED_GALLERY_ROWVERSION_NOT_ATOMIC');
  issues.push('SCENE_GLOBAL_ALL_WRITER_GRAPH_NOT_ACCEPTED');
  return Object.freeze({
    currentCompared: current !== null,
    diagnosticScope: 'AUTHENTICATED_OWNER_ONLY' as const,
    currentOnlyMediaIds: current ? Object.freeze([...current.mediaIds]) : Object.freeze([] as string[]),
    currentCoverMediaId: current?.coverMediaId ?? null,
    historicMediaAvailable: false as const,
    pairedSnapshotIsAtomicFence: false as const,
    historicalEdgeSetIsAtomicFence: false as const,
    saveRevisionAuthorized: false as const,
    blockedReasons: Object.freeze([...new Set(issues)])
  });
}

export interface SceneRevisionConsumerDeps {
  publicQuery: (rpc: string, payload: Record<string, unknown>) => Promise<unknown>;
  ownerReadiness: (presetArtifactId: string) => Promise<unknown>;
  publicMedia: (mediaId: string) => Promise<{ signedUrl: string; mimeType: string | null }>;
}

export function createSceneRevisionGalleryConsumer(deps: SceneRevisionConsumerDeps) {
  async function readCurrent(workId: string): Promise<ScenePublicCurrentRead> {
    if (!validId(workId)) invalid('WEP_SCENE_WORK_ID_INVALID');
    const response = await deps.publicQuery(SCENE_PUBLIC_CURRENT_RPC, { p_work_id: workId });
    return parseScenePublicCurrent(response, workId);
  }

  async function readOwner(presetArtifactId: string): Promise<SceneOwnerReadiness> {
    if (!validId(presetArtifactId)) invalid('WEP_SCENE_OWNER_PRESET_ID_INVALID');
    return parseSceneOwnerReadiness(await deps.ownerReadiness(presetArtifactId), presetArtifactId);
  }

  async function resolveCurrentCover(current: ScenePublicCurrentRead) {
    // No signing historical media. A signed URL is ephemeral; never cache or persist it.
    if (!current.galleryWorkRevisionId || !current.coverMediaId ||
        !current.mediaIds.includes(current.coverMediaId)) {
      invalid('WEP_SCENE_CURRENT_COVER_UNAVAILABLE');
    }
    const result = await deps.publicMedia(current.coverMediaId!);
    const url = typeof result?.signedUrl === 'string' ? result.signedUrl : '';
    if (!url.startsWith('https://') || !/^image\//.test(String(result?.mimeType || ''))) {
      invalid('WEP_SCENE_CURRENT_COVER_INVALID_OR_EXPIRED');
    }
    return Object.freeze({ mediaId: current.coverMediaId, signedUrl: url });
  }

  function previewNewScene(validation: { ok: boolean; presetType?: string }, capture: {
    selectionIds: string[]; includeRoads?: boolean; includeFences?: boolean;
  }) {
    if (!validation?.ok || validation?.presetType !== 'scene' ||
      !Array.isArray(capture?.selectionIds) || capture.selectionIds.length < 1) {
      invalid('WEP_SCENE_REVISION_CAPTURE_NOT_VALIDATED');
    }
    return Object.freeze({
      mode: 'NEW_SCENE' as const,
      capture: Object.freeze({ selectedObjects: capture.selectionIds.length,
        requiredSubGridDescendants: 'CAPTURE_VALIDATOR_OWNED',
        roads: capture.includeRoads === true, fences: capture.includeFences === true }),
      saveRevisionAuthorized: false, pairedGalleryPublishAuthorized: false
    });
  }

  function previewExistingRevision(
    current: ScenePublicCurrentRead, readiness: SceneOwnerReadiness,
    capture: { validation: { ok: boolean; presetType?: string };
      selectionIds: string[]; includeRoads?: boolean; includeFences?: boolean;
      hasRequiredSubGridDescendants: boolean }
  ) {
    if (current.presetArtifactId !== readiness.presetArtifactId ||
      current.workId !== readiness.presetWorkId ||
      current.presetRevisionId !== readiness.currentPresetRevisionId ||
      (readiness.hasAssociatedGallery && (
        current.galleryWorkId !== readiness.pairedGalleryWorkId ||
        current.galleryWorkRevisionId !== readiness.pairedGalleryCurrentWorkRevisionId))) {
      invalid('WEP_SCENE_REVISION_STALE_OR_MISMATCHED_IDENTITY');
    }
    if (!capture.validation?.ok || capture.validation.presetType !== 'scene' ||
      !Array.isArray(capture.selectionIds) || capture.selectionIds.length < 1 ||
      capture.hasRequiredSubGridDescendants !== true) {
      invalid('WEP_SCENE_REVISION_CAPTURE_NOT_VALIDATED');
    }
    return Object.freeze({
      mode: 'EXISTING_SCENE_REVISION' as const,
      presetArtifactId: current.presetArtifactId,
      previousPresetRevisionId: current.presetRevisionId,
      previousGalleryWorkRevisionId: current.galleryWorkRevisionId,
      proposedRevisionNumber: readiness.latestRevisionNumber + 1,
      coverSelection: 'NOT_AUTHORIZED' as const,
      capture: Object.freeze({ selectedObjects: capture.selectionIds.length,
        requiredSubGridDescendants: true, roads: capture.includeRoads === true,
        fences: capture.includeFences === true }),
      blockers: diagnoseSceneRevisionPairing(current, readiness).blockedReasons,
      saveRevisionAuthorized: false,
      pairedGalleryPublishAuthorized: false
    });
  }

  async function saveRevision(): Promise<never> {
    return invalid('WEP_SCENE_REVISION_ATOMIC_WRITER_NOT_AUTHORIZED');
  }
  return Object.freeze({ readCurrent, readOwner, resolveCurrentCover,
    previewNewScene, previewExistingRevision, saveRevision });
}
