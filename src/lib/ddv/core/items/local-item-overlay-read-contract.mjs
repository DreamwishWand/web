/**
 * 01D -> 01A/08WEB: present-state availability for a PERSONAL Collection
 * overlay. The common item catalogue is source/reference, never player state.
 *
 * This adapter is intentionally unable to convert saved bool/amount into
 * Owned/Discovered/Missing. It does not call a Worker, read a profile or
 * accept caller-supplied "nativeVerified" flags. The Core owns future reads.
 */
import {validateCollectionRuntimeIndex} from '../../../collection/runtime.js';

export const ITEM_OVERLAY_READ_CONTRACT='wand.item.local-overlay-read@1';
export const ITEM_OVERLAY_PRODUCT_ENABLED=false;
export const ITEM_OVERLAY_WRITER_ENABLED=false;
export const ITEM_OVERLAY_SOURCE_TARGETS=Object.freeze({
  catalog1250:Object.freeze({
    platform:'Nintendo Switch',gameVersion:'1.25.0',
    buildId:'52BD625D9B4E0053',schema:624,
    manifest:'COLLECTION_SEED_MANIFEST_DDV_v1.25.0_2026-10-02_V2',
    personalNativeMembershipAccepted:false
  }),
  worker1253:Object.freeze({
    platform:'switch',gameVersion:'1.25.3',fullVersion:'1.25.3',
    fullVersionSource:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
    buildId:'9A239D3DB569756D',schema:626,
    personalNativeMembershipAccepted:false
  })
});
export const ITEM_OVERLAY_TYPED_READ_PLAN=Object.freeze([
  Object.freeze({
    command:'Item.InspectCollectionFlag',
    field:'Player.CollectionSets[definitionId].GroupData[groupIndex].GroupsCollectionItems[itemId]',
    result:['SAVE_BOOL_TRUE','SAVE_BOOL_FALSE','ABSENT_DEFINITION','ABSENT_GROUP','ABSENT_ITEM_ENTRY'],
    owner:'01A_CORE_WORKER',apiAvailableOnPR383:false,gameDisplayedCollectedAccepted:false
  }),
  Object.freeze({
    command:'Item.InspectInventoryAmount',
    field:'Player.ListInventories[inventoryId].Inventory[canonicalItemId].Amount',
    result:['PRESENT_ZERO','PRESENT_POSITIVE','ABSENT_INVENTORY','ABSENT_ITEM_ENTRY'],
    owner:'01A_CORE_WORKER',apiAvailableOnPR383:false,gameDisplayedOwnedAccepted:false
  })
]);
export const ITEM_OVERLAY_MISSING_EVIDENCE=Object.freeze([
  'same-build-current-native-item-database',
  'final-GetNewGroup-membership-include-exclude-IsValid-variation',
  'canonical-item-id-to-inventory-id-route-and-cross-domain-refs',
  'game-UI-Collected-Owned-Missing-meaning-and-denominator',
  '01A-Core-minted-typed-Item-read-ABI-and-session-revocation',
  'independent-05QR-and-operation-specific-product-gate'
]);

const UNKNOWN=Object.freeze({
  owned:'UNKNOWN',discovered:'UNKNOWN',missing:'UNKNOWN',
  quantity:null,inventoryEntryPresent:null,collectionRawFlag:null,
  entryDenominator:null,uniqueDenominator:null,progressRatio:null
});
const finish=(status,reason,extra={})=>Object.freeze({
  schema:ITEM_OVERLAY_READ_CONTRACT,status,reason,
  itemState:UNKNOWN,canShowPersonalState:false,canShowPercentage:false,
  canQueryItemFromExistingWorker:false,canWriteSave:false,
  canPublishPersonalData:false,canPublishGameMedia:false,
  requiredEvidence:ITEM_OVERLAY_MISSING_EVIDENCE,...extra
});
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);

/**
 * Pass only the existing 01A single Worker bridge and the already loaded
 * reference catalogue index. The index declares a source identity; this
 * function does not verify the shard bytes or issue trust capabilities.
 * No profile/save data or source SHA values are returned to the UI.
 */
export function describeItemPersonalOverlay({sessionBridge,referenceIndex}={}) {
  let ref;
  try{ref=validateCollectionRuntimeIndex(referenceIndex);}catch{
    return finish('BLOCKED','REFERENCE_INDEX_INVALID');
  }
  const refIdentity=Object.freeze({
    platform:ref.t.platform,gameVersion:ref.t.gameVersion,
    buildId:ref.t.buildID,source:'REFERENCE_INDEX_DECLARATION_ONLY'
  });
  if(!sessionBridge||typeof sessionBridge.getSession!=='function'||
      typeof sessionBridge.getCapabilities!=='function')
    return finish('REFERENCE_ONLY','NO_01A_SINGLE_SESSION',{catalog:refIdentity});
  let receipt,caps;
  try{receipt=sessionBridge.getSession();caps=sessionBridge.getCapabilities();}
  catch{return finish('BLOCKED','SESSION_BRIDGE_NOT_READABLE',{catalog:refIdentity});}
  if(!receipt)return finish('REFERENCE_ONLY','NO_ACTIVE_LOCAL_SAVE',{catalog:refIdentity});
  const target=ITEM_OVERLAY_SOURCE_TARGETS.worker1253;
  if(!record(receipt)||receipt.contract!=='wand.local.save-session.read@1'||
      receipt.platform!==target.platform||receipt.fullVersion!==target.fullVersion||
      receipt.buildKind!=='switch-bid'||receipt.buildId!==target.buildId||
      receipt.schema!==target.schema||
      receipt.sourceIdentity!=='externally-attested-switch-bid'||
      !sha(receipt.sourceSha256)||
      !Number.isSafeInteger(receipt.revision)||receipt.revision!==0||
      !Number.isSafeInteger(receipt.indexGeneration)||receipt.indexGeneration<1||
      receipt.writerAuthorized!==false)
    return finish('BLOCKED','SESSION_PROVENANCE_OR_REVISION_UNVERIFIED',{catalog:refIdentity});
  // Exact build is necessary, not sufficient. This branch currently denies
  // the actual 1250-index + 1253-session pairing on main.
  if(ref.t.platform!=='Nintendo Switch'||ref.t.gameVersion!==receipt.fullVersion||
      ref.t.buildID!==receipt.buildId)
    return finish('REFERENCE_ONLY','CATALOG_AND_LOCAL_SAVE_BUILD_MISMATCH',{
      catalog:refIdentity,saveTarget:Object.freeze({
        platform:receipt.platform,gameVersion:receipt.fullVersion,
        buildId:receipt.buildId,schema:receipt.schema
      })
    });
  if(!record(caps)||caps.contract!=='wand.local.save-session.read@1'||
      caps.sessionOwner!=='worker-singleton'||caps.canCommit!==false||
      caps.canEncodeEditedCopy!==false||caps.canApply!==false||
      caps.canReplaceOriginal!==false)
    return finish('BLOCKED','UNTRUSTED_ITEM_SESSION_CAPABILITIES',{catalog:refIdentity});
  if(caps.readInventory!==true||caps.readOwnership!==true)
    return finish('REFERENCE_ONLY','ITEM_TYPED_READ_NOT_AVAILABLE_ON_WORKER',{catalog:refIdentity});
  // A future Worker may return RAW fields; 01D still cannot promote native
  // ownership without exact-BID dynamic item-group and independent acceptance.
  return finish('RAW_INSPECTION_PENDING','NATIVE_PERSONAL_SEMANTICS_NOT_ACCEPTED',{
    catalog:refIdentity
  });
}
