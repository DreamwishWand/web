/**
 * 01D / R08, Tier A: bounded typed operation requests for the ONE 01A Rust
 * ProductSession. Source-only: this module never opens, clones, edits or
 * exports a Save, and cannot validate who produced its caller-supplied inputs.
 * Real source/build/reference/entitlement proof and authority remain Rust-owned.
 */
import {isSteam626ExistingListAmountType,steam626ItemTypeOf} from './steam626-native-fields.mjs';
export const TIER_A_CONTRACT='wand.01d.tier-a-existing-field-request@1';
export const TIER_A_WRITER_ENABLED=false;
export const STEAM626=Object.freeze({
  platform:'Steam/Windows',gameVersion:'1.25.3',buildKind:'SteamFullVersion',
  buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',
  schema:626
});
export const TIER_A_OPERATIONS=Object.freeze([
  Object.freeze({name:'Inventory.ExistingAmountDecrease',tier:'A1',field:'Player.ListInventories[InventoryID].Inventory[CanonicalItemID].Amount',
    shape:'SOURCED_STRUCTURAL',semantic:'NATIVE_CANONICAL_VARIATION_STACK_RULES_UNVERIFIED',
    command:'inventory.existing.amount.decrease@1',coreOwner:'01A',writerAuthorized:false,requires01E:'ONLY_IF_NATIVE_CROSS_DOMAIN_DEPENDENCY_PROVEN'}),
  Object.freeze({name:'Chest.ExistingSlotAmountDecrease',tier:'A2',field:'Player.ContainerInventories[ContainerInventoryID].Inventory[slotIndex].Amount',
    shape:'STEAM626_REAL_SAVE_V2_AND_NATIVE_SCHEMA_CONFIRMED',semantic:'CONTAINER_SLOT_IDENTITY_PARENT_CAPACITY_ACTIVE_REF_UNVERIFIED',
    command:'chest.existing.slot.amount.decrease@1',coreOwner:'01A',writerAuthorized:false,requires01E:'IF_NATIVE_SLOT_CONSUMER_OR_CROSS_DOMAIN_MUTATION_PROVEN'}),
  Object.freeze({name:'Collection.InspectRawGroupFlag',tier:'A_READ',field:'Player.CollectionSets[*].GroupData[*].GroupsCollectionItems[ItemID]:boolean',
    shape:'SOURCED_STRUCTURAL',semantic:'GAME_DISCOVERED_COLLECTED_OWNED_NOT_PROVEN',
    command:null,coreOwner:'01A',writerAuthorized:false,requires01E:'IF_COLLECTION_GROUP_PRODUCER_CONSUMER_IS_NEEDED'}),
  ...['Ownership.Change','Variation.Change','Group.Change','Appearance.Change','Wardrobe.Change','OwnedSkin.Select'].map(name=>
    Object.freeze({name,tier:'A_WAIT_EVIDENCE',field:null,shape:'UNKNOWN_STEAM626_NATIVE',
      semantic:'REQUIRES_REAL_FIELD_AND_NATIVE_PRODUCER_CONSUMER_PROOF',
      command:null,coreOwner:'01A',writerAuthorized:false,requires01E:'AFTER_CONCRETE_TYPED_FIELD_EVIDENCE'}))
]);
export const TIER_A_DEPENDENCIES=Object.freeze({
  commonRust:'SINGLE_01A_PRODUCTSESSION_REVALIDATE_BUILD_SESSION_FULL_DOCUMENT_REF_INDEX_REVISION_CAS',
  export:'ORIGINAL_BACKUP_DISTINCT_EDITED_COPY_SEPARATE_PROCESS_REOPEN_05QRL',
  native:'01E_ONLY_FOR_CONFIRMED_PRODUCER_CONSUMER_OR_CROSS_DOMAIN_RECACLULATION',
  qa:'05QRC_SCOPED_RUST_AND_05QRL_PRIVATE_REAL_EDITED_COPY',
  authorization:'01A_CTRL_OPERATION_SCOPED_APPROVAL_REQUIRED_WRITER_OFF',
  incompatible:'SWITCH_SCHEMA624_BID52BD625D9B4E0053_IS_NOT_STEAM626'
});
const PLAIN=Object.prototype;
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  (Object.getPrototypeOf(v)===PLAIN||Object.getPrototypeOf(v)===null);
const keys=(v,names)=>obj(v)&&
  Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const SHA=/^[0-9a-f]{64}$/;
