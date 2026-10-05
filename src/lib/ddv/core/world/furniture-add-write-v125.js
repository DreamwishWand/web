/* Dreamwish Wand DDV Core 01B — ordinary Furniture ADD semantic contract.
 * Nintendo Switch DDV v1.25.0 only.
 * Semantic owner adapter for 01A STRUCTURAL_WRITE_CANDIDATE / GRID_OBJECT_SET.
 * This module does NOT authorize persistent replacement or Apply.
 */
'use strict';

export const FURNITURE_ADD_CONTRACT='ddv.ordinary-furniture-add-semantics@1';
export const ADMISSIBILITY_SCHEMA='ddv.ordinary-furniture-add-admissibility@1';
export const MUTATION_ADAPTER_CONTRACT='dreamwish.ddv.save-mutation-adapter@1';
export const MUTATION_ADAPTER_ID='01b-ordinary-root-furniture-add-v125-v1';
export const SEMANTIC_OWNER='01B CORE - World / Grid / Buildings';
export const GAME_VERSION='1.25.0';
export const PROFILE_SCHEMA=624;
export const SWITCH_BID='52BD625D9B4E0053';
export const TITLE_ID='0100D39012C1A000';
export const PLACEMENT_REVISION='V125_NATIVE_ORDINARY_CARDINAL_NONWALL_GROUPSET_2';
export const CARDINAL_ORIENTATIONS=Object.freeze([0,4,8,12]);
export const ORIENTATION_NAMES=Object.freeze([
  'GridOrientation_Up','GridOrientation_UpUpRight','GridOrientation_UpRight','GridOrientation_UpRightRight',
  'GridOrientation_Right','GridOrientation_DownRightRight','GridOrientation_DownRight','GridOrientation_DownDownRight',
  'GridOrientation_Down','GridOrientation_DownDownLeft','GridOrientation_DownLeft','GridOrientation_DownLeftLeft',
  'GridOrientation_Left','GridOrientation_UpLeftLeft','GridOrientation_UpLeft','GridOrientation_UpUpLeft'
]);
const CARDINAL=new Set(CARDINAL_ORIENTATIONS);
const SERIALIZED_KEYS=Object.freeze(['ID','ItemID','X','Y','Orientation','State']);

function clone(v){return structuredClone(v);}
function arr(v){return Array.isArray(v)?v:[];}
function int(v){const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function unique(v){return [...new Set(v)];}
function ptr(v){return String(v).replaceAll('~','~0').replaceAll('/','~1');}
function gridOf(profile,gridId){return profile?.World?.GridCollection?.Grids?.[String(gridId)]??profile?.World?.GridCollection?.Grids?.[gridId]??null;}
function objectMap(grid){return grid?.Objects&&typeof grid.Objects==='object'&&!Array.isArray(grid.Objects)?grid.Objects:null;}
function normalizedOrientation(v){const n=int(v);if(n!==null)return n;const i=ORIENTATION_NAMES.indexOf(String(v));return i>=0?i:null;}
function result(status,reasons,extra={}){return Object.freeze({
  schema:ADMISSIBILITY_SCHEMA,contract:FURNITURE_ADD_CONTRACT,status,
  admissible:status==='ADMISSIBLE',reasonCodes:Object.freeze(unique(reasons)),
  persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,...extra
});}
function exactItemFamily(scope){return Boolean(
  scope?.concreteType==='FurnitureItemData'&&
  scope?.scopeTier==='CORE_STATELESS_FURNITURE'&&
  scope?.interaction==='None'&&
  scope?.isMissionItem===false&&
  scope?.forPuzzleOnly===false&&
  (scope?.explicitGridEditRestriction===null||scope?.explicitGridEditRestriction===false)&&
  arr(scope?.nativePresetKnownRejectReasons).length===0&&
  scope?.isSyncOnlineItem===false&&
  Number.isSafeInteger(Number(scope?.itemID))
);}
function placementClear(p){return Boolean(
  p&&p.revision===PLACEMENT_REVISION&&p.sameRootGrid===true&&
  p.clearArea===false&&p.automaticSpawning===false&&
  p.result?.status==='VALID'&&p.result?.valid===true&&p.result?.verdict==='VALID'
);}
function rootIntentClear(target){return Boolean(
  target?.relation==='ROOT'&&
  (target?.parentAddress===null||target?.parentAddress===undefined)&&
  target?.portableState===null&&arr(target?.dependencyIds).length===0
);}
function allGridObjectIds(objects,reasons){
  if(!objects)return [];
  const ids=[];
  for(const [key,raw] of Object.entries(objects)){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)){reasons.push('SOURCE_GRID_OBJECT_INVALID');continue;}
    const id=int(raw.ID);
    if(id===null||String(id)!==String(key)){reasons.push('SOURCE_OBJECT_MAP_KEY_ID_MISMATCH');continue;}
    ids.push(id);
  }
  return ids.sort((a,b)=>a-b);
}
function sourceCounterClear(grid,objects,reasons){
  const next=int(grid?.NextGridObjectID);
  if(next===null||next<0){reasons.push('NEXT_GRID_OBJECT_ID_REQUIRED');return null;}
  if(Object.prototype.hasOwnProperty.call(objects,String(next)))reasons.push('NEXT_GRID_OBJECT_ID_COLLISION');
  const ids=allGridObjectIds(objects,reasons);
  if(ids.length&&next<=ids.at(-1))reasons.push('NEXT_GRID_OBJECT_ID_NOT_ABOVE_OBSERVED');
  return {next,ids};
}
function exactSerializedObject({id,itemId,x,y,orientation}){
  return Object.freeze({ID:id,ItemID:itemId,X:x,Y:y,Orientation:ORIENTATION_NAMES[orientation],State:null});
}

