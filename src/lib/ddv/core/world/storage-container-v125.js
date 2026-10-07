/* Dreamwish Wand DDV Core 01B — storage Furniture / ContainerInventory semantics.
 * Nintendo Switch DDV v1.25.0 / BID 52BD625D9B4E0053 / profile schema 624 only.
 * Semantic compiler only. No persistent write authorization.
 */
'use strict';

export const STORAGE_CONTAINER_CONTRACT='ddv.storage-furniture-container-semantics@1';
export const STORAGE_TRANSITION_CONTRACT='ddv.storage-furniture-transition-set@1';
export const ACTIVE_REFERENCE_EVIDENCE_CONTRACT='ddv.storage-active-reference-index@1';
export const STORAGE_01A_REQUEST_ID='01B-TO-01A-STORAGE-FURNITURE-TRANSITION-V125-V1';
export const STORAGE_01E_REQUEST_ID='01B-TO-01E-STORAGE-CONTAINER-TRANSITION-V125-V1';
export const SEMANTIC_OWNER='01B CORE - World / Grid / Buildings';
export const GAME_VERSION='1.25.0';
export const PROFILE_SCHEMA=624;
export const SWITCH_BID='52BD625D9B4E0053';

export const STORAGE_TRANSITION=Object.freeze({
  SAME_GRID_MOVE:'SAME_GRID_MOVE',
  CROSS_GRID_MOVE:'CROSS_GRID_MOVE',
  PUT_AWAY_NONEMPTY:'PUT_AWAY_NONEMPTY',
  REPLACE_NONEMPTY:'REPLACE_NONEMPTY'
});

const ORIENTATIONS=new Set([
  'GridOrientation_Up','GridOrientation_UpUpRight','GridOrientation_UpRight','GridOrientation_UpRightRight',
  'GridOrientation_Right','GridOrientation_DownRightRight','GridOrientation_DownRight','GridOrientation_DownDownRight',
  'GridOrientation_Down','GridOrientation_DownDownLeft','GridOrientation_DownLeft','GridOrientation_DownLeftLeft',
  'GridOrientation_Left','GridOrientation_UpLeftLeft','GridOrientation_UpLeft','GridOrientation_UpUpLeft'
]);

function isObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function int(v){const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:null;}
function clone(v){return structuredClone(v);}
function own(o,k){return Boolean(isObj(o)&&Object.prototype.hasOwnProperty.call(o,String(k)));}
function ptr(v){return String(v).replaceAll('~','~0').replaceAll('/','~1');}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function uniq(xs){return [...new Set(xs)];}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
function fail(reasons,extra={}){return freeze({
  contract:STORAGE_CONTAINER_CONTRACT,status:'REJECTED',ok:false,reasonCodes:uniq(reasons),
  persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,
  productApplyAuthorized:false,directSourceReplacementAuthorized:false,...extra
});}
function ready(extra={}){return freeze({
  contract:STORAGE_CONTAINER_CONTRACT,status:'READY',ok:true,reasonCodes:[],
  persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,
  productApplyAuthorized:false,directSourceReplacementAuthorized:false,...extra
});}
function sourceReasons(source){
  const out=[];
  if(source?.platform!=='Nintendo Switch')out.push('EXACT_SWITCH_PLATFORM_REQUIRED');
  if(source?.gameVersion!==GAME_VERSION)out.push('EXACT_GAME_VERSION_REQUIRED');
  if(Number(source?.profileSchemaVersion)!==PROFILE_SCHEMA)out.push('EXACT_PROFILE_SCHEMA_REQUIRED');
  if(source?.buildIdentity!==SWITCH_BID)out.push('EXACT_SWITCH_BID_REQUIRED');
  return out;
}
function gridOf(profile,id){return profile?.World?.GridCollection?.Grids?.[String(id)]??profile?.World?.GridCollection?.Grids?.[id]??null;}
function objectOf(grid,id){return grid?.Objects?.[String(id)]??grid?.Objects?.[id]??null;}
function containerMap(profile){return profile?.Player?.ContainerInventories;}
function listInventoryOf(profile,id){return profile?.Player?.ListInventories?.[String(id)]??profile?.Player?.ListInventories?.[id]??null;}
function storageStateOf(obj){
  const state=isObj(obj?.State)?obj.State:null;
  const storage=isObj(state?.Storage)?state.Storage:null;
  return {state,storage};
}
function inventorySlots(container,reasons){
  const slots=container?.Inventory;
  if(!Array.isArray(slots)){reasons.push('CONTAINER_INVENTORY_SLOTS_ARRAY_REQUIRED');return [];}
  for(const slot of slots){
    if(!isObj(slot)){reasons.push('CONTAINER_SLOT_INVALID');continue;}
    const amount=Number(slot.Amount);
    if(!Number.isSafeInteger(amount)||amount<0)reasons.push('CONTAINER_SLOT_AMOUNT_INVALID');
  }
  return slots;
}
function nonempty(slots){return slots.some(slot=>Number(slot?.Amount)>0);}
function validateItemDefinition(itemDefinition,itemId,reasons){
  if(!isObj(itemDefinition)||Number(itemDefinition.itemId)!==itemId)reasons.push('EXACT_STORAGE_ITEM_DEFINITION_REQUIRED');
  if(itemDefinition?.concreteType!=='FurnitureItemData'||itemDefinition?.interaction!=='Container')
    reasons.push('FURNITURE_CONTAINER_INTERACTION_REQUIRED');
  const size=int(itemDefinition?.defaultContainerSize);
  if(size===null||size<=0)reasons.push('DEFAULT_CONTAINER_SIZE_REQUIRED');
  return size;
}
function validateActiveEvidence(evidence,containerId,reasons){
  if(!isObj(evidence)||evidence.contract!==ACTIVE_REFERENCE_EVIDENCE_CONTRACT||
     evidence.status!=='COMPLETE_CURRENT_SAVE'||Number(evidence.containerInventoryId)!==containerId||
     !Array.isArray(evidence.references)){
    reasons.push('COMPLETE_ACTIVE_STORAGE_REFERENCE_EVIDENCE_REQUIRED');return [];
  }
  const refs=[];
  for(const r of evidence.references){
    const gridId=int(r?.gridId),gridObjectId=int(r?.gridObjectId),itemId=int(r?.itemId);
    if(gridId===null||gridObjectId===null||itemId===null){reasons.push('ACTIVE_STORAGE_REFERENCE_INVALID');continue;}
    refs.push({gridId,gridObjectId,itemId});
  }
  const keys=refs.map(r=>`${r.gridId}:${r.gridObjectId}`);
  if(new Set(keys).size!==keys.length)reasons.push('ACTIVE_STORAGE_REFERENCE_DUPLICATE');
  return refs;
}
function validateContainer(profile,containerId,itemId,expectedSize,reasons){
  const containers=containerMap(profile);
  if(!isObj(containers)){reasons.push('CONTAINER_INVENTORY_MAP_REQUIRED');return {container:null,slots:[]};}
  const container=containers[String(containerId)]??containers[containerId];
  if(!isObj(container)){reasons.push('CONTAINER_INVENTORY_MISSING');return {container:null,slots:[]};}
  if(int(container.ID)!==containerId)reasons.push('CONTAINER_MAP_KEY_ID_MISMATCH');
  if(container.BelongsToPlayer!==true)reasons.push('PLAYER_OWNED_CONTAINER_REQUIRED');
  if(int(container.ParentItemID)!==itemId)reasons.push('CONTAINER_PARENT_ITEM_ID_MISMATCH');
  if(int(container.Size)!==expectedSize)reasons.push('CONTAINER_SIZE_DEFINITION_MISMATCH');
  const slots=inventorySlots(container,reasons);
  return {container,slots};
}
function validateListStock(profile,listInventoryId,itemId,reasons,{minimum=0}={}){
  const id=int(listInventoryId);
  if(id===null){reasons.push('LIST_INVENTORY_ID_REQUIRED');return null;}
  const inventory=listInventoryOf(profile,id);
  if(!isObj(inventory)){reasons.push('LIST_INVENTORY_REQUIRED');return null;}
  const data=inventory?.Inventory?.[String(itemId)]??inventory?.Inventory?.[itemId];
  if(!isObj(data)){reasons.push('EXISTING_LIST_INVENTORY_ITEM_ENTRY_REQUIRED');return null;}
  const amount=int(data.Amount);
  if(amount===null){reasons.push('LIST_INVENTORY_AMOUNT_INVALID');return null;}
  if(amount<minimum)reasons.push('INSUFFICIENT_LIST_INVENTORY_STOCK');
  return {listInventoryId:id,inventory,data,amount};
}
function placementOk(evidence,{gridId,itemId,x,y,orientation}){
  return Boolean(
    isObj(evidence)&&evidence.status==='VALID'&&evidence.valid===true&&evidence.clearArea===false&&
    Number(evidence.gridId)===gridId&&Number(evidence.itemId)===itemId&&
    Number(evidence.x)===x&&Number(evidence.y)===y&&String(evidence.orientation)===String(orientation)
  );
}
function destination(profile,{gridId,x,y,orientation},itemId,placementEvidence,reasons){
  const gid=int(gridId),px=int(x),py=int(y);
  if(gid===null||px===null||py===null||!ORIENTATIONS.has(String(orientation))){
    reasons.push('DESTINATION_TRANSFORM_REQUIRED');return null;
  }
  const grid=gridOf(profile,gid);
  if(!isObj(grid)||int(grid.ID)!==gid){reasons.push('DESTINATION_GRID_REQUIRED');return null;}
  const next=int(grid.NextGridObjectID);
  if(next===null){reasons.push('DESTINATION_NEXT_GRID_OBJECT_ID_REQUIRED');return null;}
  if(own(grid.Objects,next))reasons.push('DESTINATION_NEXT_GRID_OBJECT_ID_ALREADY_PRESENT');
  if(!placementOk(placementEvidence,{gridId:gid,itemId,x:px,y:py,orientation:String(orientation)}))
    reasons.push('EXACT_V125_CLEAR_AREA_FALSE_PLACEMENT_EVIDENCE_REQUIRED');
  return {gridId:gid,x:px,y:py,orientation:String(orientation),grid,nextGridObjectId:next};
}

