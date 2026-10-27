export type ProviderEvidenceClass =
  'PROVIDER_CAPABILITY_UNPROVEN' |
  'LOCAL_PROVIDER_OBJECT_OBSERVED_UNATTESTED' |
  'PROVIDER_OBJECT_QUARANTINED';

export type ImmutableObject = {
  bytes: Uint8Array;
  version: string;
  etag: string;
};
export type ConditionalCopyReceipt = {
  created: boolean;
  version: string;
  etag: string;
};

export interface ImmutableCopyProvider {
  readonly capabilities: {
    readonly createIfAbsentAtomic: boolean;
    readonly immutableVersionRead: boolean;
    readonly conditionalSourceVersion: boolean;
  };
  readVersion(key: string, expectedVersion?: string): Promise<ImmutableObject | null>;
  copyIfAbsent(sourceKey: string, sourceVersion: string, destinationKey: string): Promise<ConditionalCopyReceipt>;
}

export type PromotionFence = {
  reservationId: string;
  ownerAccountId: string;
  creatorProfileId: string;
  idempotencyKey: string;
  requestHash: string;
  leaseToken: string;
  leaseFence: bigint;
  stateVersion: bigint;
  stagingKey: string;
  publishedKey: string;
  stagingVersion: string;
  checksumSha256: string;
  byteSize: number;
};

export type ConditionalCopyAttempt = {
  state: 'CAPABILITY_BLOCKED' | 'LEASE_STALE' | 'STAGING_MISMATCH' |
    'DESTINATION_CONFLICT' | 'COPY_OUTCOME_UNKNOWN' | 'VERSION_DRIFT' |
    'COPY_OBSERVED_UNATTESTED';
  evidenceClass: ProviderEvidenceClass;
  publicationAuthorized: false;
  physicalCleanupAuthorized: false;
  copyMayHaveSucceeded: boolean;
  objectVersion?: string;
  objectETag?: string;
  downloadedSha256?: string;
  downloadedSize?: number;
};