export function classifyOrdinaryFurnitureAdd({source,profile,target,scopeRecord,placementEvidence}={}){
  const reasons=[];
  if(source?.platform!=='Nintendo Switch'||source?.gameVersion!==GAME_VERSION||Number(source?.profileSchemaVersion)!==PROFILE_SCHEMA||source?.buildIdentity!==SWITCH_BID)reasons.push('EXACT_SWITCH_V125_BUILD_REQUIRED');
  const gridId=int(target?.gridId),itemId=int(target?.itemId),x=int(target?.x),y=int(target?.y),orientation=normalizedOrientation(target?.orientation);
  if(gridId===null||itemId===null||x===null||y===null||orientation===null)reasons.push('ADD_TARGET_IDENTITY_AND_TRANSFORM_REQUIRED');
  if(orientation!==null&&!CARDINAL.has(orientation))reasons.push('CARDINAL_ORIENTATION_REQUIRED');
  if(!rootIntentClear(target))reasons.push('ROOT_STATELESS_CREATION_INTENT_REQUIRED');
  if(!exactItemFamily(scopeRecord)||Number(scopeRecord?.itemID)!==itemId)reasons.push('CORE_STATELESS_FURNITURE_SCOPE_REQUIRED');
  if(!placementClear(placementEvidence))reasons.push('V125_NATIVE_PLACEMENT_VALID_REQUIRED');
  const grid=gridId===null?null:gridOf(profile,gridId);
  if(!grid)reasons.push('TARGET_GRID_MISSING');
  else if(int(grid.ID)!==gridId)reasons.push('GRID_KEY_ID_MISMATCH');
  const objects=grid?objectMap(grid):null;
  if(grid&&!objects)reasons.push('TARGET_GRID_OBJECT_MAP_REQUIRED');
  const counter=grid&&objects?sourceCounterClear(grid,objects,reasons):null;
  if(reasons.length)return result('REJECTED',reasons,{target:clone(target??null)});
  const createdGridObjectId=counter.next;
  const serializedObject=exactSerializedObject({id:createdGridObjectId,itemId,x,y,orientation});
  return result('ADMISSIBLE',[],{
    target:Object.freeze({gridId,itemId,x,y,orientation,relation:'ROOT'}),
    createdGridObjectId,
    objectMapKey:String(createdGridObjectId),
    nextGridObjectIDBefore:createdGridObjectId,
    nextGridObjectIDAfter:createdGridObjectId+1,
    preservedGridObjectIds:Object.freeze(counter.ids),
    serializedObject,
    serializedObjectKeys:SERIALIZED_KEYS,
    omittedSerializedFields:Object.freeze(['From']),
    requiredState:null,
    nativePlacementRevision:PLACEMENT_REVISION,
    ownershipMutation:'NONE',
    runtimeGate:'NOT_REQUIRED_EXISTING_ORDINARY_COLD_LOAD_EVIDENCE',
    evidence:Object.freeze({
      itemFamily:'V125_CANONICAL_SCOPE_CORE_STATELESS_FURNITURE',
      placement:PLACEMENT_REVISION,
      saveShape:'SWITCH_V125_CURRENT_SAVE_12277_GRIDOBJECT_SIX_FIELD_AUDIT',
      structuralTransaction:'DDV_SAFE_STRUCTURAL_GRID_OBJECT_TRANSACTION_EXTENSION_V125_V1_0'
    })
  });
}

function gridPath(a,field){return `/World/GridCollection/Grids/${ptr(a.target.gridId)}/${field}`;}
function objectPath(a){return `/World/GridCollection/Grids/${ptr(a.target.gridId)}/Objects/${ptr(a.objectMapKey)}`;}

