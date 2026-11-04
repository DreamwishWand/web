// 01A W-CORE-004: W1 source-readset is derived inside the Worker from a
// FULLY decoded/validated Save. Caller-supplied references are never accepted.
// This is a bounded READ diagnostic, NOT a native V3 or Writer witness.
export const W1_MANDATORY_REFERENCE_IDS = Object.freeze([
  'GameInfo.Version',
  'World.RecurringEvents.155.ItemSpawning.RecurringEventItemID',
  'World.RecurringEvents.155.ItemSpawning.NextOccurrence',
  'World.RecurringEvents.155.ItemSpawning.LastOccurrence',
  'World.RecurringEvents.155.ItemSpawning.EndDate',
  'World.GridCollection.Grids',
  'World.GridCollection.DiffGrids',
  'World.Villages'
]);
export const W1_SOURCE_READSET_CONTRACT = 'wand.local.w1-core-source-readset@1';
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const utc = v => typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v);
/** No caller read-set parameter; immutable operation-owned mandatory roots. */
export function deriveW1RequiredSourceReadSet(profile) {
  const world = isRecord(profile?.World) ? profile.World : null;
  const gameInfo = isRecord(profile?.GameInfo) ? profile.GameInfo : null;
  const collection = isRecord(world?.GridCollection) ? world.GridCollection : null;
  const saved = isRecord(world?.RecurringEvents) ? world.RecurringEvents : null;
  const container = isRecord(saved?.['155']) ? saved['155'] : null;
  const event = isRecord(container?.ItemSpawning) ? container.ItemSpawning : null;
  const present = [
    gameInfo?.Version === 626,
    event?.RecurringEventItemID === 2010000021,
    utc(event?.NextOccurrence),
    utc(event?.LastOccurrence),
    utc(event?.EndDate),
    isRecord(collection?.Grids),
    isRecord(collection?.DiffGrids),
    Array.isArray(world?.Villages)
  ];
  const missingReferences = Object.freeze(
    W1_MANDATORY_REFERENCE_IDS.filter((_, i) => !present[i])
  );
  return Object.freeze({
    contract: W1_SOURCE_READSET_CONTRACT,
    operation: 'W1_ITEMSPAWNING_NEXT_OCCURRENCE_DIAGNOSTIC',
    referenceCount: W1_MANDATORY_REFERENCE_IDS.length,
    presentCount: present.filter(Boolean).length,
    allSourceReferencesPresent: missingReferences.length === 0,
    missingReferences,
    // All eight references being present still does NOT prove the native
    // effective Area/Default+DiffGrids/Tree/quota/clock dependency graph.
    sameBuildNativeRegistryAccepted: false,
    effectiveWorldDependenciesVerified: false,
    clockActualizeVerified: false,
    completeNativeDependencyClosureVerified: false,
    operationWriterAuthorized: false
  });
}
