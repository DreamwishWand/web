/**
 * 01D read-only Native Item semantic boundary.
 * This is a *structural* save inspector for already-decoded, local, original
 * profiles. It does not authenticate a P1G, BID, an in-game oracle, or a Writer.
 * Only a Core-owned SaveSession may turn an accepted read capability into a UI
 * projection after additional per-operation Native and independent QA gates.
 */
export const ITEM_SEMANTIC_CONTRACT = 'wand.01d.item-semantic-inspection@1';
export const ITEM_PERSONAL_OVERLAY_ENABLED = false;
export const ITEM_WRITER_ENABLED = false;

export const ITEM_SOURCE_TARGETS = Object.freeze({
  switch1250: Object.freeze({
    platform: 'switch', gameVersion: '1.25.0',
    buildId: '52BD625D9B4E0053', profileSchema: 624,
    collectionDefinitionSource: 'SHA_VERIFIED_293_17_256_STATIC_ONLY',
    itemDbSource: '17413_ORIGINAL_SOURCE_RECORDS_NOT_NATIVE_RUNTIME',
    collectionMembership: 'NATIVE_RUNTIME_UNKNOWN'
  }),
  switch1253: Object.freeze({
    platform: 'switch', gameVersion: '1.25.3',
    buildId: '9A239D3DB569756D', profileSchema: 626,
    collectionDefinitionSource: '293_ORIGINAL_PROTOS_BYTE_EQUAL_TO_1250',
    itemDbSource: 'CURRENT_NATIVE_RUNTIME_UNKNOWN',
    collectionMembership: 'NATIVE_RUNTIME_UNKNOWN'
  })
});

// These are the exact source field paths known from existing Source+Save work.
// Unknown paths intentionally stay UNKNOWN rather than being invented.
const OPERATIONS = [
  ['inventory-stock', 'Player.ListInventories[InventoryID].Inventory[CanonicalItemID].Amount', 'STRUCTURAL_READ', 'RAW_INSPECT', 'CAS_PREVIEW_CANDIDATE', 'OFF', 'CANONICAL_ITEM_ROUTING_VARIATION_AND_NATIVE_STOCK'],
  ['furniture-ownership', 'Player.ListInventories / World.GridCollection / World.DiffGrids', 'SOURCE_BOUND', 'PARTIAL', 'OFF', 'OFF', 'PLACED_VS_STORED_AND_NATIVE_VARIATIONS'],
  ['clothing-ownership', 'Player.CollectionSets / Player.ListInventories', 'SOURCE_BOUND', 'PARTIAL', 'OFF', 'OFF', 'UNLOCK_EQUIP_AND_NATIVE_CATEGORY_MAPPING'],
  ['crafting-results', 'CollectionDefinition typed Crafting.RecipeType -> CraftingRecipeItemData.Result.ItemID', 'STATIC_SELECTOR', 'SOURCE_ONLY', 'OFF', 'OFF', 'LIVE_ITEM_DATABASE_AND_RESULT_VALIDATION'],
  ['recipes-unlock', 'UNKNOWN_RECIPE_UNLOCK_PLAYER_FIELD', 'UNKNOWN', 'UNKNOWN', 'OFF', 'OFF', 'SOURCE_FIELD_AND_NATIVE_UNLOCK_CONSUMER'],
  ['memories', 'CollectionDefinition MemoryShard selector / Player.CollectionSets', 'STATIC_SELECTOR', 'RAW_INSPECT', 'OFF', 'OFF', 'MEMORY_PIECE_VS_COMPLETE_AND_NATIVE_ELIGIBILITY'],
  ['touch-of-magic', 'DecorationPresets.Toggle (owner source shape; parent/routing not established)', 'STRUCTURAL_PARTIAL', 'PARTIAL', 'OFF', 'OFF', 'OWNER_PRESET_ID_STYLE_AND_ASSET_RIGHTS'],
  ['collection-collected-raw', 'Player.CollectionSets[].GroupData[].GroupsCollectionItems[ItemID]:bool', 'STRUCTURAL_READ', 'RAW_INSPECT', 'OFF', 'OFF', 'NATIVE_GROUP_ITEM_SET_AND_GAME_DISPLAY'],
  ['premium-entitlement', 'NOT_EXPOSED', 'EXCLUDED', 'EXCLUDED', 'OFF', 'OFF', 'PREMIUM_AUTH_RECEIPTS_ENTITLEMENTS'],
  ['quest-progression', 'NOT_EXPOSED', 'EXCLUDED', 'EXCLUDED', 'OFF', 'OFF', 'MULTI_DOMAIN_NATIVE_PROGRESS']
];
export const ITEM_OPERATION_MATRIX = Object.freeze(OPERATIONS.map(
  ([operation, saveField, read, inspect, preview, write, remainingGate]) =>
    Object.freeze({
      operation, saveField, read, inspect, preview, write,
      remainingGate, publicReleaseEnabled: false, productWriterEnabled: false,
      nativeV3Accepted: false, independentEditedCopyReopenAccepted: false
    })
));

