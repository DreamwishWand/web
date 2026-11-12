/**
 * 01E CORE / W-NATIVE-005 / R09 — Operation-scoped static Native handoff.
 *
 * SOURCE_ONLY. This is not a game binary decompiler, Rust ProductSession,
 * independent QA oracle, Native V3 certificate, or Writer/Export capability.
 * Tier A means an isolated candidate can be investigated without waiting for
 * unrelated W1/RoadFence work. It does NOT mean no Native recomputation.
 * Caller-supplied receipts and claimed proof may not authorize any mutation.
 */
export const OPERATION_NATIVE_STATIC_GATE = 'wand.01e.native-operation-static-gate@1';
export const NATIVE_PRODUCT_WRITER_ENABLED = false;
export const NATIVE_STATIC_V3_ACCEPTED = false;

export const NATIVE_SOURCE_TARGETS = Object.freeze({
  switch1253: Object.freeze({platform:'switch',buildKind:'switch-bid',
    buildId:'9A239D3DB569756D',gameVersion:'1.25.3',schema:626}),
  steam1253: Object.freeze({platform:'steam-windows',buildKind:'steam-full-version',
    buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
    gameVersion:'1.25.3',schema:626})
});

const freeze = Object.freeze;
const row = (id,tier,owner,source,requires,unresolved=[]) => freeze({
  operationId:id,tier,owner,saveSource:source,
  requiredStaticEvidence:freeze([...requires]),
  unresolvedNativeDependencies:freeze([...unresolved]),
  nativeConsumerVerified:false,nativeProducerVerified:false,
  nativeRecomputeVerified:false,nativeV3Accepted:false,
  writerAuthorized:false,editedCopyAuthorized:false,productEnabled:false
});
const A='A_CANDIDATE',B='B_NATIVE_RECOMPUTE',C='C_PROTECTED';
const CORE=freeze(['SINGLE_CORE_SESSION','INDEXED_TYPED_READSET','OLD_VALUE_REVISION_CAS','ATOMIC_EXACT_DIFF','INDEPENDENT_REOPEN']);
const game=freeze(['EXACT_SAME_BUILD_SOURCE','NATIVE_CONSUMER_CALLGRAPH','NATIVE_PRODUCER_CALLGRAPH','DERIVED_STATE_AND_NEGATIVES']);