export function resolvePlacedStorageFurnitureV125({
  source,profile,gridId,gridObjectId,itemDefinition,activeReferenceEvidence,listInventoryId
}={}){
  const reasons=sourceReasons(source);
  const gid=int(gridId),oid=int(gridObjectId);
  if(gid===null||oid===null)reasons.push('PLACED_STORAGE_ADDRESS_REQUIRED');
  const grid=gid===null?null:gridOf(profile,gid);
  if(!isObj(grid)||int(grid?.ID)!==gid)reasons.push('PLACED_STORAGE_GRID_REQUIRED');
  const object=grid&&oid!==null?objectOf(grid,oid):null;
  if(!isObj(object)||int(object?.ID)!==oid)reasons.push('PLACED_STORAGE_GRID_OBJECT_REQUIRED');
  const itemId=int(object?.ItemID);
  if(itemId===null)reasons.push('PLACED_STORAGE_ITEM_ID_REQUIRED');
  const expectedSize=itemId===null?null:validateItemDefinition(itemDefinition,itemId,reasons);
  const {state,storage}=storageStateOf(object);
  if(!state||!storage)reasons.push('GRID_STATE_STORAGE_REQUIRED');
  const containerId=int(storage?.ContainerInventoryID);
  if(containerId===null)reasons.push('STORAGE_CONTAINER_INVENTORY_ID_REQUIRED');
  let container=null,slots=[];
  if(containerId!==null&&itemId!==null&&expectedSize!==null){
    ({container,slots}=validateContainer(profile,containerId,itemId,expectedSize,reasons));
  }
  const refs=containerId===null?[]:validateActiveEvidence(activeReferenceEvidence,containerId,reasons);
  if(containerId!==null){
    if(refs.length!==1)reasons.push('EXACTLY_ONE_ACTIVE_STORAGE_REFERENCE_REQUIRED');
    else if(refs[0].gridId!==gid||refs[0].gridObjectId!==oid||refs[0].itemId!==itemId)
      reasons.push('ACTIVE_STORAGE_REFERENCE_ADDRESS_MISMATCH');
  }
  const list=itemId===null?null:validateListStock(profile,listInventoryId,itemId,reasons);
  if(reasons.length)return fail(reasons,{address:{gridId:gid,gridObjectId:oid}});
  return ready({
    state:'PLACED',
    address:{gridId:gid,gridObjectId:oid},
    itemId,containerInventoryId:containerId,expectedContainerSize:expectedSize,
    object:clone(object),gridState:clone(state),storageState:clone(storage),
    container:clone(container),slots:clone(slots),contentsNonEmpty:nonempty(slots),
    listInventory:{id:list.listInventoryId,amount:list.amount,marker:clone(list.data.Marker)},
    activeReferences:clone(refs),
    identityModel:{
      furnitureItemId:'GridObject.ItemID == ContainerInventory.ParentItemID',
      placedIdentity:'(GridID, GridObjectID)',
      storageIdentity:'ProfilePlayer.ContainerInventories[StorageGridData.ContainerInventoryID]',
      portableContainerIdentity:false
    }
  });
}