export function buildOrdinaryFurnitureAddTransactionPlan({admissibility,transactionInput,planId='01b-furniture-add-v125'}={}){
  if(!admissibility||admissibility.schema!==ADMISSIBILITY_SCHEMA||admissibility.status!=='ADMISSIBLE')throw Error('FURNITURE_ADD_ADMISSIBILITY_REQUIRED');
  const created=int(admissibility.createdGridObjectId),before=int(admissibility.nextGridObjectIDBefore),after=int(admissibility.nextGridObjectIDAfter);
  if(created===null||before===null||after===null||created!==before||after!==before+1)throw Error('FURNITURE_ADD_ID_ALLOCATION_INVALID');
  const oPath=objectPath(admissibility),nextPath=gridPath(admissibility,'NextGridObjectID');
  return Object.freeze({
    contract:'dreamwish.ddv.save-transaction-plan@1',planId,semanticOwner:SEMANTIC_OWNER,
    capabilityRequired:'STRUCTURAL_WRITE_CANDIDATE',input:clone(transactionInput),
    operation:{
      id:'WORLD_NEW_ROOT_STATELESS_FURNITURE_ADD_V125',owner:SEMANTIC_OWNER,kind:'ADD',
      structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true,runtimeGate:'NOT_REQUIRED'
    },
    target:{
      kind:'GRID_OBJECT_SET',gridId:admissibility.target.gridId,
      preservedGridObjectIds:[...admissibility.preservedGridObjectIds],
      createdGridObjectIds:[created],deletedGridObjectIds:[],replacementIdentityPairs:[],
      nextGridObjectIDBefore:before,nextGridObjectIDAfter:after
    },
    mutationAdapter:{contract:MUTATION_ADAPTER_CONTRACT,id:MUTATION_ADAPTER_ID,owner:SEMANTIC_OWNER},
    preconditions:[
      {path:gridPath(admissibility,'ID'),operator:'EQUALS',value:admissibility.target.gridId},
      {path:nextPath,operator:'EQUALS',value:before},
      {path:oPath,operator:'NOT_EXISTS'}
    ],
    allowedChanges:[
      {path:oPath,classification:'INTENTIONAL'},
      {path:nextPath,classification:'INTENTIONAL'}
    ],
    forbiddenPathPrefixes:[
      '/GameInfo','/Player','/World/PlayerHouses','/World/Shops','/World/Stores',
      '/World/ConditionalEventHistoryData','/World/DecorationPresets'
    ],
    postconditions:[
      {path:gridPath(admissibility,'ID'),operator:'EQUALS',value:admissibility.target.gridId},
      {path:nextPath,operator:'EQUALS',value:after},
      {path:oPath,operator:'EQUALS',value:clone(admissibility.serializedObject)}
    ],
    preservation:{
      gridObjectIdentityPolicy:'ALLOW_DECLARED_GRID_OBJECT_SET_DELTA',
      arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
      unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
      serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
      unknownPathPrefixes:['/World']
    },
    sourceEvidence:[
      {id:'DDV-SAFE-STRUCTURAL-GRID-OBJECT-TRANSACTION-EXTENSION-V125-V1_0',status:'INTEGRATOR_PROMOTED'},
      {id:'DDV-V1.25-FURNITURE-WRITE-SCOPE-CATALOG-2026-09-29',status:'CONFIRMED_CURRENT_V125_STATIC_CLASSIFICATION'},
      {id:'DDV-NATIVE-PLACEMENT-LEGALITY-V125-V1_9',status:'INTEGRATOR_PROMOTED'},
      {id:'SWITCH-V125-CURRENT-SAVE-GRIDOBJECT-SHAPE-AUDIT-2026-10-05',status:'CONFIRMED_CURRENT_SAVE'},
      {id:'SWITCH-V125-ORDINARY-PLACED-OBJECT-COLD-LOAD-OBSERVATION',status:'CONFIRMED_RUNTIME'}
    ],
    intent:{
      semanticContract:FURNITURE_ADD_CONTRACT,
      createdGridObjectId:created,objectMapKey:String(created),
      serializedObject:clone(admissibility.serializedObject),
      ownershipMutation:'NONE',persistentWriteAuthorized:false
    }
  });
}