/** The canonical Board operation IDs. Paths not verified by accepted sources remain UNKNOWN. */
export const NATIVE_OPERATION_ROWS = freeze([
  row('INV_AMOUNT',A,'01D/01A','Player.ListInventories[InventoryID].Inventory[CanonicalItemID].Amount',
    [...CORE,'EXISTING_ROW_AND_CANONICAL_ITEM_ROUTE','COMPATIBLE_ITEM_TYPE','NATIVE_STACK_LIMIT_ZERO_DEPLETION_AND_DEPENDENCIES'],
    ['VARIATION_ROUTING','ZERO_AMOUNT_EFFECT','NATIVE_STACK_MAX','QUEST_OR_CRAFTING_REFERENCES']),
  row('INV_SLOT',B,'01D/01A','Player.ListInventories[InventoryID].Inventory',
    [...CORE,...game,'SLOT_CAPACITY_OWNERSHIP_PROOF'],['NEW_ROW_AND_ID_ROUTE']),
  row('INV_MOVE',A,'01D/01A','Player.ListInventories[InventoryID].Inventory',
    [...CORE,'SOURCE_DESTINATION_SLOTS','ATOMIC_TWO_SLOT_DIFF','NATIVE_CAPACITY_AND_SIDE_EFFECTS'],['DUPLICATE_OR_MISSING_SLOT']),
  row('CHEST_AMOUNT',A,'01D/01A','Player.ContainerInventories / Player.ListInventories (exact chest slot path not verified)',
    [...CORE,'EXISTING_CHEST_CONTAINER_BINDING','CHEST_SLOT_AMOUNT_PATH','STACK_LIMIT'],['CONTAINER_ITEM_LINK','SOURCE_SCHEMA626_ROUTE']),
  row('CHEST_TRANSFER',B,'01D/01E','Player.ContainerInventories / Player.ListInventories',
    [...CORE,...game,'TWO_CONTAINER_REFERENCES','CAPACITY_COST'],['NATIVE_ATOMIC_TRANSFER']),
  row('FURNITURE_STORAGE',B,'01B/01D','World.GridCollection + Player.ContainerInventories',
    [...CORE,...game,'GRID_OBJECT_CONTAINER_REFS','ACTIVE_ORPHAN_REFERENCE','STORAGE_VARIATION'],['SCHEMA624_TO_626_NONPORTABILITY']),
  row('OWNERSHIP_LOCAL',B,'01D/01E','Player.CollectionSets / Player.ListInventories (owned truth UNKNOWN)',
    [...CORE,...game,'LOCAL_OWNERSHIP_NATIVE_SOURCE','SERVER_RIGHTS_SEPARATION'],['OWNED_VS_RAW_COLLECTION_BOOL']),
  row('APPEARANCE',A,'01D/06PRODUCT','UNKNOWN_PART_OR_COLOR_SAVE_PATH',
    [...CORE,'SAME_BUILD_NATIVE_PART_ENUM','ACTUAL_SAVE_FIELD_PATH','COMPATIBLE_PART_COMBINATIONS'],['NATIVE_PRESET_DEPENDENCIES']),
  row('WARDROBE',A,'01D/06PRODUCT','UNKNOWN_EQUIPPED_WARDROBE_SAVE_PATH',
    [...CORE,'ACTUAL_EQUIPPED_SAVE_FIELD_PATH','OWNED_ITEMID','EQUIP_SLOT_COMPATIBILITY'],['EQUIP_SIDE_EFFECTS']),
  row('SKIN_SELECT',B,'01D/01E','UNKNOWN_SKIN_SELECTION_PATH',
    [...CORE,...game,'EXISTING_SKIN_OWNERSHIP','SELECT_VS_UNLOCK_SEPARATION'],['SKIN_SELECTION_SIDE_EFFECTS']),
  row('SKIN_UNLOCK',C,'01D/03COMM','SERVER_ENTITLEMENT_OR_LOCAL_REWARD_UNRESOLVED',
    ['RIGHTS_AND_ENTITLEMENT_AUTHORITY'],['PREMIUM_OR_DLC_MUTATION_PROHIBITED']),
  row('TIME_SIMPLE',A,'01E/01A','UNKNOWN_INDEPENDENT_DATETIME_FIELD',
    [...CORE,'EXACT_LEXICAL_TIME_UNIT_RANGE','NO_LINKED_EVENT_OR_CLOCK_CONSUMER','DATE_PROVENANCE'],['DEPENDENCY_INDEPENDENCE_UNPROVEN']),
  row('TIME_EVENT',B,'01E/01A','World.RecurringEvents[mapKey] / event-specific oneof',
    [...CORE,...game,'CLOCK_ACTUALIZE_EXECUTE_RESCHEDULE_CHAIN','LAST_NEXT_RECUR_COUNT','EXACT_MAP_KEY_TO_EVENT_BINDING'],
    ['W1_EIGHT_PRODUCER_COLLISIONS','2126_NEXT_IS_INTENTIONAL']),
  row('GRID_MOVE',B,'01B/02WEP','World.GridCollection.Grids/DiffGrids',
    [...CORE,...game,'NATIVE_FOOTPRINT_COLLISION_BOUNDS','OBJECT_PARENT_REFERENCES'],['DEFAULT_GRID_OVERLAY']),
  row('GRID_ADDDEL',B,'01B/01D','World.GridCollection.Grids/DiffGrids',
    [...CORE,...game,'OBJECT_ID_ALLOCATION','INVENTORY_COST_AND_LAYOUT'],['DEFAULT_GRID_OVERLAY']),
  row('SUBGRID',B,'01B/01E','World.GridCollection / SubGrid parent graph',
    [...CORE,...game,'PARENT_CYCLE_AND_REFERENCE_VALIDITY'],['NATIVE_ROOT_HIERARCHY']),
  row('ROAD_FENCE',B,'01C','World.GridCollection (01C owns topology, actual path operation-specific)',
    [...CORE,...game,'01C_TOPOLOGY_ADJACENCY_RECOMPILE','QUANTITY_VARIATION_CROSSDOMAIN'],['LAYOUT_PRESERVE_EXISTING']),
  row('QUEST',B,'01E/01A','UNKNOWN_QUEST_STATE_AND_REWARD_SAVE_FIELDS',
    [...CORE,...game,'LEGAL_QUEST_TRANSITION','REWARD_PRODUCER_CONSUMER_ATOMICITY'],['MULTI_DOMAIN_REWARD_ENTITLEMENT']),
  row('COLLECTION',B,'01D/01E','Player.CollectionSets[].GroupData[].GroupsCollectionItems[ItemID]:bool',
    [...CORE,...game,'NATIVE_GETNEWGROUP_ISVALID_VARIATIONS','CATEGORY_COUNTER_UPDATES'],['RAW_TRUE_NOT_OWNED']),
  row('PRESET_APPLY',B,'02WEP/01B/01C/01D','World.GridCollection + local Scene Preset (different authorities)',
    [...CORE,...game,'FOOTPRINT_GRID_COSTS','ROAD_FENCE_TOPOLOGY'],['LOCAL_PRESET_NOT_GAME_SAVE']),
  row('ENTITLEMENT_REMOTE',C,'03COMM/00CTRL','NOT_EXPOSED',
    ['ACTUAL_SERVER_AUTH_RECEIPT'],['NO_GENERAL_LOCAL_EDIT'])
]);
const byId=new Map(NATIVE_OPERATION_ROWS.map(r=>[r.operationId,r]));
const rec=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const hex64=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const safeId=v=>Number.isSafeInteger(v)&&v>=0;
const safePositive=v=>safeId(v)&&v>0;
// Conservative static preview subset aligned with 01D PR942/E1202.
// Steam626 Item.Type uses signed int32 / 10^7. Ingredient is an ActivityItemType
// subtype, never a CompatibleItemType. Prefix alone proves neither existence,
// canonical variation, subtype eligibility, rights nor stored-row authority.
// The same restrictive preview shape is used for Switch; Steam native evidence
// remains Steam-only. Only 01A Rust can authenticate a target and execute CAS.
const nativeCompatibleItemType=(v,id)=>Number.isInteger(id)&&id>0&&id<=2147483647&&
  ((v==='ItemType_ActivityItem'&&Math.trunc(id/10000000)===3)||
   (v==='ItemType_Furniture'&&Math.trunc(id/10000000)===4));
