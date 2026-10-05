/* Dreamwish Wand DDV Core 01B — ordinary Furniture ADD semantic mutation.
 * Nintendo Switch DDV v1.25.0 only.
 * Semantic owner adapter for 01A STRUCTURAL_WRITE_CANDIDATE / GRID_OBJECT_SET.
 * This module does NOT authorize persistent replacement or Apply.
 */
'use strict';

export const ORDINARY_FURNITURE_ADD_CONTRACT='ddv.ordinary-furniture-add-semantics@1';
export const ADD_ADMISSIBILITY_SCHEMA='ddv.ordinary-furniture-add-admissibility@1';
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
const CREATED_OBJECT_KEYS=Object.freeze(['ID','ItemID','X','Y','Orientation','State']);

function clone(v){return structuredClone(v);}
function arr(v){return Array.isArray(v)?v:[];}
function int(v){const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function unique(xs){return [...new Set(xs)];}
function ptr(v){return String(v).replace(/~/g,'~0').replace(/\//g,'~1');}
function gridOf(profile,gridId){return profile?.World?.GridCollection?.Grids?.[String(gridId)]??profile?.World?.GridCollection?.Grids?.[gridId]??null;}
function normalizedOrientation(v){const n=int(v);if(n!==null)return n;const i=ORIENTATION_NAMES.indexOf(String(v));return i>=0?i:null;}
function orientationName(v){const n=normalizedOrientation(v);return n!==null?ORIENTATION_NAMES[n]:null;}
function result(status,reasons,extra={}){
  return Object.freeze({
    schema:ADD_ADMISSIBILITY_SCHEMA,
    contract:ORDINARY_FURNITURE_ADD_CONTRACT,
    status,
    admissible:status==='ADMISSIBLE',
    reasonCodes:Object.freeze(unique(reasons)),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    ...extra
  });
}
function exactItemFamily(scope){
  return Boolean(
    scope
    && scope.concreteType==='FurnitureItemData'
    && scope.scopeTier==='CORE_STATELESS_FURNITURE'
    && scope.interaction==='None'
    && scope.isMissionItem===false
    && scope.forPuzzleOnly===false
    && (scope.explicitGridEditRestriction===null||scope.explicitGridEditRestriction===false)
    && arr(scope.nativePresetKnownRejectReasons).length===0
    && scope.isSyncOnlineItem===false
    && scope.isUnavailableForGenerator===false
    && Number.isSafeInteger(Number(scope.itemID))
  );
}
function coreClassClear(c){
  return Boolean(
    c
    && c.concreteType==='FurnitureItemData'
    && c.stateKind==='NONE'
    && c.layer==='furniture'
    && c.editability==='editable'
    && arr(c.reasons).length===0
  );
}
function rootEvidenceClear(e,gridId){
  return Boolean(
    e
    && e.relation==='ROOT'
    && Number(e.gridId)===gridId
    && (e.parentAddress===null||e.parentAddress===undefined)
  );
}
function placementClear(e,target){
  const c=e?.candidate;
  return Boolean(
    e
    && e.revision===PLACEMENT_REVISION
    && e.sameRootGrid===true
    && e.clearArea===false
    && e.automaticSpawning===false
    && c
    && Number(c.itemId)===target.itemId
    && Number(c.x)===target.x
    && Number(c.y)===target.y
    && normalizedOrientation(c.orientation)===target.orientation
    && e.result?.status==='VALID'
    && e.result?.valid===true
    && e.result?.verdict==='VALID'
  );
}
function gridObjectInventory(grid,reasons){
  const objects=grid?.Objects;
  if(!objects||typeof objects!=='object'||Array.isArray(objects)){reasons.push('TARGET_GRID_OBJECT_MAP_REQUIRED');return null;}
  const ids=[];
  for(const [key,raw] of Object.entries(objects)){
    if(!raw||typeof raw!=='object'||Array.isArray(raw)){reasons.push('TARGET_GRID_OBJECT_INVALID');continue;}
    const id=int(raw.ID),itemId=int(raw.ItemID);
    if(id===null||itemId===null){reasons.push('TARGET_GRID_OBJECT_IDENTITY_INVALID');continue;}
    if(String(id)!==String(key)){reasons.push('TARGET_GRID_OBJECT_MAP_KEY_ID_MISMATCH');continue;}
    ids.push(id);
  }
  ids.sort((a,b)=>a-b);
  if(new Set(ids).size!==ids.length)reasons.push('TARGET_GRID_OBJECT_ID_DUPLICATE');
  return ids;
}

export function classifyOrdinaryFurnitureAdd({
  source,profile,target,scopeRecord,coreClassification,rootEvidence,placementEvidence
}={}){
  const reasons=[];
  if(source?.platform!=='Nintendo Switch'||source?.gameVersion!==GAME_VERSION||Number(source?.profileSchemaVersion)!==PROFILE_SCHEMA||source?.buildIdentity!==SWITCH_BID)
    reasons.push('EXACT_SWITCH_V125_BUILD_REQUIRED');

  const gridId=int(target?.gridId),itemId=int(target?.itemId),x=int(target?.x),y=int(target?.y),orientation=normalizedOrientation(target?.orientation);
  if(gridId===null||itemId===null||x===null||y===null||orientation===null)reasons.push('ADD_TARGET_REQUIRED');
  if(orientation!==null&&!CARDINAL.has(orientation))reasons.push('CARDINAL_ORIENTATION_REQUIRED');
  if(x!==null&&x<0)reasons.push('ADD_X_NEGATIVE');
  if(y!==null&&y<0)reasons.push('ADD_Y_NEGATIVE');

  const grid=gridId===null?null:gridOf(profile,gridId);
  if(!grid)reasons.push('TARGET_GRID_MISSING');
  else if(int(grid.ID)!==gridId)reasons.push('TARGET_GRID_IDENTITY_MISMATCH');

  const existingIds=grid?gridObjectInventory(grid,reasons):null;
  const next=grid?int(grid.NextGridObjectID):null;
  if(next===null||next<0)reasons.push('NEXT_GRID_OBJECT_ID_REQUIRED');
  if(existingIds&&next!==null&&existingIds.length&&next<=existingIds[existingIds.length-1])
    reasons.push('NEXT_GRID_OBJECT_ID_NOT_ABOVE_OBSERVED');
  if(grid?.Objects&&next!==null&&Object.prototype.hasOwnProperty.call(grid.Objects,String(next)))
    reasons.push('NEXT_GRID_OBJECT_ID_ALREADY_PRESENT');

  if(!exactItemFamily(scopeRecord)||Number(scopeRecord?.itemID)!==itemId)
    reasons.push('ADD_CORE_STATELESS_FURNITURE_SCOPE_REQUIRED');
  if(!coreClassClear(coreClassification))
    reasons.push('ADD_CORE_OBJECT_CLASSIFICATION_NOT_EDITABLE_STATELESS_FURNITURE');
  if(!rootEvidenceClear(rootEvidence,gridId))
    reasons.push('ADD_EXACT_ROOT_RELATION_REQUIRED');

  const normalizedTarget={gridId,itemId,x,y,orientation};
  if(gridId!==null&&itemId!==null&&x!==null&&y!==null&&orientation!==null&&!placementClear(placementEvidence,normalizedTarget))
    reasons.push('V125_NATIVE_PLACEMENT_VALID_REQUIRED');

  if(reasons.length)return result('REJECTED',reasons,{target:clone(target??null)});

  const createdObject=Object.freeze({
    ID:next,
    ItemID:itemId,
    X:x,
    Y:y,
    Orientation:ORIENTATION_NAMES[orientation],
    State:null
  });
  return result('ADMISSIBLE',[],{
    operation:'ADD',
    target:{
      gridId,
      itemId,
      x,
      y,
      orientation,
      objectMapKey:String(next),
      createdGridObjectId:next
    },
    existingGridObjectIds:Object.freeze([...existingIds]),
    nextGridObjectID:Object.freeze({before:next,after:next+1}),
    createdObject,
    serializedCreatedObjectFields:Object.freeze([...CREATED_OBJECT_KEYS]),
    initialStatePolicy:'STATE_NULL_ONLY',
    parentSupportPolicy:'ROOT_ONLY_NO_SUBGRID_PARENT',
    ownershipMutationPolicy:'FORBIDDEN_PRESERVE_EXACT',
    inventoryMutationPolicy:'FORBIDDEN_PRESERVE_EXACT',
    collectionMutationPolicy:'FORBIDDEN_PRESERVE_EXACT',
    entitlementMutationPolicy:'FORBIDDEN_PRESERVE_EXACT',
    storeMutationPolicy:'FORBIDDEN_PRESERVE_EXACT',
    nativePlacementRevision:PLACEMENT_REVISION,
    runtimeGate:'PENDING_01E_EXACT_ADD_AFTER_SEMANTIC_FREEZE',
    evidence:Object.freeze({
      itemFamily:'V125_CANONICAL_SCOPE_CORE_STATELESS_FURNITURE_GENERATOR_AVAILABLE',
      saveShape:'CURRENT_V125_GRIDOBJECT_SIX_FIELD_STATELESS_SHAPE',
      placement:PLACEMENT_REVISION,
      structuralFoundation:'DDV-SAFE-STRUCTURAL-GRID-OBJECT-TRANSACTION-EXTENSION-V125-V1_0'
    })
  });
}

function gridPointer(a,field){return `/World/GridCollection/Grids/${ptr(a.target.gridId)}/${field}`;}
function objectPointer(a){return `/World/GridCollection/Grids/${ptr(a.target.gridId)}/Objects/${ptr(a.target.objectMapKey)}`;}

export function buildOrdinaryFurnitureAddTransactionPlan({
  admissibility,transactionInput,planId='01b-ordinary-furniture-add-v125'
}={}){
  if(!admissibility||admissibility.schema!==ADD_ADMISSIBILITY_SCHEMA||admissibility.status!=='ADMISSIBLE')
    throw Error('ORDINARY_FURNITURE_ADD_ADMISSIBILITY_REQUIRED');
  const before=admissibility.nextGridObjectID.before,after=admissibility.nextGridObjectID.after;
  const objectPath=objectPointer(admissibility),nextPath=gridPointer(admissibility,'NextGridObjectID');
  const created=clone(admissibility.createdObject);
  return Object.freeze({
    contract:'dreamwish.ddv.save-transaction-plan@1',
    planId,
    semanticOwner:SEMANTIC_OWNER,
    capabilityRequired:'STRUCTURAL_WRITE_CANDIDATE',
    input:clone(transactionInput),
    operation:{
      id:'WORLD_ORDINARY_ROOT_STATELESS_FURNITURE_ADD_V125',
      owner:SEMANTIC_OWNER,
      kind:'ADD',
      structuralCapabilitiesSupported:true,
      planSupported:true,
      validationPassed:true,
      runtimeGate:'PENDING'
    },
    target:{
      kind:'GRID_OBJECT_SET',
      gridId:admissibility.target.gridId,
      preservedGridObjectIds:[...admissibility.existingGridObjectIds],
      createdGridObjectIds:[admissibility.target.createdGridObjectId],
      deletedGridObjectIds:[],
      replacementIdentityPairs:[],
      nextGridObjectIDBefore:before,
      nextGridObjectIDAfter:after
    },
    mutationAdapter:{contract:MUTATION_ADAPTER_CONTRACT,id:MUTATION_ADAPTER_ID,owner:SEMANTIC_OWNER},
    preconditions:[
      {path:gridPointer(admissibility,'ID'),operator:'EQUALS',value:admissibility.target.gridId},
      {path:nextPath,operator:'EQUALS',value:before},
      {path:objectPath,operator:'NOT_EXISTS'}
    ],
    allowedChanges:[
      {path:objectPath,classification:'INTENTIONAL'},
      {path:nextPath,classification:'INTENTIONAL'}
    ],
    forbiddenPathPrefixes:[
      '/GameInfo','/Player','/World/PlayerHouses','/World/Shops','/World/Stores',
      '/World/ConditionalEventHistoryData'
    ],
    postconditions:[
      {path:gridPointer(admissibility,'ID'),operator:'EQUALS',value:admissibility.target.gridId},
      {path:nextPath,operator:'EQUALS',value:after},
      {path:objectPath,operator:'EXISTS'},
      ...Object.entries(created).map(([field,value])=>({
        path:`${objectPath}/${field}`,operator:'EQUALS',value:clone(value)
      }))
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
      {id:'DDV-MINIMUM-PERSISTENT-TRANSFORM-SEMANTICS-V125-V1_0',status:'INTEGRATOR_PROMOTED_SAVE_SHAPE_EVIDENCE'},
      {id:'CURRENT-V125-OBSERVED-STATELESS-GRIDOBJECT-SHAPE',status:'CONFIRMED_CURRENT_SAVE'}
    ],
    intent:{
      operation:'ADD',
      semanticContract:ORDINARY_FURNITURE_ADD_CONTRACT,
      objectMapKey:admissibility.target.objectMapKey,
      createdObject:created,
      placementRevision:admissibility.nativePlacementRevision,
      inventoryMutation:false,
      ownershipMutation:false,
      collectionMutation:false,
      entitlementMutation:false,
      storeMutation:false,
      persistentWriteAuthorized:false
    }
  });
}

function expectedCreatedObject(plan){
  const v=plan?.intent?.createdObject;
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('ORDINARY_FURNITURE_ADD_CREATED_OBJECT_REQUIRED');
  const keys=Object.keys(v).sort(),expected=[...CREATED_OBJECT_KEYS].sort();
  if(!same(keys,expected))throw Error('ORDINARY_FURNITURE_ADD_CREATED_OBJECT_SHAPE_MISMATCH');
  const id=int(v.ID),itemId=int(v.ItemID),x=int(v.X),y=int(v.Y),ori=normalizedOrientation(v.Orientation);
  if(id===null||itemId===null||x===null||y===null||ori===null||!CARDINAL.has(ori)||v.State!==null)
    throw Error('ORDINARY_FURNITURE_ADD_CREATED_OBJECT_INVALID');
  if(v.Orientation!==ORIENTATION_NAMES[ori])throw Error('ORDINARY_FURNITURE_ADD_ORIENTATION_SERIALIZATION_MISMATCH');
  return clone(v);
}
function assertPlanBinding(plan){
  if(!plan||plan.contract!=='dreamwish.ddv.save-transaction-plan@1')throw Error('ORDINARY_FURNITURE_ADD_PLAN_REQUIRED');
  if(plan.semanticOwner!==SEMANTIC_OWNER||plan.operation?.owner!==SEMANTIC_OWNER)throw Error('ORDINARY_FURNITURE_ADD_OWNER_MISMATCH');
  if(plan.capabilityRequired!=='STRUCTURAL_WRITE_CANDIDATE')throw Error('ORDINARY_FURNITURE_ADD_CAPABILITY_MISMATCH');
  if(plan.operation?.id!=='WORLD_ORDINARY_ROOT_STATELESS_FURNITURE_ADD_V125'||plan.operation?.kind!=='ADD'||plan.operation?.runtimeGate!=='PENDING')
    throw Error('ORDINARY_FURNITURE_ADD_OPERATION_MISMATCH');
  if(plan.mutationAdapter?.contract!==MUTATION_ADAPTER_CONTRACT||plan.mutationAdapter?.id!==MUTATION_ADAPTER_ID||plan.mutationAdapter?.owner!==SEMANTIC_OWNER)
    throw Error('ORDINARY_FURNITURE_ADD_ADAPTER_BINDING_MISMATCH');
  if(plan.target?.kind!=='GRID_OBJECT_SET')throw Error('ORDINARY_FURNITURE_ADD_TARGET_KIND_MISMATCH');
  if(arr(plan.target.createdGridObjectIds).length!==1||arr(plan.target.deletedGridObjectIds).length!==0||arr(plan.target.replacementIdentityPairs).length!==0)
    throw Error('ORDINARY_FURNITURE_ADD_STRUCTURAL_DELTA_MISMATCH');
  const createdId=int(plan.target.createdGridObjectIds[0]),before=int(plan.target.nextGridObjectIDBefore),after=int(plan.target.nextGridObjectIDAfter);
  if(createdId===null||createdId!==before||after!==before+1)throw Error('ORDINARY_FURNITURE_ADD_ID_ALLOCATION_MISMATCH');
  const objectPath=`/World/GridCollection/Grids/${ptr(plan.target.gridId)}/Objects/${ptr(createdId)}`;
  const nextPath=`/World/GridCollection/Grids/${ptr(plan.target.gridId)}/NextGridObjectID`;
  const actual=arr(plan.allowedChanges).map(x=>x?.path).sort(),expected=[objectPath,nextPath].sort();
  if(!same(actual,expected))throw Error('ORDINARY_FURNITURE_ADD_ALLOWED_PATHS_MISMATCH');
  if(plan.intent?.semanticContract!==ORDINARY_FURNITURE_ADD_CONTRACT||plan.intent?.persistentWriteAuthorized!==false)
    throw Error('ORDINARY_FURNITURE_ADD_INTENT_CONTRACT_MISMATCH');
  for(const k of ['inventoryMutation','ownershipMutation','collectionMutation','entitlementMutation','storeMutation'])
    if(plan.intent?.[k]!==false)throw Error('ORDINARY_FURNITURE_ADD_UNRELATED_MUTATION_FORBIDDEN');
  const created=expectedCreatedObject(plan);
  if(int(created.ID)!==createdId)throw Error('ORDINARY_FURNITURE_ADD_CREATED_ID_MISMATCH');
  return {created,createdId,objectPath,nextPath};
}

export const ordinaryFurnitureAddAdapter=Object.freeze({
  contract:MUTATION_ADAPTER_CONTRACT,
  id:MUTATION_ADAPTER_ID,
  owner:SEMANTIC_OWNER,
  apply(draft,intent,plan){
    const bound=assertPlanBinding(plan);
    const grid=gridOf(draft,int(plan.target.gridId));
    if(!grid||int(grid.ID)!==int(plan.target.gridId))throw Error('ORDINARY_FURNITURE_ADD_TARGET_GRID_MISSING');
    if(!grid.Objects||typeof grid.Objects!=='object'||Array.isArray(grid.Objects))throw Error('ORDINARY_FURNITURE_ADD_OBJECT_MAP_REQUIRED');
    if(int(grid.NextGridObjectID)!==bound.createdId)throw Error('ORDINARY_FURNITURE_ADD_NEXT_GRID_OBJECT_ID_CHANGED');
    const key=String(bound.createdId);
    if(Object.prototype.hasOwnProperty.call(grid.Objects,key))throw Error('ORDINARY_FURNITURE_ADD_CREATED_ID_ALREADY_PRESENT');
    if(String(intent?.objectMapKey)!==key)throw Error('ORDINARY_FURNITURE_ADD_OBJECT_MAP_KEY_MISMATCH');
    if(!same(intent?.createdObject,bound.created))throw Error('ORDINARY_FURNITURE_ADD_INTENT_OBJECT_MISMATCH');
    grid.Objects[key]=clone(bound.created);
    grid.NextGridObjectID=bound.createdId+1;
  },
  persistentWriteAuthorized:false,
  WORLD_PERSISTENT_WRITE_V125:false
});