export const ITEM_TYPED_READ_COMMANDS = Object.freeze([
  Object.freeze({name:'Item.GetSourceCatalogDetail', input:'{sourceCatalogRef,itemId,locale,targetBuild}', result:'VERSIONED_REFERENCE_ONLY', authority:'SOURCE_SHA_AND_LOCALE_FENCE'}),
  Object.freeze({name:'Item.InspectCollectionFlag', input:'{sessionHandle,definitionId,groupIndex,itemId}', result:'RAW_SAVE_TRUE_FALSE_ABSENT_ONLY', authority:'CORE_SESSION_REQUIRED'}),
  Object.freeze({name:'Item.InspectInventoryAmount', input:'{sessionHandle,inventoryId,canonicalItemId,compatibleItemType}', result:'RAW_SAVE_AMOUNT_OR_ABSENT_ONLY', authority:'CORE_SESSION_REQUIRED'})
]);
export const ITEM_TYPED_WRITE_CANDIDATES = Object.freeze([
  Object.freeze({
    name:'Item.PreviewInventoryAmountCAS', status:'CANDIDATE_PREVIEW_ONLY',
    readSet:Object.freeze(['original encrypted SHA','decoded JSON SHA','Core Session/Revision/IndexGeneration',
      'ListInventories[InventoryID].CompatibleItemType',
      'Inventory[CanonicalItemID].Amount','canonical variation/ownership route',
      'affected cross-domain references and Native quantity rules']),
    command:'Item.SetInventoryAmountCAS',
    commitAuthorized:false, backupRequired:true, fullDocumentValidationRequired:true,
    oldValueAndRevisionCasRequired:true, exactDiffOnly:true,
    unknownFieldsPreserved:true, independentEditedCopyReopenRequired:true,
    nativeV3Required:true, independentQaRequired:true,
    noOriginalOverwrite:true
  })
]);

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const unsigned = value => Number.isSafeInteger(value) && value >= 0;
const key = value => String(value);
const denied = (code, extra={}) => Object.freeze({
  schema:ITEM_SEMANTIC_CONTRACT, status:'BLOCKED', code,
  owned:'UNKNOWN', discovered:'UNKNOWN', missing:'UNKNOWN',
  denominator:null, numerator:null, writerAuthorized:false, ...extra
});
function sourceIdentity(profile, identity) {
  if (!object(profile) || !object(profile.GameInfo) || !object(profile.Player) || !object(identity))
    return null;
  if (identity.sourcePlatform !== 'switch' || identity.platform !== 'switch')
    return null;
  const target = Object.values(ITEM_SOURCE_TARGETS).find(v =>
    identity.gameVersion === v.gameVersion &&
    identity.buildId === v.buildId &&
    identity.profileSchema === v.profileSchema
  );
  if (!target || profile.GameInfo.Version !== target.profileSchema) return null;
  // The BID is *external information*; neither this profile nor this function
  // proves an installed game's BID or the original package source.
  return target;
}

function base(target, saveObserved) {
  return {
    schema:ITEM_SEMANTIC_CONTRACT, status:'RAW_SAVE_STRUCTURE_ONLY',
    target:Object.freeze({platform:target.platform,gameVersion:target.gameVersion,
      buildId:target.buildId,profileSchema:target.profileSchema}),
    sourceIdentityAttestedByInspector:false,
    nativeItemDatabaseObserved:false, nativeGroupComplete:false,
    itemAvailabilityObserved:false, canonicalVariationProven:false,
    owned:'UNKNOWN', discovered:'UNKNOWN', missing:'UNKNOWN',
    denominator:null, numerator:null, personalCollectionDisplayAuthorized:false,
    writerAuthorized:false, backendStorageAuthorized:false,
    saveObserved
  };
}

