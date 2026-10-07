/* Dreamwish Wand DDV Core 01B — storage active-reference index.
 * Nintendo Switch DDV v1.25.0 / BID 52BD625D9B4E0053 / profile schema 624 only.
 * Read/projection only. No mutation or persistent write authorization.
 */
'use strict';

export const STORAGE_ACTIVE_REFERENCE_INDEX_CONTRACT='ddv.storage-active-reference-index@1';
export const STORAGE_ACTIVE_REFERENCE_INDEX_STATUS=Object.freeze({
  COMPLETE:'COMPLETE_CURRENT_SAVE',
  INCOMPLETE:'INCOMPLETE_CURRENT_SAVE',
  REJECTED:'REJECTED'
});
export const GAME_VERSION='1.25.0';
export const PROFILE_SCHEMA=624;
export const SWITCH_BID='52BD625D9B4E0053';

function isObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function int(v){const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:null;}
function clone(v){return structuredClone(v);}
function uniq(v){return [...new Set(v)];}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function sourceReasons(source){
  const out=[];
  if(source?.platform!=='Nintendo Switch')out.push('EXACT_SWITCH_PLATFORM_REQUIRED');
  if(source?.gameVersion!==GAME_VERSION)out.push('EXACT_GAME_VERSION_REQUIRED');
  if(Number(source?.profileSchemaVersion)!==PROFILE_SCHEMA)out.push('EXACT_PROFILE_SCHEMA_REQUIRED');
  if(source?.buildIdentity!==SWITCH_BID)out.push('EXACT_SWITCH_BID_REQUIRED');
  return out;
}
function definitionFor(index,itemId){
  if(index instanceof Map)return index.get(itemId)??index.get(String(itemId))??null;
  return isObj(index)?(index[String(itemId)]??index[itemId]??null):null;
}
function referenceKey(r){return `${r.gridId}:${r.gridObjectId}`;}
function referenceCompare(a,b){return a.gridId-b.gridId||a.gridObjectId-b.gridObjectId||a.itemId-b.itemId;}

export function buildStorageActiveReferenceIndexV125({source,profile,itemDefinitionsById}={}){
  const reasons=sourceReasons(source),references=[];
  const world=isObj(profile?.World)?profile.World:null;
  const gridCollection=isObj(world?.GridCollection)?world.GridCollection:null;
  const grids=isObj(gridCollection?.Grids)?gridCollection.Grids:null;
  if(!grids)reasons.push('GRID_COLLECTION_REQUIRED');

  if(grids){
    for(const [gridKey,rawGrid] of Object.entries(grids)){
      if(!isObj(rawGrid)){reasons.push('MALFORMED_GRID_RECORD');continue;}
      const gridId=int(rawGrid.ID);
      if(gridId===null||String(gridId)!==String(gridKey)){reasons.push('GRID_MAP_KEY_ID_MISMATCH');continue;}
      if(!isObj(rawGrid.Objects)){reasons.push('GRID_OBJECT_MAP_REQUIRED');continue;}
      for(const [objectKey,rawObject] of Object.entries(rawGrid.Objects)){
        if(!isObj(rawObject)){reasons.push('MALFORMED_GRID_OBJECT_RECORD');continue;}
        const objectId=int(rawObject.ID),itemId=int(rawObject.ItemID);
        if(objectId===null||itemId===null||String(objectId)!==String(objectKey)){
          reasons.push('GRID_OBJECT_MAP_KEY_ID_MISMATCH');continue;
        }
        const state=rawObject.State;
        if(state===null||state===undefined)continue;
        if(!isObj(state)){reasons.push('MALFORMED_GRID_STATE');continue;}
        const hasStorage=Object.prototype.hasOwnProperty.call(state,'Storage');
        if(!hasStorage)continue;
        const storage=state.Storage;
        if(!isObj(storage)){reasons.push('MALFORMED_STORAGE_STATE');continue;}
        const containerInventoryId=int(storage.ContainerInventoryID);
        if(containerInventoryId===null){reasons.push('MALFORMED_STORAGE_CONTAINER_ID');continue;}
        const definition=definitionFor(itemDefinitionsById,itemId);
        if(!isObj(definition)){
          reasons.push('STORAGE_ITEM_DEFINITION_UNKNOWN');continue;
        }
        if(definition.interaction==='HomeStorage'){
          reasons.push('HOME_STORAGE_UNSUPPORTED');continue;
        }
        if(definition.concreteType!=='FurnitureItemData'||definition.interaction!=='Container'){
          reasons.push('STORAGE_REFERENCE_ITEM_CLASS_UNKNOWN');continue;
        }
        references.push({gridId,gridObjectId:objectId,itemId,containerInventoryId});
      }
    }
  }

  references.sort((a,b)=>a.containerInventoryId-b.containerInventoryId||referenceCompare(a,b));
  const byContainer={};
  for(const ref of references){
    const key=String(ref.containerInventoryId);
    (byContainer[key]??=[]).push({gridId:ref.gridId,gridObjectId:ref.gridObjectId,itemId:ref.itemId});
  }
  const duplicateContainerInventoryIds=Object.entries(byContainer)
    .filter(([,refs])=>refs.length>1)
    .map(([key])=>Number(key)).sort((a,b)=>a-b);
  const status=reasons.length?STORAGE_ACTIVE_REFERENCE_INDEX_STATUS.INCOMPLETE:STORAGE_ACTIVE_REFERENCE_INDEX_STATUS.COMPLETE;
  return freeze({
    contract:STORAGE_ACTIVE_REFERENCE_INDEX_CONTRACT,
    status,
    completeCurrentSave:status===STORAGE_ACTIVE_REFERENCE_INDEX_STATUS.COMPLETE,
    reasonCodes:uniq(reasons),
    references:clone(references),
    byContainer:clone(byContainer),
    duplicateContainerInventoryIds,
    scan:{allGridRecordsVisited:Boolean(grids),allGridObjectMapsRequired:true,storageReferenceShape:'State.Storage.ContainerInventoryID',itemDefinitionBindingRequired:true},
    hardFlags:{persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false}
  });
}

export function selectStorageActiveReferenceEvidenceV125({index,containerInventoryId,expectedReferenceCount}={}){
  const id=int(containerInventoryId);
  if(id===null)throw Error('STORAGE_CONTAINER_INVENTORY_ID_REQUIRED');
  if(!index||index.contract!==STORAGE_ACTIVE_REFERENCE_INDEX_CONTRACT||index.status!==STORAGE_ACTIVE_REFERENCE_INDEX_STATUS.COMPLETE)
    throw Error('STORAGE_COMPLETE_CURRENT_SAVE_INDEX_REQUIRED');
  const refs=clone(index.byContainer?.[String(id)]??[]).sort(referenceCompare);
  const seen=new Set(refs.map(referenceKey));
  if(seen.size!==refs.length||refs.length>1)throw Error('STORAGE_ACTIVE_REFERENCE_DUPLICATE');
  if(expectedReferenceCount!==undefined&&refs.length!==expectedReferenceCount)throw Error('STORAGE_ACTIVE_REFERENCE_COUNT_MISMATCH');
  return freeze({
    contract:STORAGE_ACTIVE_REFERENCE_INDEX_CONTRACT,
    status:STORAGE_ACTIVE_REFERENCE_INDEX_STATUS.COMPLETE,
    containerInventoryId:id,
    references:refs
  });
}