const forbidden=/\/(?:Entitlements?|DLC|Premium|Receipt|Auth|Purchases?|Moonstones?|Currencies?)(?:\/|$)/i;
const seen=(x)=>Array.isArray(x)&&x.every(s=>typeof s==='string'&&s.startsWith('/')&&s.length<=300)&&new Set(x).size===x.length;
const reject=(code,op=null)=>freeze({contract:OPERATION_NATIVE_STATIC_GATE,status:'REJECTED',reason:code,
  operationId:op,nativeV3Accepted:false,productWriterAuthorized:false,productEditedCopyAuthorized:false,
  operationEnabled:false,coreSessionAuthenticated:false});

function matchExternalBuild(v) {
  if(!rec(v))return null;
  return Object.values(NATIVE_SOURCE_TARGETS).find(x=>
    Object.keys(x).every(k=>v[k]===x[k]))??null;
}
// Archived, byte-matched Steam source evidence. Not an authenticated save or
// installed-game assertion; local native branches are not whole-operation V3.
const archivedSteam626Witness=(operationId,localMutation,consumer,producer,derived,required)=>freeze({
  operationId,kind:'ARCHIVED_STEAM626_NATIVE_STATIC_PARTIAL',
  binarySha256:'66644cf655e158086f83ffd654222ecfb5744c08423a644d3c0edc3244d66e4c',
  localMutation,consumer:freeze(consumer),producer:freeze(producer),
  derived:freeze(derived),requiredBeforeOperationV3:freeze(required),
  fullReferenceClosureVerified:false,nativeV3Accepted:false,
  nativeEventReplayAuthorized:false,productWriterAuthorized:false
});
const steam626Witnesses=freeze({
  INV_AMOUNT:archivedSteam626Witness('INV_AMOUNT','EXISTING_CANONICAL_AMOUNT_DECREMENT_ONLY',[
    'LIST_GET_AMOUNT_4351A60_TO_TRY_GET_4351450_TO_APPLY_VARIATION_4351580',
    'VARIATION_CAN_CHANGE_ITEM_AND_AMOUNT','DATA_AMOUNT_JSON_FIELD_1_INT32'
  ],[
    'LIST_REMOVE_4351D10_SUBTRACTS_CONVERTED_AMOUNT_AT_4351DDD',
    'LOW_LEVEL_ZERO_RETAINS_ROW_NOT_PRODUCT_AUTHORIZATION',
    'DATA_WRITE_JSON_4353B90_AMOUNT_INT32'
  ],[
    'ITEM_REMOVED_DISPATCH_CONDITIONAL',
    'POSSESS_SUBSCRIBES_ADD_REMOVE_MOVE_AND_RECALCULATES_PROGRESS_STATUS',
    'CRAFT_RELEVANT_INVENTORY_READS_PROFILE_QUANTITY',
    'CONSUME_ITEM_REASON_GATED_NOT_EQUIVALENT_TO_OFFLINE_DECREMENT'
  ],[
    'AUTHENTIC_CORE_TARGET_AND_CANONICAL_VARIATION_QUANTITY',
    'LEGAL_EXISTING_POSITIVE_DECREASE_NO_DEPLETION',
    'ACTIVE_MISSION_FILTER_AND_OTHER_SUBSCRIBER_CLOSURE',
    'PRESERVE_COLLECTION_OWNERSHIP_AND_ENTITLEMENTS'
  ]),
  CHEST_AMOUNT:archivedSteam626Witness('CHEST_AMOUNT','EXISTING_SLOT_POSITIVE_REMAINDER_ONLY',[
    'CONTAINER_GET_AMOUNT_3F55100_SUMS_MATCHED_SLOTS_ITEM_STATE_QUERY',
    'SLOT_AMOUNT_JSON_FIELD_2_INT32',
    'STACK_DATA_36A2B20_ACTIVITY_TYPE_AND_ITEM_EXCEPTION'
  ],[
    'POSITION_REMOVE_3F54770_SUBTRACTS_AT_3F54901',
    'ZERO_RESETS_ITEM_AMOUNT_STATE_434C250_NOT_PRODUCT_AUTHORIZATION',
    'SLOT_WRITE_JSON_434C0E0_AMOUNT_INT32'
  ],[
    'ITEMS_AMOUNT_CACHE_LAZY_CONSTRUCTS_FROM_SLOTS_AND_STACK_DATA',
    'POSITIVE_REMAINDER_UPDATES_RUNTIME_CACHE_NOT_NEW_SAVE_FIELD',
    'ITEM_REMOVED_DISPATCH_CONDITIONAL',
    'POSSESS_CAN_INCLUDE_STORAGE_AND_PANTRY'
  ],[
    'AUTHENTIC_PLAYER_CHEST_PARENT_ACTIVE_REFERENCE_AND_SLOT',
    'LEGAL_EXISTING_POSITIVE_DECREASE_PRESERVE_ITEM_STATE',
    'ACTIVE_MISSION_FILTER_AND_OTHER_SUBSCRIBER_CLOSURE',
    'NO_INVENTED_PERSISTED_CACHE_OR_CONSUMPTION_EVENT'
  ]),
  GRID_MOVE:archivedSteam626Witness('GRID_MOVE','EXISTING_MODIFIED_OBJECT_TRANSFORM_CANDIDATE',[
    'DIFFGRID_UPDATE_TRANSFORM_3FEDA00_VALIDATES_AREA_BEFORE_WRITES',
    'CORE_AUTHENTIC_EFFECTIVE_OCCUPANCY_REQUIRED'
  ],[
    'REMOVE_GRIDCELLS_THEN_TRANSFORM_THEN_ADD_GRIDCELLS',
    'DEFAULT_ONLY_OBJECT_REQUIRES_CLONE_AND_MODIFIED_MAP_INSERT'
  ],[
    'GRID_CHANGED_DISPATCH_CONDITIONAL',
    'MISSION_GRID_CHANGED_CAN_CHANGE_STATUS_AFTER_DECOR_CHECK'
  ],[
    '01B_FOOTPRINT_PARENT_FLOOR_OCCUPANCY_AND_OLD_TRANSFORM',
    'EXISTING_MODIFIED_NOT_REMOVED_NON_ROADFENCE_OBJECT',
    'ACTIVE_DECOR_MISSION_AND_OTHER_SUBSCRIBER_CLOSURE',
    '01C_ROADFENCE_SEPARATE_OWNER'
  ])
});