export function resolveStoredStorageContainerV125({
  source,profile,containerInventoryId,itemDefinition,activeReferenceEvidence,listInventoryId,gridObjectTemplate
}={}){
  const reasons=sourceReasons(source);
  const containerId=int(containerInventoryId),itemId=int(itemDefinition?.itemId);
  if(containerId===null)reasons.push('STORED_CONTAINER_INVENTORY_ID_REQUIRED');
  if(itemId===null)reasons.push('STORED_STORAGE_ITEM_ID_REQUIRED');
  const expectedSize=itemId===null?null:validateItemDefinition(itemDefinition,itemId,reasons);
  let container=null,slots=[];
  if(containerId!==null&&itemId!==null&&expectedSize!==null){
    ({container,slots}=validateContainer(profile,containerId,itemId,expectedSize,reasons));
  }
  const refs=containerId===null?[]:validateActiveEvidence(activeReferenceEvidence,containerId,reasons);
  if(refs.length!==0)reasons.push('STORED_CONTAINER_MUST_HAVE_ZERO_ACTIVE_REFERENCES');
  if(!nonempty(slots))reasons.push('NONEMPTY_STORED_CONTAINER_REQUIRED');
  const list=itemId===null?null:validateListStock(profile,listInventoryId,itemId,reasons,{minimum:1});
  const template=isObj(gridObjectTemplate)?clone(gridObjectTemplate):null;
  const templateStorage=storageStateOf(template).storage;
  if(!template||int(template.ItemID)!==itemId||int(templateStorage?.ContainerInventoryID)!==containerId)
    reasons.push('HASH_BOUND_SAME_SAVE_GRID_OBJECT_TEMPLATE_REQUIRED');
  if(reasons.length)return fail(reasons,{containerInventoryId:containerId});
  return ready({
    state:'STORED_UNPLACED_NONEMPTY',
    itemId,containerInventoryId:containerId,expectedContainerSize:expectedSize,
    container:clone(container),slots:clone(slots),contentsNonEmpty:true,
    listInventory:{id:list.listInventoryId,amount:list.amount,marker:clone(list.data.Marker)},
    activeReferences:[],
    gridObjectTemplate:template,
    identityModel:{
      storageIdentity:'ContainerInventoryID remains the persistent content identity',
      placedIdentity:'none while unplaced',
      parentItemId:itemId,
      portableContainerIdentity:false
    }
  });
}

function transition(kind,extra){
  return freeze({
    contract:STORAGE_TRANSITION_CONTRACT,kind,status:'STATIC_NATIVE_CLOSED_SAVE_LAYER_EXTENSION_REQUIRED',
    persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,
    productApplyAuthorized:false,directSourceReplacementAuthorized:false,...extra
  });
}
function requireResolved(r,state){
  if(!r||r.contract!==STORAGE_CONTAINER_CONTRACT||r.status!=='READY'||r.state!==state)
    throw Error('STORAGE_RESOLUTION_REQUIRED');
}
function baseObjectForDestination(sourceObject,id,d){
  const out=clone(sourceObject);
  out.ID=id;out.X=d.x;out.Y=d.y;out.Orientation=d.orientation;
  return out;
}