function blocked(
  state: ConditionalCopyAttempt['state'],
  copyMayHaveSucceeded = false
): ConditionalCopyAttempt {
  return {
    state,
    evidenceClass: copyMayHaveSucceeded
      ? 'PROVIDER_OBJECT_QUARANTINED'
      : 'PROVIDER_CAPABILITY_UNPROVEN',
    publicationAuthorized: false,
    physicalCleanupAuthorized: false,
    copyMayHaveSucceeded
  };
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

function validFence(v: PromotionFence): boolean {
  return !!(
    v.reservationId && v.ownerAccountId && v.creatorProfileId &&
    v.idempotencyKey && v.leaseToken && v.requestHash &&
    /^[0-9a-f]{64}$/.test(v.checksumSha256) &&
    v.byteSize > 0 && Number.isSafeInteger(v.byteSize) &&
    v.leaseFence > 0n && v.stateVersion > 0n &&
    v.stagingKey.startsWith('staging/' + v.ownerAccountId + '/') &&
    v.publishedKey.startsWith('published/' + v.ownerAccountId + '/') &&
    v.stagingVersion.length > 0 &&
    v.publishedKey !== v.stagingKey
  );
}

/**
 * Unrouted, source-only Provider driver. A positive result means a real
 * immutable object was observed, NOT provider-origin independent attestation.
 * No DB, public Edge, Storage.remove or private commit entrypoint calls.
 */
export async function inspectConditionalPromotion(
  provider: ImmutableCopyProvider,
  fence: PromotionFence,
  isCurrentLease: (f: PromotionFence) => Promise<boolean>
): Promise<ConditionalCopyAttempt> {
  const c = provider.capabilities;
  if (!c?.createIfAbsentAtomic || !c.immutableVersionRead || !c.conditionalSourceVersion ||
      !validFence(fence)) return blocked('CAPABILITY_BLOCKED');
  if (!await isCurrentLease(fence)) return blocked('LEASE_STALE');

  let source: ImmutableObject | null;
  try {
    source = await provider.readVersion(fence.stagingKey, fence.stagingVersion);
  } catch {
    return blocked('STAGING_MISMATCH');
  }
  if (!source || source.version !== fence.stagingVersion ||
      source.bytes.byteLength !== fence.byteSize ||
      await sha256(source.bytes) !== fence.checksumSha256) return blocked('STAGING_MISMATCH');

  if (!await isCurrentLease(fence)) return blocked('LEASE_STALE');
  // Do not check destination then issue a non-conditional copy. Only the
  // provider itself can atomically prevent a competing writer's overwrite.
  let receipt: ConditionalCopyReceipt;
  try {
    receipt = await provider.copyIfAbsent(fence.stagingKey, source.version, fence.publishedKey);
  } catch {
    // Timeouts and 5xx may occur after the provider committed a Copy.
    // Never compensate with physical remove or blindly retry.
    return blocked('COPY_OUTCOME_UNKNOWN', true);
  }
  if (!receipt?.created) return blocked('DESTINATION_CONFLICT', true);
  if (!receipt.version || !receipt.etag) return blocked('COPY_OUTCOME_UNKNOWN', true);

  if (!await isCurrentLease(fence)) return blocked('LEASE_STALE', true);
  let published: ImmutableObject | null;
  try {
    published = await provider.readVersion(fence.publishedKey, receipt.version);
  } catch {
    return blocked('COPY_OUTCOME_UNKNOWN', true);
  }
  if (!published || published.version !== receipt.version || published.etag !== receipt.etag)
    return blocked('VERSION_DRIFT', true);
  const digest = await sha256(published.bytes);
  if (digest !== fence.checksumSha256 || published.bytes.byteLength !== fence.byteSize)
    return blocked('VERSION_DRIFT', true);

  // Independent Provider-origin attestor does not exist in this module.
  // Never convert this observation into Source135 PROVIDER_ATTESTED.
  return {
    state: 'COPY_OBSERVED_UNATTESTED',
    evidenceClass: 'LOCAL_PROVIDER_OBJECT_OBSERVED_UNATTESTED',
    publicationAuthorized: false,
    physicalCleanupAuthorized: false,
    copyMayHaveSucceeded: true,
    objectVersion: published.version,
    objectETag: published.etag,
    downloadedSha256: digest,
    downloadedSize: published.bytes.byteLength
  };
}

export type CommittedObjectExpectation = {
  publishedKey: string;
  objectVersion: string;
  etag: string;
  checksumSha256: string;
  byteSize: number;
};
export type CommittedObjectObservation = {
  state: 'RECONCILIATION_CAPABILITY_BLOCKED' | 'POST_COMMIT_MISSING' |
    'POST_COMMIT_VERSION_DRIFT' | 'PUBLISHED_OBJECT_OBSERVED_UNATTESTED';
  evidenceClass: ProviderEvidenceClass;
  providerOriginAttested: false;
  publicationAuthorized: false;
  physicalCleanupAuthorized: false;
};

/** Read-only postcommit detection; incident reporting remains a separate
 * fenced, signed-actor Source137 RPC. No automatic unpublish or physical delete.
 */
export async function inspectPostCommitObject(
  provider: ImmutableCopyProvider,
  expected: CommittedObjectExpectation
): Promise<CommittedObjectObservation> {
  const common = {providerOriginAttested:false,publicationAuthorized:false,
    physicalCleanupAuthorized:false} as const;
  if (!provider.capabilities?.immutableVersionRead || !expected.objectVersion ||
      !expected.etag || !/^[0-9a-f]{64}$/.test(expected.checksumSha256) ||
      !Number.isSafeInteger(expected.byteSize) || expected.byteSize<=0) {
    return {...common,state:'RECONCILIATION_CAPABILITY_BLOCKED',
      evidenceClass:'PROVIDER_CAPABILITY_UNPROVEN'};
  }
  let obj: ImmutableObject | null;
  try {
    obj = await provider.readVersion(expected.publishedKey,expected.objectVersion);
  } catch {
    return {...common,state:'POST_COMMIT_MISSING',evidenceClass:'PROVIDER_OBJECT_QUARANTINED'};
  }
  if (!obj) return {...common,state:'POST_COMMIT_MISSING',
    evidenceClass:'PROVIDER_OBJECT_QUARANTINED'};
  if (obj.version!==expected.objectVersion || obj.etag!==expected.etag ||
      obj.bytes.byteLength!==expected.byteSize ||
      await sha256(obj.bytes)!==expected.checksumSha256) {
    return {...common,state:'POST_COMMIT_VERSION_DRIFT',
      evidenceClass:'PROVIDER_OBJECT_QUARANTINED'};
  }
  return {...common,state:'PUBLISHED_OBJECT_OBSERVED_UNATTESTED',
    evidenceClass:'LOCAL_PROVIDER_OBJECT_OBSERVED_UNATTESTED'};
}
