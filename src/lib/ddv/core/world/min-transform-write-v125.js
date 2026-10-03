/* Dreamwish Wand DDV Core 01B — minimum persistent transform semantics.
 * Nintendo Switch DDV v1.25.0 only.
 * Semantic owner adapter for 01A WRITE_CANDIDATE plans.
 * This module does NOT authorize persistent replacement or Apply.
 */
'use strict';

export const MIN_TRANSFORM_CONTRACT='ddv.minimum-persistent-transform-semantics@1';
export const ADMISSIBILITY_SCHEMA='ddv.minimum-persistent-transform-admissibility@1';
export const MUTATION_ADAPTER_CONTRACT='dreamwish.ddv.save-mutation-adapter@1';
export const MUTATION_ADAPTER_ID='01b-minimum-root-furniture-transform-v125-v1';
export const SEMANTIC_OWNER='01B CORE - World / Grid / Buildings';
export const GAME_VERSION='1.25.0';
export const PROFILE_SCHEMA=624;
export const SWITCH_BID='52BD625D9B4E0053';
export const TITLE_ID='0100D39012C1A000';
export const CARDINAL_ORIENTATIONS=Object.freeze([0,4,8,12]);
export const ORIENTATION_NAMES=Object.freeze([
  'GridOrientation_Up','GridOrientation_UpUpRight','GridOrientation_UpRight','GridOrientation_UpRightRight',
  'GridOrientation_Right','GridOrientation_DownRightRight','GridOrientation_DownRight','GridOrientation_DownDownRight',
  'GridOrientation_Down','GridOrientation_DownDownLeft','GridOrientation_DownLeft','GridOrientation_DownLeftLeft',
  'GridOrientation_Left','GridOrientation_UpLeftLeft','GridOrientation_UpLeft','GridOrientation_UpUpLeft'
]);
const CARDINAL=new Set(CARDINAL_ORIENTATIONS);
const KNOWN_GRID_OBJECT_KEYS=new Set(['ID','ItemID','X','Y','Orientation','State']);