export function compileStorageSameGridMoveV125({resolved,profile,destination:dest,placementEvidence}={}){
  requireResolved(resolved,'PLACED');
  const reasons=[];
  const d=destination(profile,{...dest,gridId:resolved.address.gridId},resolved.itemId,placementEvidence,reasons);
  if(reasons.length)throw Error(reasons.join(','));
  const root=`/World/GridCollection/Grids/${ptr(resolved.address.gridId)}/Objects/${ptr(resolved.address.gridObjectId)}`;
  return transition(STORAGE_TRANSITION.SAME_GRID_MOVE,{
    existing01AReusableWithoutChange:true,
    capability:'WRITE_CANDIDATE',targetKind:'GRID_OBJECT',
    sourceAddress:clone(resolved.address),destinationAddress:clone(resolved.address),
    containerInventoryId:resolved.containerInventoryId,
    allowedChanges:[
      {path:`${root}/X`,value:d.x},
      {path:`${root}/Y`,value:d.y},
      {path:`${root}/Orientation`,value:d.orientation}
    ],
    exactPreservation:[
      `${root}/ID`,`${root}/ItemID`,`${root}/State`,
      `/Player/ContainerInventories/${ptr(resolved.containerInventoryId)}`,
      `/Player/ListInventories/${ptr(resolved.listInventory.id)}`
    ],
    semantics:'GridObject identity and StorageGridData.ContainerInventoryID stay stable; ContainerInventory and ListInventory remain exact.'
  });
}

export function compileStorageCrossGridMoveV125({resolved,profile,destination:dest,placementEvidence}={}){
  requireResolved(resolved,'PLACED');
  const reasons=[];
  const d=destination(profile,dest,resolved.itemId,placementEvidence,reasons);
  if(d&&d.gridId===resolved.address.gridId)reasons.push('CROSS_GRID_DESTINATION_MUST_DIFFER');
  if(reasons.length)throw Error(reasons.join(','));
  const newObject=baseObjectForDestination(resolved.object,d.nextGridObjectId,d);
  const stateId=int(storageStateOf(newObject).storage?.ContainerInventoryID);
  if(stateId!==resolved.containerInventoryId)throw Error('CROSS_GRID_STORAGE_ID_PRESERVATION_FAILED');
  const sourcePath=`/World/GridCollection/Grids/${ptr(resolved.address.gridId)}/Objects/${ptr(resolved.address.gridObjectId)}`;
  const destPath=`/World/GridCollection/Grids/${ptr(d.gridId)}/Objects/${ptr(d.nextGridObjectId)}`;
  return transition(STORAGE_TRANSITION.CROSS_GRID_MOVE,{
    existing01AReusableWithoutChange:false,upstreamRequestId:STORAGE_01A_REQUEST_ID,
    requiredTargetKind:'STORAGE_FURNITURE_TRANSITION',
    sourceAddress:clone(resolved.address),
    destinationAddress:{gridId:d.gridId,gridObjectId:d.nextGridObjectId},
    containerInventoryId:resolved.containerInventoryId,
    mutation:{
      remove:{path:sourcePath},
      add:{path:destPath,value:newObject},
      nextGridObjectID:{path:`/World/GridCollection/Grids/${ptr(d.gridId)}/NextGridObjectID`,before:d.nextGridObjectId,after:d.nextGridObjectId+1}
    },
    exactPreservation:[
      `/Player/ContainerInventories/${ptr(resolved.containerInventoryId)}`,
      `/Player/ListInventories/${ptr(resolved.listInventory.id)}`
    ],
    semantics:'Native SwitchGridObjectGrid preserves GridState and bypasses ordinary StorageGridData deinitialization; GridObject address changes while ContainerInventoryID and contents stay stable.'
  });
}

export function compileStoragePutAwayNonemptyV125({resolved}={}){
  requireResolved(resolved,'PLACED');
  if(!resolved.contentsNonEmpty)throw Error('NONEMPTY_STORAGE_REQUIRED');
  const amount=resolved.listInventory.amount;
  return transition(STORAGE_TRANSITION.PUT_AWAY_NONEMPTY,{
    existing01AReusableWithoutChange:false,upstreamRequestId:STORAGE_01A_REQUEST_ID,
    requiredTargetKind:'STORAGE_FURNITURE_TRANSITION',
    sourceAddress:clone(resolved.address),destinationAddress:null,
    itemId:resolved.itemId,containerInventoryId:resolved.containerInventoryId,
    mutation:{
      remove:{path:`/World/GridCollection/Grids/${ptr(resolved.address.gridId)}/Objects/${ptr(resolved.address.gridObjectId)}`},
      listStock:{path:`/Player/ListInventories/${ptr(resolved.listInventory.id)}/Inventory/${ptr(resolved.itemId)}/Amount`,before:amount,after:amount+1}
    },
    exactPreservation:[`/Player/ContainerInventories/${ptr(resolved.containerInventoryId)}`],
    postState:'STORED_UNPLACED_NONEMPTY',
    semantics:'PickUpListItem removes the GridObject, StorageGridData.Deinitialize orphans rather than deletes a non-empty player ContainerInventory, then ListInventory stock increases by one.'
  });
}