/**
 * Static handoff only. Exact *declared* Build identity is necessary, never
 * proof of installed game or provenance. No caller-supplied boolean can grant.
 * 01A Rust must independently bind Build, Session, revision and actual readset.
 */
export function describeNativeOperation(operationId,declaredBuild) {
  const op=byId.get(operationId);
  if(!op)return reject('UNKNOWN_OPERATION');
  if(op.tier===C)return reject('PROTECTED_RIGHTS_OR_ENTITLEMENT_OPERATION',operationId);
  if(!matchExternalBuild(declaredBuild))return reject('EXACT_PLATFORM_BUILD_VERSION_SCHEMA_REQUIRED',operationId);
  return freeze({contract:OPERATION_NATIVE_STATIC_GATE,status:op.tier===A?'TIER_A_STATIC_INDEPENDENT_CANDIDATE':'TIER_B_NATIVE_DEPENDENCIES_OPEN',
    ...op,
    w1OrRoadFenceGlobalBlocker:op.tier===A?false:null,
    externalBuildIsAuthentication:false,sourceOnly:true,
    target:freeze({...matchExternalBuild(declaredBuild)}),
    ...(matchExternalBuild(declaredBuild)===NATIVE_SOURCE_TARGETS.steam1253&&Object.hasOwn(steam626Witnesses,operationId)
      ?{archivedSteam626NativeWitness:steam626Witnesses[operationId]}:{}),
    coreIssuedReadsetVerified:false,productWriterAuthorized:false,
    productEditedCopyAuthorized:false,operationEnabled:false,
    deviceV4Mandated:false,deviceV4OnlyWhenStaticCannotCloseCriticalRisk:true});
}