const SID=/^[0-9a-f]{32}$/;
const u32=v=>Number.isSafeInteger(v)&&v>=0&&v<=4294967295;
const positiveId=v=>u32(v)&&v>0;
// Mirrors 01A PR914 DEV-only typed Rust amount range, not a native stock-cap assertion.
const amount=v=>Number.isSafeInteger(v)&&v>=1&&v<=9999;
const typeToken=(v,id)=>isSteam626ExistingListAmountType(v,id);
const decimal=n=>String(n);
const frozen=v=>{
  if(v&&typeof v==='object'&&!Object.isFrozen(v)){
    Object.freeze(v);for(const entry of Object.values(v))frozen(entry);
  }
  return v;
};
const reject=(code)=>frozen({
  contract:TIER_A_CONTRACT,status:'BLOCKED',code,
  writerAuthorized:false,exportAuthorized:false,productOperationEnabled:false
});
function envelopeFence(target,source,session){
  if(!keys(target,['platform','gameVersion','buildKind','buildId','schema'])||
    Object.entries(STEAM626).some(([k,v])=>target[k]!==v))
    return 'STEAM626_FULLVERSION_SOURCE_REQUIRED';
  if(!keys(source,['originalEncryptedSha256'])||!SHA.test(source.originalEncryptedSha256))
    return 'ORIGINAL_ENCRYPTED_SHA_REQUIRED';
  if(!keys(session,['sessionId','revision','indexGeneration','decodedSha256'])||
    !SID.test(session.sessionId)||!u32(session.revision)||
    !u32(session.indexGeneration)||session.indexGeneration<1||
    !SHA.test(session.decodedSha256))
    return 'RUST_SESSION_SNAPSHOT_FIELDS_REQUIRED';
  return null;
}
const proposed=(operation,target,source,session,fieldPath,oldAmount,nextAmount,readSet,gate,nativeDevCommand)=>frozen({
  contract:TIER_A_CONTRACT,status:gate,
  operation,target:{...target},
  source:{...source},sessionSnapshot:{...session},
  candidate:{fieldPath,kind:'EXISTING_LEAF_NUMBER_ONLY',expectedOldAmount:oldAmount,
    nextAmount,exactAllowedPaths:[fieldPath],readSet,nativeDevCommand},
  authoritativeCoreValidationRequired:true,
  // The JS proposal can be forged by its caller. ONLY Rust may issue a
  // signed/attested current readset and compare full source + old leaf CAS.
  sourceIdentityProvenByThisModule:false,sessionAuthorizedByThisModule:false,
  canonicalItemRoutingProvenByThisModule:false,nativeCrossDomainRecalculationProven:false,
  completeAllDomains:false,fullDocumentExactDiffVerified:false,
  independentQaAccepted:false,editedCopyReopened:false,
  writerAuthorized:false,exportAuthorized:false,productOperationEnabled:false,
  releaseFlags:{Writer:false,Apply:false,Cloud:false,Provider:false,MediaPublic:false},
  nativeDependencyOwner:'01E_ONLY_IF_REQUIRED',
  delegatedTo:'01A_SINGLE_RUST_PRODUCTSESSION_ONLY'
});
function requestInventory({target,source,session,command}){
  if(!keys(command,['operation','inventoryId','canonicalItemId','compatibleItemType','expectedOldAmount','nextAmount','entryPresent'])||
    !positiveId(command.inventoryId)||!positiveId(command.canonicalItemId)||
    !typeToken(command.compatibleItemType,command.canonicalItemId)||command.entryPresent!==true)
    return reject('EXISTING_CANONICAL_INVENTORY_ENTRY_REQUIRED');
  const a=command.expectedOldAmount,b=command.nextAmount;
  if(!amount(a)||!amount(b))return reject('INVENTORY_AMOUNT_BOUNDS');
  if(b>=a)return reject('INVENTORY_ONLY_EXISTING_QUANTITY_DECREASE_CANDIDATE');
  const id=decimal(command.inventoryId),item=decimal(command.canonicalItemId);
  const path='/Player/ListInventories/'+id+'/Inventory/'+item+'/Amount';
  return proposed(command.operation,target,source,session,path,a,b,
    [{path:'/Player/ListInventories/'+id+'/ID',expectedType:'POSITIVE_UINT32',expectedValue:command.inventoryId},
     {path:'/Player/ListInventories/'+id+'/CompatibleItemType',expectedType:'EXACT_NATIVE_ENUM',expectedValue:command.compatibleItemType},
     {path,expectedType:'SIGNED_NONNEGATIVE_INTEGER',expectedValue:a},
     {path:'/Player/ListInventories/'+id+'/Inventory/'+item,expectedType:'EXISTING_ITEM_ENTRY'}],
    'INVENTORY_CAS_TYPED_PREVIEW_RUST_NATIVE_ITEM_RULES_PENDING',
    {variant:'InventoryExistingAmountDecrease',inventory_id:command.inventoryId,
      canonical_item_id:command.canonicalItemId,
      expected_compatible_item_type:command.compatibleItemType,
      expected_old_amount:a,new_amount:b});
}
function requestChest({target,source,session,command}){
  if(!keys(command,['operation','containerInventoryId','containerParentItemId','belongsToPlayer',
    'size','slotCount','slotIndex','slotItemId','expectedOldAmount','nextAmount',
    'itemStateReadsetSha256','activeReferenceCount'])||
    !positiveId(command.containerInventoryId)||!steam626ItemTypeOf(command.containerParentItemId)||
    command.belongsToPlayer!==true||!u32(command.size)||command.size<1||command.size>256||
    !u32(command.slotCount)||command.slotCount!==command.size||
    !u32(command.slotIndex)||command.slotIndex>=command.slotCount||
    !steam626ItemTypeOf(command.slotItemId)||!SHA.test(command.itemStateReadsetSha256)||
    !u32(command.activeReferenceCount)||command.activeReferenceCount>1)
    return reject('CHEST_EXISTING_PLAYER_SLOT_IDENTITY_OR_CAPACITY_INVALID');
  const a=command.expectedOldAmount,b=command.nextAmount;
  if(!amount(a)||!amount(b))return reject('CHEST_SLOT_AMOUNT_BOUNDS');
  if(b>=a)return reject('CHEST_ONLY_EXISTING_SLOT_DECREASE_CANDIDATE');
  const container=decimal(command.containerInventoryId),slot=decimal(command.slotIndex);
  const prefix='/Player/ContainerInventories/'+container;
  const path=prefix+'/Inventory/'+slot+'/Amount';
  const readSet=[
    {path:prefix+'/ID',expectedValue:command.containerInventoryId},
    {path:prefix+'/BelongsToPlayer',expectedValue:true},
    {path:prefix+'/ParentItemID',expectedValue:command.containerParentItemId},
    {path:prefix+'/Size',expectedValue:command.size},
    {path:prefix+'/ExtraSize',required:'CORE_RESOLVE_SIZE_WITHOUT_EXTRAS'},
    {path:prefix+'/BlockMoveTo',required:'CORE_PRESERVE_AND_CHECK'},
    {path:prefix+'/Inventory',expectedType:'ARRAY',expectedLength:command.slotCount},
    {path:prefix+'/Inventory/'+slot+'/ItemID',expectedValue:command.slotItemId},
    {path:prefix+'/Inventory/'+slot+'/State',expectedContentSha256:command.itemStateReadsetSha256},
    {path,expectedType:'SIGNED_NONNEGATIVE_INTEGER',expectedValue:a},
    {path:'/World/GridCollection',required:'CORE_COMPLETE_EFFECTIVE_ACTIVE_CONTAINER_REFERENCES_ALL_ROOTS',
      expectedReferenceCount:command.activeReferenceCount}
  ];
  return proposed(command.operation,target,source,session,path,a,b,readSet,
    'WAIT_STEAM626_NATIVE_STACK_PARENT_STATE_AND_CONSUMER_EVIDENCE',
    {variant:'ChestExistingSlotAmountDecrease',container_id:command.containerInventoryId,
      slot_index:command.slotIndex,expected_item_id:command.slotItemId,
      expected_old_amount:a,new_amount:b});
}
/**
 * Build a non-executable, immutable **candidate** from caller-controlled scalar
 * facts. The caller may forge every field. Rust must re-read/revalidate them
 * from the original immutable byte source before any future editing.
 */
export function describeTierARequest(input){
  if(!keys(input,['target','source','session','command']))
    return reject('REQUEST_SHAPE_INVALID');
  const fence=envelopeFence(input.target,input.source,input.session);
  if(fence)return reject(fence);
  if(!obj(input.command)||typeof input.command.operation!=='string')
    return reject('OPERATION_MISSING');
  if(input.command.operation==='Inventory.ExistingAmountDecrease')
    return requestInventory(input);
  if(input.command.operation==='Chest.ExistingSlotAmountDecrease')
    return requestChest(input);
  return reject('OPERATION_NOT_A_TIER_A_EXISTING_SCALAR_COMMAND');
}