function expectedObject(plan){return plan?.intent?.serializedObject;}
function assertExactObjectShape(obj){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('FURNITURE_ADD_SERIALIZED_OBJECT_REQUIRED');
  const keys=Object.keys(obj).sort(),expected=[...SERIALIZED_KEYS].sort();
  if(!same(keys,expected))throw Error('FURNITURE_ADD_SERIALIZED_OBJECT_SHAPE_MISMATCH');
  if(obj.State!==null||Object.prototype.hasOwnProperty.call(obj,'From'))throw Error('FURNITURE_ADD_STATE_OR_FROM_INVALID');
}
function assertPlanBinding(plan){
  if(!plan||plan.contract!=='dreamwish.ddv.save-transaction-plan@1')throw Error('FURNITURE_ADD_PLAN_REQUIRED');
  if(plan.semanticOwner!==SEMANTIC_OWNER||plan.operation?.owner!==SEMANTIC_OWNER)throw Error('FURNITURE_ADD_PLAN_OWNER_MISMATCH');
  if(plan.capabilityRequired!=='STRUCTURAL_WRITE_CANDIDATE'||plan.target?.kind!=='GRID_OBJECT_SET')throw Error('FURNITURE_ADD_STRUCTURAL_TARGET_REQUIRED');
  if(plan.operation?.id!=='WORLD_NEW_ROOT_STATELESS_FURNITURE_ADD_V125'||plan.operation?.kind!=='ADD')throw Error('FURNITURE_ADD_OPERATION_MISMATCH');
  if(plan.mutationAdapter?.contract!==MUTATION_ADAPTER_CONTRACT||plan.mutationAdapter?.id!==MUTATION_ADAPTER_ID||plan.mutationAdapter?.owner!==SEMANTIC_OWNER)throw Error('FURNITURE_ADD_ADAPTER_BINDING_MISMATCH');
  const created=arr(plan.target.createdGridObjectIds),deleted=arr(plan.target.deletedGridObjectIds),pairs=arr(plan.target.replacementIdentityPairs);
  if(created.length!==1||deleted.length||pairs.length)throw Error('FURNITURE_ADD_IDENTITY_DELTA_INVALID');
  const id=int(created[0]),before=int(plan.target.nextGridObjectIDBefore),after=int(plan.target.nextGridObjectIDAfter);
  if(id===null||before!==id||after!==id+1)throw Error('FURNITURE_ADD_COUNTER_TRANSITION_INVALID');
  if(plan.intent?.semanticContract!==FURNITURE_ADD_CONTRACT||plan.intent?.persistentWriteAuthorized!==false||plan.intent?.ownershipMutation!=='NONE')throw Error('FURNITURE_ADD_INTENT_CONTRACT_MISMATCH');
  if(String(plan.intent?.objectMapKey)!==String(id)||int(plan.intent?.createdGridObjectId)!==id)throw Error('FURNITURE_ADD_MAP_KEY_ID_MISMATCH');
  const obj=expectedObject(plan);assertExactObjectShape(obj);
  if(int(obj.ID)!==id||int(obj.ItemID)===null||int(obj.X)===null||int(obj.Y)===null||!CARDINAL.has(normalizedOrientation(obj.Orientation)))throw Error('FURNITURE_ADD_SERIALIZED_OBJECT_INVALID');
  const root=`/World/GridCollection/Grids/${ptr(plan.target.gridId)}`;
  const expectedPaths=[`${root}/NextGridObjectID`,`${root}/Objects/${ptr(id)}`].sort();
  const actualPaths=arr(plan.allowedChanges).map(x=>x?.path).sort();
  if(!same(expectedPaths,actualPaths))throw Error('FURNITURE_ADD_ALLOWED_PATHS_MISMATCH');
}

export const ordinaryFurnitureAddAdapter=Object.freeze({
  contract:MUTATION_ADAPTER_CONTRACT,id:MUTATION_ADAPTER_ID,owner:SEMANTIC_OWNER,
  apply(draft,intent,plan){
    assertPlanBinding(plan);
    const gridId=int(plan.target.gridId),id=int(plan.intent.createdGridObjectId),key=String(plan.intent.objectMapKey),obj=clone(plan.intent.serializedObject);
    const grid=gridOf(draft,gridId);if(!grid||int(grid.ID)!==gridId)throw Error('FURNITURE_ADD_TARGET_GRID_MISSING');
    const objects=objectMap(grid);if(!objects)throw Error('FURNITURE_ADD_TARGET_GRID_OBJECT_MAP_REQUIRED');
    if(int(grid.NextGridObjectID)!==id)throw Error('FURNITURE_ADD_NEXT_GRID_OBJECT_ID_DRIFT');
    if(Object.prototype.hasOwnProperty.call(objects,key))throw Error('FURNITURE_ADD_FRESH_ID_COLLISION');
    assertExactObjectShape(obj);
    objects[key]=obj;
    grid.NextGridObjectID=id+1;
  },
  persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false
});