/**
 * Inventory existing-row amount: fast static Tier A candidate, not a Writer.
 * Refuse fabricated row, invalid canonical routing, zero/depletion unknowns,
 * silent variant/entitlement mutation and any guessed build.
 * `oldAmount` comes from an untrusted caller; real CAS is Rust Core's job.
 */
export function previewNativeInventoryAmount({declaredBuild,inventoryId,canonicalItemId,
    compatibleItemType,existingRow,oldAmount,nextAmount,sourceHash,changedPaths=[]}={}) {
  const p=describeNativeOperation('INV_AMOUNT',declaredBuild);
  if(p.status!=='TIER_A_STATIC_INDEPENDENT_CANDIDATE')return p;
  if(!safePositive(inventoryId)||inventoryId>4294967295||!nativeCompatibleItemType(compatibleItemType,canonicalItemId)||
     existingRow!==true||!safePositive(oldAmount)||!safePositive(nextAmount)||
     nextAmount>9999||oldAmount>9999||nextAmount>=oldAmount)
    return reject('EXISTING_CANONICAL_ROW_AND_NONZERO_AMOUNT_REQUIRED','INV_AMOUNT');
  if(!hex64(sourceHash))return reject('SOURCE_HASH_SHAPE_REQUIRED_NOT_AUTHENTICATION','INV_AMOUNT');
  const ptr=`/Player/ListInventories/${inventoryId}/Inventory/${canonicalItemId}/Amount`;
  if(!seen(changedPaths)||changedPaths.length!==1||changedPaths[0]!==ptr||changedPaths.some(s=>forbidden.test(s)))
    return reject('EXACT_SINGLE_EXISTING_AMOUNT_POINTER_REQUIRED','INV_AMOUNT');
  return freeze({contract:OPERATION_NATIVE_STATIC_GATE,
    status:'TIER_A_01D_TO_01A_CAS_PREVIEW_ONLY',operationId:'INV_AMOUNT',tier:A,
    sourcePointer:ptr,inventoryId,canonicalItemId,compatibleItemType,
    expectedOldAmount:oldAmount,hypotheticalNextAmount:nextAmount,
    recomputationRequirement:'UNKNOWN_UNTIL_SAME_BUILD_NATIVE_STATIC_TRACE',
    dependencyFence:freeze(['01D_CANONICAL_ROUTING','01A_RUST_SESSION_CAS','NATIVE_STACK_AND_QUEST_CROSSREFS']),
    unrelatedW1AndRoadFenceDoNotBlockStaticInvestigation:true,
    originalShaValidatedByCore:false,externalBuildIsAuthentication:false,
    fullReferenceClosureVerified:false,nativeV3Accepted:false,
    independentRealEditedCopyVerified:false,productWriterAuthorized:false,
    productEditedCopyAuthorized:false,operationEnabled:false});
}