/** Exact array-definition lookup, never treat DefinitionID as an array index. */
export function inspectCollectionSaveFlag({profile, identity, definitionId, groupIndex=0, itemId}={}) {
  const target=sourceIdentity(profile,identity);
  if (!target) return denied('EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED');
  if (!positive(definitionId) || !unsigned(groupIndex) || groupIndex>256 || !positive(itemId))
    return denied('COLLECTION_KEY_INVALID');
  const sets=profile.Player.CollectionSets;
  if (!Array.isArray(sets) || sets.length>10000) return denied('COLLECTION_SETS_MISSING_OR_UNBOUNDED');
  let match=null;
  for (const entry of sets) {
    if (!positive(entry?.CollectionDefinitionID)) return denied('COLLECTION_DEFINITION_ROW_INVALID');
    if (entry.CollectionDefinitionID!==definitionId) continue;
    if (match!==null) return denied('COLLECTION_DUPLICATE_DEFINITION');
    match=entry;
  }
  if (!match) return Object.freeze({
    ...base(target,false), collectionDefinitionId:definitionId, groupIndex,
    itemId, rawFlag:'ABSENT_DEFINITION'
  });
  if (!Array.isArray(match.GroupData) || match.GroupData.length>257)
    return denied('COLLECTION_GROUP_DATA_UNVERIFIED');
  const group=match.GroupData[groupIndex];
  if (!object(group) || !object(group.GroupsCollectionItems))
    return Object.freeze({...base(target,false),collectionDefinitionId:definitionId,
      groupIndex,itemId,rawFlag:'ABSENT_GROUP'});
  if (group.GroupIndex !== undefined && group.GroupIndex !== groupIndex)
    return denied('COLLECTION_GROUP_INDEX_CONFLICT');
  const items=group.GroupsCollectionItems;
  if (!Object.hasOwn(items,key(itemId)))
    return Object.freeze({...base(target,false),collectionDefinitionId:definitionId,
      groupIndex,itemId,rawFlag:'ABSENT_ITEM_ENTRY'});
  const flag=items[key(itemId)];
  if (typeof flag!=='boolean') return denied('COLLECTION_BOOLEAN_FIELD_INVALID');
  return Object.freeze({...base(target,true),collectionDefinitionId:definitionId,
    groupIndex,itemId,rawFlag:flag?'SAVE_BOOL_TRUE':'SAVE_BOOL_FALSE'});
}

/** No automatic map-entry-absent => amount:0; no guess from displayed ItemID. */
export function inspectInventoryAmount({profile, identity, inventoryId, canonicalItemId, compatibleItemType}={}) {
  const target=sourceIdentity(profile,identity);
  if (!target) return denied('EXACT_ORIGINAL_BUILD_AND_SCHEMA_REQUIRED');
  if (!unsigned(inventoryId) || !positive(canonicalItemId) ||
      !unsigned(compatibleItemType))
    return denied('CANONICAL_INVENTORY_ROUTE_NOT_SPECIFIED');
  const all=profile.Player.ListInventories;
  if (!object(all)) return denied('LIST_INVENTORIES_MISSING');
  const inv=all[key(inventoryId)];
  if (!object(inv) || !object(inv.Inventory))
    return Object.freeze({...base(target,false),inventoryId,canonicalItemId,
      rawAmount:null, rawEntry:'ABSENT_INVENTORY'});
  if (inv.CompatibleItemType!==compatibleItemType)
    return denied('INVENTORY_COMPATIBLE_ITEM_TYPE_MISMATCH');
  if (!Object.hasOwn(inv.Inventory,key(canonicalItemId)))
    return Object.freeze({...base(target,false),inventoryId,canonicalItemId,
      rawAmount:null,rawEntry:'ABSENT_ITEM_ENTRY'});
  const stock=inv.Inventory[key(canonicalItemId)];
  if (!object(stock) || !unsigned(stock.Amount))
    return denied('INVENTORY_AMOUNT_FIELD_INVALID');
  return Object.freeze({...base(target,true),inventoryId,canonicalItemId,
    compatibleItemType,rawAmount:stock.Amount,rawEntry:'PRESENT'});
}

/** An inert operation candidate: this function cannot mutate a save or authorize export. */
export function previewInventoryAmountCAS({inspection,expectedOldAmount,nextAmount}={}) {
  if (inspection?.schema!==ITEM_SEMANTIC_CONTRACT ||
      inspection?.status!=='RAW_SAVE_STRUCTURE_ONLY' ||
      inspection?.rawEntry!=='PRESENT' ||
      !unsigned(expectedOldAmount) || !unsigned(nextAmount) ||
      inspection.rawAmount!==expectedOldAmount)
    return denied('INVENTORY_PREVIEW_OLD_VALUE_OR_SOURCE_UNVERIFIED');
  if (nextAmount>2147483647) return denied('INVENTORY_PREVIEW_BOUNDS');
  if (nextAmount===expectedOldAmount) return denied('INVENTORY_PREVIEW_NO_OP');
  return Object.freeze({
    schema:ITEM_SEMANTIC_CONTRACT,status:'HYPOTHETICAL_CAS_PREVIEW_ONLY',
    inventoryId:inspection.inventoryId,canonicalItemId:inspection.canonicalItemId,
    compatibleItemType:inspection.compatibleItemType,
    expectedOldAmount,nextAmount,
    fullDocumentDiffVerified:false,sourceRevisionVerified:false,
    sourceIdentityAttested:false,nativeV3Accepted:false,
    crossDomainReferencesVerified:false,independentEditedCopyReopenAccepted:false,
    writerAuthorized:false,exportAuthorized:false,noOriginalOverwrite:true
  });
}
