/**
 * 01E CORE / W-NATIVE-005 — version-pinned Native W1 SOURCE evidence only.
 *
 * Intentionally NOT a SaveSession read, Native runtime oracle, writer command,
 * or capability mint. Caller-provided registry data and receipts never authorize
 * edits. This module records the exact event-to-item direction and the known
 * inverse collision, so a future Core/Native consumer cannot select a producer
 * from ItemID alone or mistake complete source roots for Native V3.
 */
export const W1_V3_SOURCE_CONTRACT = 'wand.01e.w1-native-v3-source-evidence@1';
export const W1_SOURCE_TARGET = Object.freeze({
  platform: 'Nintendo Switch', version: '1.25.3',
  bid: '9A239D3DB569756D', schema: 626,
  eventId: 2010000021, savedMapKey: '155', oneof: 'ItemSpawning',
  itemId: 31700014, sourceName: 'Wood!Wetland_Softwood',
  originalRomfsEventSha256: '028a206635d37bffd7f3a8ff820958bdaa201887bacf35e10faa8328d20022ea',
  staticRegistryGitBlob: 'd8a4031a20369e2ba70cb143dec178b73254eff8'
});

/** These came from a separate same-BID 01B ELF/RomFS STATIC audit, NOT game execution. */
export const W1_NATIVE_STATIC_DEPENDENCIES = Object.freeze({
  areaName: 'Wetland1', villageAreaType: 1, sceneName: 'Village!Village04', sceneId: 1540000000,
  placementTag: 'Tree!Any', tagId: 2001200008, radius: 4,
  minSpawns: 1, maxSpawns: 2, basicMaximum: 8,
  durationSeconds: 480, overdueMaximumSeconds: 3840,
  originalEventRecordSha256: '8c9aff67e6b82c7c31db360858a6dc3b5d27ad80550427fea29f84b3158b492a',
  originalTagRecordSha256: '7c1d572eeb4563fd0c02d397deeab3704490ece37497d99873b70c55a03e6c07',
  originalSceneRecordSha256: 'b37b65feb8cc0055fba7a7cca6ac0b90e4e4358fcadb2b8bb09f29a33dea4936',
  gridReadPrecedence: 'Grids_THEN_DiffGrids',
  effectiveGrid: 'DEFAULT_PLUS_MODIFIED_MINUS_REMOVED_NOT_YET_PROVEN_FOR_REAL_SAVE',
  conditions: 'EMPTY_AND_TRUE_SOURCE_ONLY',
  evidenceClass: 'SOURCE_ONLY', nativeV3Accepted: false
});

const expectedReferrers = Object.freeze([
  [2010000021, true], [2010000022, true],
  [2010000024, true], [2010000025, true],
  [2010000099, false], [2010000121, false],
  [2010000122, false], [2010000123, false]
]);
const isRecord = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fixed = x => Object.freeze(x);
const deny = code => fixed({
  contract: W1_V3_SOURCE_CONTRACT, status: 'SOURCE_UNAVAILABLE', reason: code,
  sourceEventToItemMatched: false, itemIdUniqueProducer: false,
  nativeV3Accepted: false, completeOperationReadSetAccepted: false,
  productWriterAuthorized: false, editedCopyAuthorized: false,
  automaticDateRepairAuthorized: false
});

/**
 * Pure source-corpus audit. It does not authenticate the registry's bytes;
 * the caller must verify the ORIGINAL Git blob and external installed BID.
 * `claim` is accepted only as untrusted input: it cannot set any grant bit.
 */