/**
 * Check claimed static trace *structure* only. No dynamic authority or native
 * proof is created; actual source hashes/callgraph/cross-domain closure must be
 * independently verified from the exact same native binary and Core session.
 */
export function inspectNativeStaticTraceDraft({operationId,declaredBuild,producerCalls,
  consumerCalls,saveReadPointers,saveWritePointers,derivedWritePointers,
  nativeBinarySha256,eventsFromItemId,claim}={}) {
  const p=describeNativeOperation(operationId,declaredBuild);
  if(p.status==='REJECTED')return p;
  if(!hex64(nativeBinarySha256)||!seen(saveReadPointers)||!seen(saveWritePointers)||
     !seen(derivedWritePointers)||!Array.isArray(producerCalls)||!Array.isArray(consumerCalls)||
     producerCalls.length===0||consumerCalls.length===0||
     producerCalls.length>64||consumerCalls.length>64||
     ![...producerCalls,...consumerCalls].every(x=>rec(x)&&typeof x.symbol==='string'&&x.symbol.length>0&&x.symbol.length<=240&&hex64(x.binarySha256)&&x.binarySha256===nativeBinarySha256))
    return reject('NATIVE_TRACE_DRAFT_INCOMPLETE_OR_UNTRUSTED',operationId);
  if(saveReadPointers.some(s=>forbidden.test(s))||saveWritePointers.some(s=>forbidden.test(s))||
     derivedWritePointers.some(s=>forbidden.test(s)))
    return reject('PROTECTED_ENTITLEMENT_OR_DLC_WRITE_PATH',operationId);
  if(operationId==='TIME_EVENT'&&Array.isArray(eventsFromItemId) && eventsFromItemId.length!==1)
    return reject('ITEM_ID_CANNOT_SELECT_UNIQUE_EVENT_PRODUCER',operationId);
  // Empty derived paths are *not* proof that no derivation exists.
  const gaps=freeze([
    'NATIVE_BINARY_SHA_AND_SYMBOL_GRAPH_NOT_INDEPENDENTLY_AUTHENTICATED',
    'EXACT_SOURCE_SESSION_READSET_AND_CAS_NOT_BOUND',
    'NATIVE_DERIVATION_CLOSURE_AND_NEGATIVES_NOT_INDEPENDENTLY_ACCEPTED',
    'REAL_EDITED_COPY_REOPEN_AND_V3_QA_NOT_RUN'
  ]);
  return freeze({contract:OPERATION_NATIVE_STATIC_GATE,operationId,
    status:'UNTRUSTED_STATIC_TRACE_SHAPE_ONLY',tier:p.tier,
    declaredBuildIsAuthentic:false,nativeBinaryAuthenticated:false,
    claimedProducerCount:producerCalls.length,claimedConsumerCount:consumerCalls.length,
    claimedSaveReads:saveReadPointers.length,claimedSaveWrites:saveWritePointers.length,
    claimedDerivedWrites:derivedWritePointers.length,
    noDerivedWritesProven:false,sourceDigestValidated:false,
    missingEvidence:gaps,
    nativeV3Accepted:false,fullReferenceClosureVerified:false,
    productWriterAuthorized:false,productEditedCopyAuthorized:false,
    operationEnabled:false});
}
