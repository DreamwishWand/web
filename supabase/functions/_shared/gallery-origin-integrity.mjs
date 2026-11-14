/**
 * #124 Gallery Storage-origin reconciliation is operator telemetry, not a
 * physical-delete permission. A missing/malformed RPC payload must never be
 * reported as "normal". Count fields must be actual JSON integers: coercing
 * null, strings, NaN or omitted keys to zero hides reconciliation failures.
 *
 * Keep this helper pure so both the Deno Retention Edge and Node CI exercise
 * the same decision. No owner identifiers, keys or signed URLs are used.
 */
const REQUIRED_COUNTS = Object.freeze([
  'originObjectCount',
  'originJournaledObjectCount',
  'originRegisteredObjectCount',
  'originUntrackedObjectCount',
  'originMetadataRecordedBytes',
  'originMetadataSizeUnknownCount',
  'untrackedOriginBytes',
  'journaledUnregisteredObjectCount',
  'registeredWithoutGalleryIntentCount',
  'registeredOriginSizeMismatchCount',
  'finalizedReadyMissingOriginCount',
  'abortedOriginWaitingRemovalCount'
]);

export function classifyGalleryOriginIntegrity(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
      snapshot.contract !== 'ddv.gallery-storage-reconciliation@1' ||
      snapshot.bucketChecked !== true ||
      snapshot.safeToAutoDelete !== false) {
    return 'unknown';
  }

  for (const key of REQUIRED_COUNTS) {
    const value = snapshot[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      return 'unknown';
    }
  }

  const origin = snapshot.originObjectCount;
  if (snapshot.originRegisteredObjectCount > origin ||
      snapshot.originJournaledObjectCount > origin ||
      snapshot.originUntrackedObjectCount > origin ||
      snapshot.originMetadataSizeUnknownCount > origin ||
      snapshot.registeredWithoutGalleryIntentCount > snapshot.originRegisteredObjectCount ||
      snapshot.registeredOriginSizeMismatchCount > snapshot.originRegisteredObjectCount ||
      snapshot.journaledUnregisteredObjectCount > snapshot.originJournaledObjectCount) {
    return 'unknown';
  }

  if (snapshot.originUntrackedObjectCount > 0 ||
      snapshot.registeredOriginSizeMismatchCount > 0 ||
      snapshot.finalizedReadyMissingOriginCount > 0) {
    return 'critical';
  }

  // Unknown origin-object sizes mean a clean byte-level comparison is not proven.
  if (snapshot.originMetadataSizeUnknownCount > 0) return 'unknown';
  return 'normal';
}