export function compileStorageRePlaceNonemptyV125({resolvedStored,profile,destination:dest,placementEvidence}={}){
  requireResolved(resolvedStored,'STORED_UNPLACED_NONEMPTY');
  const reasons=[];
  const d=destination(profile,dest,resolvedStored.itemId,placementEvidence,reasons);
  if(reasons.length)throw Error(reasons.join(','));
  const newObject=baseObjectForDestination(resolvedStored.gridObjectTemplate,d.nextGridObjectId,d);
  if(int(storageStateOf(newObject).storage?.ContainerInventoryID)!==resolvedStored.containerInventoryId)
    throw Error('REPLACE_STORAGE_ID_PRESERVATION_FAILED');
  const amount=resolvedStored.listInventory.amount;
  return transition(STORAGE_TRANSITION.REPLACE_NONEMPTY,{
    existing01AReusableWithoutChange:false,upstreamRequestId:STORAGE_01A_REQUEST_ID,
    requiredTargetKind:'STORAGE_FURNITURE_TRANSITION',
    sourceAddress:null,destinationAddress:{gridId:d.gridId,gridObjectId:d.nextGridObjectId},
    itemId:resolvedStored.itemId,containerInventoryId:resolvedStored.containerInventoryId,
    mutation:{
      add:{path:`/World/GridCollection/Grids/${ptr(d.gridId)}/Objects/${ptr(d.nextGridObjectId)}`,value:newObject},
      nextGridObjectID:{path:`/World/GridCollection/Grids/${ptr(d.gridId)}/NextGridObjectID`,before:d.nextGridObjectId,after:d.nextGridObjectId+1},
      listStock:{path:`/Player/ListInventories/${ptr(resolvedStored.listInventory.id)}/Inventory/${ptr(resolvedStored.itemId)}/Amount`,before:amount,after:amount-1}
    },
    exactPreservation:[`/Player/ContainerInventories/${ptr(resolvedStored.containerInventoryId)}`],
    postState:'PLACED',
    nativeSelectionBoundary:'Native PutDownListItem does not name ContainerInventoryID; exact orphan chosen depends on runtime orphan-cache ordering when multiple compatible records exist.',
    directBindingBoundary:'Wand may only bind the explicit same-save ContainerInventoryID when the hash-bound GridObject template and complete zero-reference evidence are supplied; runtime acceptance is required before promotion.'
  });
}

export function storageContainerUpstreamNeedV125(){
  return freeze({
    requestId:STORAGE_01A_REQUEST_ID,required:true,
    existing01ASufficient:{
      SAME_GRID_MOVE:true,CROSS_GRID_MOVE:false,PUT_AWAY_NONEMPTY:false,REPLACE_NONEMPTY:false
    },
    minimumExtension:{
      capability:'STRUCTURAL_WRITE_CANDIDATE',
      targetKind:'STORAGE_FURNITURE_TRANSITION',
      genericWriterRequired:false,arbitraryJsonPatchRequired:false,genericContainerInventoryWriterRequired:false,
      allowedModes:['CROSS_GRID_MOVE','PUT_AWAY_NONEMPTY','REPLACE_NONEMPTY'],
      containerInventoryMutation:'FORBIDDEN_PRESERVE_EXACT',
      nextContainerInventoryIDMutation:'FORBIDDEN',
      ownershipEntitlementMutation:'FORBIDDEN'
    },
    runtimeAfterExtension:{
      requestId:STORAGE_01E_REQUEST_ID,
      requiredFor:['CROSS_GRID_MOVE direct post-state','PUT_AWAY_NONEMPTY direct post-state','REPLACE_NONEMPTY explicit same-save ContainerInventoryID binding']
    },
    hardFlags:{
      persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,
      productApplyAuthorized:false,directSourceReplacementAuthorized:false
    }
  });
}