function clone(v){return structuredClone(v);}
function int(v){const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function arr(v){return Array.isArray(v)?v:[];}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function unique(xs){return [...new Set(xs)];}
function ptrSegment(v){return String(v).replace(/~/g,'~0').replace(/\//g,'~1');}
function gridOf(profile,gridId){return profile?.World?.GridCollection?.Grids?.[String(gridId)]??profile?.World?.GridCollection?.Grids?.[gridId]??null;}
function objectOf(grid,mapKey){return grid?.Objects?.[String(mapKey)]??grid?.Objects?.[mapKey]??null;}
function normalizedOrientation(v){
  const n=int(v);
  if(n!==null)return n;
  const i=ORIENTATION_NAMES.indexOf(String(v));return i>=0?i:null;
}
function result(status,reasons,extra={}){
  return Object.freeze({
    schema:ADMISSIBILITY_SCHEMA,
    contract:MIN_TRANSFORM_CONTRACT,
    status,
    admissible:status==='ADMISSIBLE',
    reasonCodes:Object.freeze(unique(reasons)),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    ...extra
  });
}
function exactItemFamily(scope){
  return scope?.concreteType==='FurnitureItemData'
    && scope.scopeTier==='CORE_STATELESS_FURNITURE'
    && scope.interaction==='None'
    && scope.isMissionItem===false
    && scope.forPuzzleOnly===false
    && (scope.explicitGridEditRestriction===null||scope.explicitGridEditRestriction===false)
    && arr(scope.nativePresetKnownRejectReasons).length===0
    && scope.isSyncOnlineItem===false
    && Number.isSafeInteger(Number(scope.itemID));
}
function progressionClear(rec,op,gridId,objectId,itemId){
  if(!rec||rec.schema!=='ddv.progression-destination-veto-record@1')return false;
  if(Number(rec?.gridObjectAddress?.gridId)!==gridId||Number(rec?.gridObjectAddress?.gridObjectId)!==objectId)return false;
  if(Number(rec.itemID)!==itemId)return false;
  if(rec.negativeVetoFound!==false||rec.destinationProtected!==false)return false;
  if(!['NONE_OBSERVED','HISTORICAL_ONLY'].includes(rec.activeReferenceDisposition))return false;
  if(arr(rec?.references?.active).length||arr(rec?.references?.unknown).length)return false;
  if(arr(rec?.operationVetoes?.[op]).length)return false;
  return true;
}
export const PLACEMENT_REVISION='V125_NATIVE_ORDINARY_CARDINAL_NONWALL_GROUPSET_2';
function placementClear(p){
  return Boolean(
    p
    && p.revision===PLACEMENT_REVISION
    && p.sameRootGrid===true
    && p.clearArea===false
    && p.automaticSpawning===false
    && p.result?.status==='VALID'
    && p.result?.valid===true
    && p.result?.verdict==='VALID'
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
function rootEvidenceClear(e,gridId,objectId,mapKey){
  return Boolean(
    e
    && e.relation==='ROOT'
    && Number(e.gridId)===gridId
    && Number(e.gridObjectId)===objectId
    && String(e.objectMapKey)===String(mapKey)
    && Number(e.rootGridId)===gridId
    && (e.parentAddress===null||e.parentAddress===undefined)
    && e.rootOwnershipResolved===true
    && Number(e.destinationRootGridId)===gridId
  );
}
function orientationSerializedLike(sourceRaw,n){return typeof sourceRaw==='string'?ORIENTATION_NAMES[n]:n;}
function transform(op,before,after,reasons){
  const bx=int(before?.x),by=int(before?.y),bo=normalizedOrientation(before?.orientation);
  const ax=int(after?.x),ay=int(after?.y),ao=normalizedOrientation(after?.orientation);
  if([bx,by,bo,ax,ay,ao].some(v=>v===null)){reasons.push('TRANSFORM_INTEGER_REQUIRED');return null;}
  if(!CARDINAL.has(bo)||!CARDINAL.has(ao)){reasons.push('CARDINAL_ORIENTATION_REQUIRED');return null;}
  if(op==='MOVE'){
    if(ao!==bo)reasons.push('MOVE_ORIENTATION_MUST_BE_PRESERVED');
    if(ax===bx&&ay===by)reasons.push('MOVE_NOOP_NOT_A_WRITE_CANDIDATE');
    return {before:{x:bx,y:by,orientation:bo},after:{x:ax,y:ay,orientation:ao},serializedBefore:{x:bx,y:by,orientation:before.orientation},serializedAfter:{x:ax,y:ay,orientation:before.orientation},allowedFields:['X','Y']};
  }
  if(op==='ROTATE'){
    if(ax!==bx||ay!==by)reasons.push('ROTATE_ANCHOR_MOVE_UNSUPPORTED');
    if(ao===bo)reasons.push('ROTATE_ORIENTATION_MUST_CHANGE');
    if(((ao-bo+16)%16)%4!==0)reasons.push('ROTATE_CARDINAL_DELTA_REQUIRED');
    return {before:{x:bx,y:by,orientation:bo},after:{x:ax,y:ay,orientation:ao},serializedBefore:{x:bx,y:by,orientation:before.orientation},serializedAfter:{x:bx,y:by,orientation:orientationSerializedLike(before.orientation,ao)},allowedFields:['Orientation']};
  }
  reasons.push('TRANSFORM_OPERATION_UNSUPPORTED');return null;
}

export function classifyMinimumPersistentTransform({
  source,profile,target,scopeRecord,coreClassification,rootEvidence,
  progressionRecord,placementEvidence,operation,finalTransform
}={}){
  const reasons=[];
  if(source?.platform!=='switch'||source?.gameVersion!==GAME_VERSION||Number(source?.profileSchemaVersion)!==PROFILE_SCHEMA||source?.buildIdentity!==SWITCH_BID)reasons.push('EXACT_SWITCH_V125_BUILD_REQUIRED');
  const gridId=int(target?.gridId),objectId=int(target?.gridObjectId),itemId=int(target?.itemId),mapKey=target?.objectMapKey;
  if(gridId===null||objectId===null||itemId===null||mapKey===undefined||mapKey===null)reasons.push('TARGET_IDENTITY_REQUIRED');
  const grid=gridId===null?null:gridOf(profile,gridId);
  if(!grid)reasons.push('TARGET_GRID_MISSING');
  else if(int(grid.ID)!==gridId)reasons.push('GRID_KEY_ID_MISMATCH');
  const object=grid?objectOf(grid,mapKey):null;
  if(!object)reasons.push('TARGET_OBJECT_MISSING');
  if(object){
    if(int(object.ID)!==objectId||String(object.ID)!==String(mapKey))reasons.push('OBJECT_MAP_KEY_ID_MISMATCH');
    if(int(object.ItemID)!==itemId)reasons.push('ITEM_IDENTITY_MISMATCH');
    if(object.State!==null)reasons.push('GRIDOBJECT_STATE_MUST_BE_NULL');
    const unknown=Object.keys(object).filter(k=>!KNOWN_GRID_OBJECT_KEYS.has(k));
    if(unknown.length)reasons.push('GRIDOBJECT_EXTRA_OR_SOURCE_FIELD_UNSUPPORTED');
  }
  if(!rootEvidenceClear(rootEvidence,gridId,objectId,mapKey))reasons.push('EXACT_ROOT_RELATION_REQUIRED');
  if(!exactItemFamily(scopeRecord)||Number(scopeRecord?.itemID)!==itemId)reasons.push('CORE_STATELESS_FURNITURE_SCOPE_REQUIRED');
  if(!coreClassClear(coreClassification))reasons.push('CORE_OBJECT_CLASSIFICATION_NOT_EDITABLE_STATELESS_FURNITURE');
  const op=String(operation||'');
  if(!['MOVE','ROTATE'].includes(op))reasons.push('TRANSFORM_OPERATION_UNSUPPORTED');
  if(!progressionClear(progressionRecord,op,gridId,objectId,itemId))reasons.push('PROGRESSION_CLEAR_REQUIRED');
  if(!placementClear(placementEvidence))reasons.push('V125_NATIVE_PLACEMENT_VALID_REQUIRED');
  const before=object?{x:object.X,y:object.Y,orientation:object.Orientation}:null;
  const tx=transform(op,before,finalTransform,reasons);
  if(grid&&int(grid.NextGridObjectID)===null)reasons.push('NEXT_GRID_OBJECT_ID_REQUIRED');
  if(reasons.length)return result('REJECTED',reasons,{operation:op,target:clone(target??null)});
  return result('ADMISSIBLE',[],{
    operation:op,
    target:{gridId,gridObjectId:objectId,itemId,objectMapKey:String(mapKey)},
    beforeTransform:tx.before,
    finalTransform:tx.after,
    serializedBeforeTransform:tx.serializedBefore,
    serializedFinalTransform:tx.serializedAfter,
    allowedSerializedFields:Object.freeze(tx.allowedFields),
    preservation:Object.freeze({
      ID:'UNCHANGED',ItemID:'UNCHANGED',State:'UNCHANGED_NULL',objectMapKey:'UNCHANGED',
      rootGridMembership:'UNCHANGED',parentRootRelationship:'UNCHANGED',
      NextGridObjectID:'UNCHANGED',unrelatedObjectState:'UNCHANGED',
      unknownOpaqueUnrelatedState:'UNCHANGED'
    }),
    nativePlacementRevision:PLACEMENT_REVISION,
    clearArea:false,
    runtimeGate:'PENDING_01E_AFTER_INTEGRATOR_PROMOTION',
    evidence:Object.freeze({
      itemFamily:'V125_CANONICAL_SCOPE_CORE_STATELESS_FURNITURE',
      progression:'V1_15_NO_ACTIVE_OR_UNKNOWN_OPERATION_VETO',
      placement:PLACEMENT_REVISION,
      nativeTransform:'SWITCH_V125_GRID_UPDATE_TRANSFORM_STATIC_CLOSURE'
    })
  });
}

function objectPointer(a,field){
  return `/World/GridCollection/Grids/${ptrSegment(a.target.gridId)}/Objects/${ptrSegment(a.target.objectMapKey)}/${field}`;
}
function gridPointer(a,field){
  return `/World/GridCollection/Grids/${ptrSegment(a.target.gridId)}/${field}`;
}
function expectedAllowedPaths(admissibility){
  const fields=admissibility.operation==='MOVE'?['X','Y']:['Orientation'];
  return fields.map(field=>objectPointer(admissibility,field));
}
function conditionsForTransform(admissibility,which){
  const t=which==='before'?admissibility.serializedBeforeTransform:admissibility.serializedFinalTransform;
  const out=[
    {path:objectPointer(admissibility,'ID'),operator:'EQUALS',value:admissibility.target.gridObjectId},
    {path:objectPointer(admissibility,'ItemID'),operator:'EQUALS',value:admissibility.target.itemId},
    {path:objectPointer(admissibility,'State'),operator:'EQUALS',value:null},
    {path:objectPointer(admissibility,'X'),operator:'EQUALS',value:t.x},
    {path:objectPointer(admissibility,'Y'),operator:'EQUALS',value:t.y},
    {path:objectPointer(admissibility,'Orientation'),operator:'EQUALS',value:t.orientation}
  ];
  return out;
}

export function buildMinimumTransformTransactionPlan({
  admissibility,transactionInput,nextGridObjectId,planId='01b-min-transform-v125'
}={}){
  if(!admissibility||admissibility.schema!==ADMISSIBILITY_SCHEMA||admissibility.status!=='ADMISSIBLE')throw Error('MIN_TRANSFORM_ADMISSIBILITY_REQUIRED');
  const next=int(nextGridObjectId);if(next===null)throw Error('MIN_TRANSFORM_NEXT_GRID_OBJECT_ID_REQUIRED');
  const allowedPaths=expectedAllowedPaths(admissibility);
  return Object.freeze({
    contract:'dreamwish.ddv.save-transaction-plan@1',
    planId,
    semanticOwner:SEMANTIC_OWNER,
    capabilityRequired:'WRITE_CANDIDATE',
    input:clone(transactionInput),
    operation:{
      id:'WORLD_EXISTING_ROOT_STATELESS_FURNITURE_TRANSFORM_V125',
      owner:SEMANTIC_OWNER,
      kind:admissibility.operation,
      structuralCapabilitiesSupported:true,
      planSupported:true,
      validationPassed:true,
      runtimeGate:'PENDING'
    },
    target:{kind:'GRID_OBJECT',gridId:admissibility.target.gridId,gridObjectId:admissibility.target.gridObjectId,itemId:admissibility.target.itemId},
    mutationAdapter:{contract:MUTATION_ADAPTER_CONTRACT,id:MUTATION_ADAPTER_ID,owner:SEMANTIC_OWNER},
    preconditions:[
      {path:gridPointer(admissibility,'ID'),operator:'EQUALS',value:admissibility.target.gridId},
      {path:gridPointer(admissibility,'NextGridObjectID'),operator:'EQUALS',value:next},
      ...conditionsForTransform(admissibility,'before')
    ],
    allowedChanges:allowedPaths.map(path=>({path,classification:'INTENTIONAL'})),
    forbiddenPathPrefixes:[
      '/GameInfo','/Player','/World/PlayerHouses','/World/Shops','/World/Stores',
      '/World/ConditionalEventHistoryData'
    ],
    postconditions:[
      {path:gridPointer(admissibility,'ID'),operator:'EQUALS',value:admissibility.target.gridId},
      {path:gridPointer(admissibility,'NextGridObjectID'),operator:'EQUALS',value:next},
      ...conditionsForTransform(admissibility,'after')
    ],
    preservation:{
      gridObjectIdentityPolicy:'PRESERVE_ALL_GRID_OBJECT_IDENTITIES',
      arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
      unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
      serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
      unknownPathPrefixes:[
        objectPointer(admissibility,'State'),
        '/World'
      ]
    },
    sourceEvidence:[
      {id:'DDV-SAFE-PERSISTENT-TRANSACTION-FOUNDATION-V125-V1_0',status:'INTEGRATOR_PROMOTED'},
      {id:'DDV-V1.25-FURNITURE-WRITE-SCOPE-CATALOG-2026-09-29',status:'CONFIRMED_CURRENT_V125_STATIC_CLASSIFICATION'},
      {id:'DDV-NATIVE-PLACEMENT-LEGALITY-V125-V1_9',status:'INTEGRATOR_PROMOTED'},
      {id:'DDV-PROGRESSION-DESTINATION-VETO-V125-V1_15',status:'INTEGRATOR_PROMOTED'},
      {id:'SWITCH-V125-GRID-UPDATE-TRANSFORM-STATIC-CLOSURE',status:'CONFIRMED'}
    ],
    intent:{
      operation:admissibility.operation,
      objectMapKey:admissibility.target.objectMapKey,
      finalTransform:clone(admissibility.finalTransform),
      beforeSerializedTransform:clone(admissibility.serializedBeforeTransform),
      finalSerializedTransform:clone(admissibility.serializedFinalTransform),
      semanticContract:MIN_TRANSFORM_CONTRACT,
      persistentWriteAuthorized:false
    }
  });
}

function conditionMap(conditions){
  const out=new Map();
  for(const c of arr(conditions))out.set(`${c?.path}|${c?.operator}`,c);
  return out;
}
function requireEqualsCondition(map,path,value,code){
  const c=map.get(`${path}|EQUALS`);
  if(!c||!same(c.value,value))throw Error(code);
}
function assertPlanBinding(plan){
  if(!plan||plan.contract!=='dreamwish.ddv.save-transaction-plan@1')throw Error('MIN_TRANSFORM_PLAN_REQUIRED');
  if(plan.semanticOwner!==SEMANTIC_OWNER||plan.operation?.owner!==SEMANTIC_OWNER)throw Error('MIN_TRANSFORM_PLAN_OWNER_MISMATCH');
  if(plan.mutationAdapter?.contract!==MUTATION_ADAPTER_CONTRACT||plan.mutationAdapter?.id!==MUTATION_ADAPTER_ID||plan.mutationAdapter?.owner!==SEMANTIC_OWNER)throw Error('MIN_TRANSFORM_ADAPTER_BINDING_MISMATCH');
  if(plan.operation?.id!=='WORLD_EXISTING_ROOT_STATELESS_FURNITURE_TRANSFORM_V125')throw Error('MIN_TRANSFORM_OPERATION_ID_MISMATCH');
  if(!['MOVE','ROTATE'].includes(plan.operation?.kind))throw Error('MIN_TRANSFORM_OPERATION_UNSUPPORTED');
  if(plan.operation?.structuralCapabilitiesSupported!==true||plan.operation?.planSupported!==true||plan.operation?.validationPassed!==true||plan.operation?.runtimeGate!=='PENDING')throw Error('MIN_TRANSFORM_OPERATION_GATE_MISMATCH');
  if(plan.target?.kind!=='GRID_OBJECT')throw Error('MIN_TRANSFORM_TARGET_KIND_MISMATCH');
  const key=String(plan.intent?.objectMapKey??'');
  if(!key)throw Error('MIN_TRANSFORM_OBJECT_MAP_KEY_REQUIRED');
  const pseudo={operation:plan.operation.kind,target:{gridId:plan.target.gridId,gridObjectId:plan.target.gridObjectId,itemId:plan.target.itemId,objectMapKey:key}};
  const expected=expectedAllowedPaths(pseudo).sort();
  const actual=arr(plan.allowedChanges).map(x=>x?.path).sort();
  if(!same(actual,expected))throw Error('MIN_TRANSFORM_ALLOWED_PATHS_MISMATCH');
  if(plan.intent?.persistentWriteAuthorized!==false||plan.intent?.semanticContract!==MIN_TRANSFORM_CONTRACT)throw Error('MIN_TRANSFORM_INTENT_CONTRACT_MISMATCH');
  const before=plan.intent?.beforeSerializedTransform,after=plan.intent?.finalSerializedTransform;
  if(!before||!after)throw Error('MIN_TRANSFORM_SERIALIZED_TRANSFORM_BINDING_REQUIRED');
  const pre=conditionMap(plan.preconditions),post=conditionMap(plan.postconditions);
  const gridId=Number(plan.target.gridId),objectId=Number(plan.target.gridObjectId),itemId=Number(plan.target.itemId);
  const gridIdPath=gridPointer(pseudo,'ID'),nextPath=gridPointer(pseudo,'NextGridObjectID');
  const idPath=objectPointer(pseudo,'ID'),itemPath=objectPointer(pseudo,'ItemID'),statePath=objectPointer(pseudo,'State');
  const xPath=objectPointer(pseudo,'X'),yPath=objectPointer(pseudo,'Y'),oriPath=objectPointer(pseudo,'Orientation');
  requireEqualsCondition(pre,gridIdPath,gridId,'MIN_TRANSFORM_PRECONDITION_GRID_ID_REQUIRED');
  requireEqualsCondition(post,gridIdPath,gridId,'MIN_TRANSFORM_POSTCONDITION_GRID_ID_REQUIRED');
  const preNext=pre.get(`${nextPath}|EQUALS`),postNext=post.get(`${nextPath}|EQUALS`);
  if(!preNext||!postNext||!same(preNext.value,postNext.value))throw Error('MIN_TRANSFORM_NEXT_GRID_OBJECT_ID_PRESERVATION_REQUIRED');
  for(const [map,prefix,t] of [[pre,'PRE',before],[post,'POST',after]]){
    requireEqualsCondition(map,idPath,objectId,`MIN_TRANSFORM_${prefix}_OBJECT_ID_REQUIRED`);
    requireEqualsCondition(map,itemPath,itemId,`MIN_TRANSFORM_${prefix}_ITEM_ID_REQUIRED`);
    requireEqualsCondition(map,statePath,null,`MIN_TRANSFORM_${prefix}_STATE_NULL_REQUIRED`);
    requireEqualsCondition(map,xPath,t.x,`MIN_TRANSFORM_${prefix}_X_REQUIRED`);
    requireEqualsCondition(map,yPath,t.y,`MIN_TRANSFORM_${prefix}_Y_REQUIRED`);
    requireEqualsCondition(map,oriPath,t.orientation,`MIN_TRANSFORM_${prefix}_ORIENTATION_REQUIRED`);
  }
  const p=plan.preservation||{};
  if(p.gridObjectIdentityPolicy!=='PRESERVE_ALL_GRID_OBJECT_IDENTITIES'||p.arrayPolicy!=='PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL'||p.unknownStatePolicy!=='OPAQUE_UNCHANGED_REQUIRED'||p.serializerNormalizationPolicy!=='REJECT_SEMANTIC_NORMALIZATION')throw Error('MIN_TRANSFORM_PRESERVATION_POLICY_MISMATCH');
}

export const minimumPersistentTransformAdapter=Object.freeze({
  contract:MUTATION_ADAPTER_CONTRACT,
  id:MUTATION_ADAPTER_ID,
  owner:SEMANTIC_OWNER,
  apply(draft,intent,plan){
    assertPlanBinding(plan);
    const gridId=int(plan.target.gridId),objectId=int(plan.target.gridObjectId),itemId=int(plan.target.itemId),key=String(intent?.objectMapKey??'');
    const grid=gridOf(draft,gridId);if(!grid||int(grid.ID)!==gridId)throw Error('MIN_TRANSFORM_TARGET_GRID_MISSING');
    const object=objectOf(grid,key);if(!object||int(object.ID)!==objectId||String(object.ID)!==key||int(object.ItemID)!==itemId)throw Error('MIN_TRANSFORM_TARGET_IDENTITY_MISMATCH');
    if(object.State!==null)throw Error('MIN_TRANSFORM_STATE_CHANGED_BEFORE_APPLY');
    const final=intent?.finalTransform||{},serialized=intent?.finalSerializedTransform||{},x=int(final.x),y=int(final.y),ori=normalizedOrientation(final.orientation);
    if(x===null||y===null||ori===null||!CARDINAL.has(ori)||normalizedOrientation(serialized.orientation)!==ori)throw Error('MIN_TRANSFORM_FINAL_TRANSFORM_INVALID');
    if(plan.operation.kind==='MOVE'){
      if(normalizedOrientation(object.Orientation)!==ori)throw Error('MIN_TRANSFORM_MOVE_ORIENTATION_CHANGE_FORBIDDEN');
      object.X=x;object.Y=y;
    }else{
      if(normalizedOrientation(object.Orientation)===ori)throw Error('MIN_TRANSFORM_ROTATE_ORIENTATION_UNCHANGED');
      if(int(object.X)!==x||int(object.Y)!==y)throw Error('MIN_TRANSFORM_ROTATE_ANCHOR_CHANGE_FORBIDDEN');
      object.Orientation=serialized.orientation;
    }
  },
  persistentWriteAuthorized:false,
  WORLD_PERSISTENT_WRITE_V125:false
});