export function inspectW1StaticRegistry(registry, claim = {}) {
  if (!isRecord(registry) || registry.schema !== 'wand.timing.recurring-registry@1' ||
      !isRecord(registry.source) || !Array.isArray(registry.events))
    return deny('REGISTRY_SHAPE_UNVERIFIED');
  const s = registry.source;
  if (s.version !== W1_SOURCE_TARGET.version || s.buildId !== W1_SOURCE_TARGET.bid ||
      s.schema !== W1_SOURCE_TARGET.schema ||
      s.rawEventSHA256 !== W1_SOURCE_TARGET.originalRomfsEventSha256 ||
      s.writerAuthorization !== false)
    return deny('EXACT_ROMFS_VERSION_AND_SOURCE_IDENTITY_REQUIRED');
  if (registry.events.length !== 508)
    return deny('SOURCE_EVENT_CORPUS_CARDINALITY_CHANGED');
  const byId = new Map();
  for (const row of registry.events) {
    if (!isRecord(row) || !Number.isSafeInteger(row.id) || byId.has(row.id) ||
        !Array.isArray(row.items)) return deny('EVENT_ID_OR_ITEMS_INVALID_OR_DUPLICATE');
    byId.set(row.id, row);
  }
  const target = byId.get(W1_SOURCE_TARGET.eventId);
  if (!target || target.name !== W1_SOURCE_TARGET.sourceName ||
      target.eventPolicy !== 'W1' || target.active !== true ||
      target.items.length !== 1 || target.items[0]?.id !== W1_SOURCE_TARGET.itemId)
    return deny('TARGET_EVENT_TO_ITEM_FORWARD_REFERENCE_CHANGED');
  const referrers = [...byId.values()]
    .filter(row => row.items.some(item => item?.id === W1_SOURCE_TARGET.itemId))
    .sort((a, b) => a.id - b.id)
    .map(row => [row.id, row.active]);
  if (referrers.length !== expectedReferrers.length ||
      referrers.some((x, i) => x[0] !== expectedReferrers[i][0] ||
                              x[1] !== expectedReferrers[i][1]))
    return deny('SOFTWOOD_ITEM_ID_INVERSE_REFERENCE_SET_CHANGED');
  return fixed({
    contract: W1_V3_SOURCE_CONTRACT,
    status: 'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH',
    evidenceClass: 'SOURCE_ONLY',
    sourceEventToItemMatched: true, sourceEventId: target.id,
    savedMapKey: W1_SOURCE_TARGET.savedMapKey,
    sourceItemId: W1_SOURCE_TARGET.itemId,
    referrerEventIds: fixed(referrers.map(x => x[0])),
    activeReferrerCount: referrers.filter(x => x[1]).length,
    itemIdUniqueProducer: false, reverseItemIdLookupAuthorized: false,
    sourceBlobAuthenticatedByThisFunction: false,
    installedBidAuthenticatedByThisFunction: false,
    // Even an attacker-supplied `claim` with all flags=true has no effect.
    callerClaimsIgnored: isRecord(claim),
    nativeV3Accepted: false, completeOperationReadSetAccepted: false,
    nativeClockAndColdLoadObserved: false, effectiveWetlandGridAndQuotaObserved: false,
    productWriterAuthorized: false, editedCopyAuthorized: false,
    automaticDateRepairAuthorized: false
  });
}

/**
 * Operation-specific gate ledger; no way to mint the Native V3 capability
 * from public/source-only metadata. Use the Rust Core for trusted source CAS.
 */
export function describeW1NativeV3Gaps(staticReceipt) {
  if (staticReceipt?.contract !== W1_V3_SOURCE_CONTRACT ||
      staticReceipt.status !== 'VERSION_PINNED_REGISTRY_SOURCE_SHAPE_MATCH' ||
      staticReceipt.sourceEventToItemMatched !== true)
    return deny('ORIGINAL_W1_STATIC_SOURCE_NOT_MATCHED');
  return fixed({
    contract: W1_V3_SOURCE_CONTRACT,
    status: 'NATIVE_V3_OUTSTANDING',
    sourceEventId: W1_SOURCE_TARGET.eventId,
    savedMapKey: W1_SOURCE_TARGET.savedMapKey,
    proposedEditedField: '/World/RecurringEvents/155/ItemSpawning/NextOccurrence',
    sourceStaticFacts: W1_NATIVE_STATIC_DEPENDENCIES,
    requiredSourceClosures: fixed([
      'AUTHENTIC_SAME_BID_NATIVE_REGISTRY_AND_ENUM_WETLAND1_TO_SAVE_AREA_KEY',
      'SAME_REVISION_WETLAND_VILLAGE_AREA_GRIDIDS_AND_OPENS',
      'GRID_DEFAULT_LAYOUT_BYTES_SHA_AND_GRID_DIFF_OVERLAY',
      'ACTUAL_TREE_ANCHOR_TAG_AND_ELIGIBLE_POSITION_COLLISION',
      'ACTUAL_SOFTWOOD_OWNER_GROUP_QUOTA_NOT_ITEMID_REVERSE_LOOKUP',
      'QUEST_DLC_AND_EVENT_CONDITION_RUNTIME_DEPENDENCY'
    ]),
    requiredNativeOutcomes: fixed([
      'NATIVE_CLOCK_HOST_NOW_AND_STARTUP_ACTUALIZE_BRANCH',
      'NATIVE_EXECUTE_RPC_EFFECT_ACCEPTED_OR_DENIED',
      'LAST_OCCURRENCE_TO_RESCHEDULE_NEXT_AND_COLD_SAVE_REOPEN'
    ]),
    changedFieldsAllowedIfSeparatelyAccepted: fixed([
      '/World/RecurringEvents/155/ItemSpawning/NextOccurrence'
    ]),
    changesCurrentlyAuthorized: fixed([]),
    nativeV3Accepted: false, nativeRuntimeObserved: false,
    originalOverwriteAuthorized: false, editedCopyAuthorized: false,
    productWriterAuthorized: false, automaticDateRepairAuthorized: false,
    deviceV4Done: false
  });
}
