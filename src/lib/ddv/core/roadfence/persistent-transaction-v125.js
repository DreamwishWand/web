import {
  MUTATION_ADAPTER_CONTRACT,
  STRUCTURAL_WRITE_CANDIDATE_CAPABILITY,
  TRANSACTION_PLAN_CONTRACT,
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../save/transaction-foundation.js';
import {
  BuildIdentityKind,
  PlatformFamily
} from '../save/versioning.js';
import {
  ROADFENCE_NATIVE_MUTATION_SET_V125_CONTRACT,
  ROADFENCE_PERSISTENT_COMPILER_V125_CONTRACT,
  ROADFENCE_PERSISTENT_COMPILER_V125_ID,
  ROADFENCE_SEMANTIC_OWNER,
  ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY
} from './persistent-v125/constants.js';

export const ROADFENCE_STRUCTURAL_TRANSACTION_BINDING_CONTRACT =
  'ddv.roadfence-structural-transaction-binding@1';
export const ROADFENCE_STRUCTURAL_INTENT_CONTRACT =
  'ddv.roadfence-structural-transaction-intent@1';
export const ROADFENCE_STRUCTURAL_ADAPTER_ID =
  '01c-roadfence-grid-object-set-v125-v1';

const GAME_VERSION='1.25.0';
const PROFILE_SCHEMA=624;
const TID='0100D39012C1A000';
const BID='52BD625D9B4E0053';
const TARGET_BUILD=Object.freeze({
  platform:PlatformFamily.Switch,
  kind:BuildIdentityKind.SwitchBid,
  value:BID
});
const KNOWN_CREATED_OBJECT_FIELDS=Object.freeze([
  'ID','ItemID','X','Y','Orientation','State'
]);

function clone(value){return structuredClone(value);}
function asObj(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)?value:null;}
function int(value,code){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw bindingError(code,String(value));
  return n;
}
function sortedIds(values,code){
  if(!Array.isArray(values))throw bindingError(code);
  const out=values.map(v=>int(v,code)).sort((a,b)=>a-b);
  if(new Set(out).size!==out.length)throw bindingError(code);
  return out;
}
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);
    return out;
  }
  return value;
}
function same(a,b){return JSON.stringify(canonicalize(a))===JSON.stringify(canonicalize(b));}
function sameIds(a,b){return same([...a].sort((x,y)=>x-y),[...b].sort((x,y)=>x-y));}
function bindingError(code,detail=''){
  const error=new Error(detail?code+': '+detail:code);
  error.code=code;
  return error;
}
function gridOf(profile,gridId){
  const grid=asObj(asObj(asObj(profile?.World)?.GridCollection)?.Grids)?.[String(gridId)];
  if(!asObj(grid)||Number(grid.ID)!==gridId)throw bindingError('ROADFENCE_TX_TARGET_GRID_MISSING');
  return grid;
}
function pathForObject(gridId,id){
  return '/World/GridCollection/Grids/'+String(gridId)+'/Objects/'+String(id);
}
function pathForNext(gridId){
  return '/World/GridCollection/Grids/'+String(gridId)+'/NextGridObjectID';
}
function expectedAllowedPaths(gridId,created,deleted,nextBefore,nextAfter){
  const paths=[
    ...deleted.map(id=>pathForObject(gridId,id)),
    ...created.map(id=>pathForObject(gridId,id))
  ];
  if(nextBefore!==nextAfter)paths.push(pathForNext(gridId));
  return paths.sort();
}
function normalizeEntries(entries,kind){
  if(!Array.isArray(entries))throw bindingError('ROADFENCE_TX_MUTATION_SET_INVALID',kind);
  return entries.map(entry=>{
    if(!asObj(entry))throw bindingError('ROADFENCE_TX_MUTATION_SET_INVALID',kind);
    const gridObjectId=int(entry.gridObjectId,'ROADFENCE_TX_GRID_OBJECT_ID_INVALID');
    if(kind==='created'){
      const object=clone(entry.object);
      if(!asObj(object)||Number(object.ID)!==gridObjectId||String(object.ID)!==String(gridObjectId))
        throw bindingError('ROADFENCE_TX_CREATED_OBJECT_ID_MISMATCH',String(gridObjectId));
      const unknown=Object.keys(object).filter(key=>!KNOWN_CREATED_OBJECT_FIELDS.includes(key));
      if(unknown.length)throw bindingError('ROADFENCE_TX_CREATED_OBJECT_FIELD_UNSUPPORTED',unknown.join(','));
      if(!same(Object.keys(object).sort(),[...KNOWN_CREATED_OBJECT_FIELDS].sort()))
        throw bindingError('ROADFENCE_TX_CREATED_OBJECT_FIELDS_INCOMPLETE',String(gridObjectId));
      return {gridObjectId,object};
    }
    const sourceObject=clone(entry.sourceObject);
    if(!asObj(sourceObject)||Number(sourceObject.ID)!==gridObjectId)
      throw bindingError('ROADFENCE_TX_SOURCE_OBJECT_ID_MISMATCH',String(gridObjectId));
    if(kind==='deleted'){
      const unknown=Object.keys(sourceObject).filter(key=>!KNOWN_CREATED_OBJECT_FIELDS.includes(key));
      if(unknown.length)throw bindingError('ROADFENCE_TX_DELETED_OBJECT_FIELD_UNSUPPORTED',unknown.join(','));
    }
    return {gridObjectId,sourceObject};
  }).sort((a,b)=>a.gridObjectId-b.gridObjectId);
}
function normalizeReplacementPairs(value,deletedIds,createdIds){
  if(!Array.isArray(value))throw bindingError('ROADFENCE_TX_REPLACEMENT_PAIRS_INVALID');
  const deleted=new Set(deletedIds),created=new Set(createdIds),seenD=new Set(),seenC=new Set();
  return value.map(pair=>{
    if(!asObj(pair))throw bindingError('ROADFENCE_TX_REPLACEMENT_PAIRS_INVALID');
    const d=int(pair.deletedGridObjectId,'ROADFENCE_TX_REPLACEMENT_PAIRS_INVALID');
    const c=int(pair.createdGridObjectId,'ROADFENCE_TX_REPLACEMENT_PAIRS_INVALID');
    if(!deleted.has(d)||!created.has(c)||seenD.has(d)||seenC.has(c))
      throw bindingError('ROADFENCE_TX_REPLACEMENT_PAIRS_INVALID');
    seenD.add(d);seenC.add(c);
    return {deletedGridObjectId:d,createdGridObjectId:c};
  }).sort((a,b)=>a.deletedGridObjectId-b.deletedGridObjectId||a.createdGridObjectId-b.createdGridObjectId);
}
function requireMutationSet(value){
  if(
    !asObj(value)||
    value.contract!==ROADFENCE_NATIVE_MUTATION_SET_V125_CONTRACT||
    value.ok!==true||
    value.semanticOwner!==ROADFENCE_SEMANTIC_OWNER||
    value.persistentWriteAuthorized!==false||
    value.WORLD_PERSISTENT_WRITE_V125!==false||
    value.productApplyAuthorized!==false
  )throw bindingError('ROADFENCE_TX_MUTATION_SET_INVALID');
  if(
    value.compiler?.contract!==ROADFENCE_PERSISTENT_COMPILER_V125_CONTRACT||
    value.compiler?.id!==ROADFENCE_PERSISTENT_COMPILER_V125_ID||
    value.compiler?.gameVersion!==GAME_VERSION||
    value.compiler?.platform!=='Nintendo Switch'||
    value.compiler?.bid!==BID||
    value.compiler?.semanticOwner!==ROADFENCE_SEMANTIC_OWNER
  )throw bindingError('ROADFENCE_TX_COMPILER_BINDING_MISMATCH');
  if(
    value.sourceBuildIdentity?.platform!=='Nintendo Switch'||
    value.sourceBuildIdentity?.gameVersion!==GAME_VERSION||
    value.sourceBuildIdentity?.tid!==TID||
    value.sourceBuildIdentity?.bid!==BID||
    Number(value.sourceBuildIdentity?.profileSchema)!==PROFILE_SCHEMA
  )throw bindingError('ROADFENCE_TX_BUILD_BINDING_MISMATCH');
  if(
    value.structuralTransactionDependency?.id!==ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY||
    value.structuralTransactionDependency?.current01aWriteCandidateCompatible!==true||
    value.structuralTransactionDependency?.satisfied!==true
  )throw bindingError('ROADFENCE_TX_STRUCTURAL_DEPENDENCY_UNSATISFIED');

  const gridId=int(value.targetGrid?.gridId,'ROADFENCE_TX_TARGET_GRID_ID_INVALID');
  const preservedIds=sortedIds(value.preservedObjectIdentities,'ROADFENCE_TX_PRESERVED_IDS_INVALID');
  const createdIds=sortedIds(value.createdObjectIdentities,'ROADFENCE_TX_CREATED_IDS_INVALID');
  const deletedIds=sortedIds(value.deletedObjectIdentities,'ROADFENCE_TX_DELETED_IDS_INVALID');
  if(!createdIds.length&&!deletedIds.length)throw bindingError('ROADFENCE_TX_STRUCTURAL_NOOP');

  const union=[...preservedIds,...createdIds,...deletedIds];
  if(new Set(union).size!==union.length)throw bindingError('ROADFENCE_TX_IDENTITY_SET_OVERLAP');

  const preserved=normalizeEntries(value.preservedObjects,'preserved');
  const created=normalizeEntries(value.createdObjects,'created');
  const deleted=normalizeEntries(value.deletedObjects,'deleted');
  if(!sameIds(preservedIds,preserved.map(x=>x.gridObjectId)))
    throw bindingError('ROADFENCE_TX_PRESERVED_BINDING_MISMATCH');
  if(!sameIds(createdIds,created.map(x=>x.gridObjectId)))
    throw bindingError('ROADFENCE_TX_CREATED_BINDING_MISMATCH');
  if(!sameIds(deletedIds,deleted.map(x=>x.gridObjectId)))
    throw bindingError('ROADFENCE_TX_DELETED_BINDING_MISMATCH');

  const sourceIds=sortedIds(value.sourceObjectIds,'ROADFENCE_TX_SOURCE_IDS_INVALID');
  if(!sameIds(sourceIds,[...preservedIds,...deletedIds]))
    throw bindingError('ROADFENCE_TX_SOURCE_ID_PARTITION_MISMATCH');

  const nextBefore=int(value.nextGridObjectID?.before,'ROADFENCE_TX_NEXT_BEFORE_INVALID');
  const nextAfter=int(value.nextGridObjectID?.after,'ROADFENCE_TX_NEXT_AFTER_INVALID');
  const expectedCreated=Array.from({length:createdIds.length},(_,i)=>nextBefore+i);
  if(!sameIds(createdIds,expectedCreated))
    throw bindingError('ROADFENCE_TX_CREATED_IDS_NOT_CONTIGUOUS_FROM_NEXT');
  if(nextAfter!==nextBefore+createdIds.length)
    throw bindingError('ROADFENCE_TX_NEXT_TRANSITION_INVALID');

  const replacementIdentityPairs=normalizeReplacementPairs(
    value.replacementIdentityPairs,
    deletedIds,
    createdIds
  );
  const allowedSemanticPaths=[...(value.allowedSemanticPaths??[])].map(String).sort();
  const expectedPaths=expectedAllowedPaths(gridId,createdIds,deletedIds,nextBefore,nextAfter);
  if(!same(allowedSemanticPaths,expectedPaths))
    throw bindingError('ROADFENCE_TX_ALLOWED_PATHS_MISMATCH');

  if(value.quantityInvariant?.wandInventoryDelta!==0)
    throw bindingError('ROADFENCE_TX_INVENTORY_MUTATION_FORBIDDEN');
  for(const key of ['listInventory','collection','entitlement','progression','storeShop','gameInfo']){
    if(value.preservation?.[key]!=='EXACT_UNCHANGED')
      throw bindingError('ROADFENCE_TX_PRESERVATION_CONTRACT_MISMATCH',key);
  }

  return Object.freeze({
    gridId,preservedIds,createdIds,deletedIds,
    preserved,created,deleted,replacementIdentityPairs,
    nextBefore,nextAfter,allowedSemanticPaths,
    operation:String(value.operation),
    evidence:clone(value.evidence??[])
  });
}
function requireSessionBinding(session,normalized){
  if(!session||typeof session.getSnapshot!=='function'||typeof session.getPreflightContext!=='function'||!(session.source instanceof Uint8Array))
    throw bindingError('ROADFENCE_TX_SAFE_SESSION_REQUIRED');
  const ctx=session.getPreflightContext();
  if(
    ctx.saveIdentity?.sourcePlatform!==PlatformFamily.Switch||
    Number(ctx.saveIdentity?.profileGameInfoVersion)!==PROFILE_SCHEMA||
    ctx.codecContract!==session.codec?.contract
  )throw bindingError('ROADFENCE_TX_SESSION_IDENTITY_MISMATCH');
  const grid=gridOf(session.getSnapshot(),normalized.gridId);
  if(Number(grid.NextGridObjectID)!==normalized.nextBefore)
    throw bindingError('ROADFENCE_TX_SOURCE_NEXT_MISMATCH');
  const objects=asObj(grid.Objects);
  if(!objects)throw bindingError('ROADFENCE_TX_SOURCE_OBJECT_MAP_REQUIRED');
  for(const entry of [...normalized.preserved,...normalized.deleted]){
    const current=objects[String(entry.gridObjectId)];
    if(!same(current,entry.sourceObject))
      throw bindingError('ROADFENCE_TX_SOURCE_OBJECT_BINDING_MISMATCH',String(entry.gridObjectId));
  }
  for(const id of normalized.createdIds){
    if(Object.prototype.hasOwnProperty.call(objects,String(id)))
      throw bindingError('ROADFENCE_TX_CREATED_ID_ALREADY_EXISTS',String(id));
  }
  return ctx;
}
function evidenceList(mutationSet){
  const entries=[];
  for(const entry of mutationSet.evidence??[]){
    if(entry&&typeof entry.id==='string'&&entry.id)entries.push({id:entry.id,status:String(entry.status??'CONFIRMED')});
  }
  entries.push(
    {id:'DDV-ROADFENCE-PERSISTENT-COMPILER-WRITER-V125-V1_0',status:'INTEGRATOR_PROMOTED'},
    {id:ROADFENCE_STRUCTURAL_TRANSACTION_DEPENDENCY,status:'INTEGRATOR_PROMOTED'}
  );
  const seen=new Set();
  return entries.filter(entry=>{
    const key=entry.id+'|'+entry.status;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
function condition(path,operator,value){
  return operator==='EQUALS'?{path,operator,value:clone(value)}:{path,operator};
}
function buildConditions(normalized,after=false){
  const out=[
    condition('/World/GridCollection/Grids/'+normalized.gridId+'/ID','EQUALS',normalized.gridId),
    condition(pathForNext(normalized.gridId),'EQUALS',after?normalized.nextAfter:normalized.nextBefore)
  ];
  for(const entry of normalized.preserved){
    out.push(condition(pathForObject(normalized.gridId,entry.gridObjectId),'EQUALS',entry.sourceObject));
  }
  if(after){
    for(const id of normalized.deletedIds)out.push(condition(pathForObject(normalized.gridId,id),'NOT_EXISTS'));
    for(const entry of normalized.created)out.push(condition(pathForObject(normalized.gridId,entry.gridObjectId),'EQUALS',entry.object));
  }else{
    for(const entry of normalized.deleted)out.push(condition(pathForObject(normalized.gridId,entry.gridObjectId),'EQUALS',entry.sourceObject));
    for(const id of normalized.createdIds)out.push(condition(pathForObject(normalized.gridId,id),'NOT_EXISTS'));
  }
  return out;
}
function intentFrom(normalized,mutationSet){
  return {
    contract:ROADFENCE_STRUCTURAL_INTENT_CONTRACT,
    mutationSetContract:ROADFENCE_NATIVE_MUTATION_SET_V125_CONTRACT,
    compiler:{
      contract:ROADFENCE_PERSISTENT_COMPILER_V125_CONTRACT,
      id:ROADFENCE_PERSISTENT_COMPILER_V125_ID,
      bid:BID
    },
    operation:normalized.operation,
    target:{
      gridId:normalized.gridId,
      preservedGridObjectIds:[...normalized.preservedIds],
      createdGridObjectIds:[...normalized.createdIds],
      deletedGridObjectIds:[...normalized.deletedIds],
      replacementIdentityPairs:clone(normalized.replacementIdentityPairs),
      nextGridObjectIDBefore:normalized.nextBefore,
      nextGridObjectIDAfter:normalized.nextAfter
    },
    preservedObjects:clone(normalized.preserved),
    createdObjects:clone(normalized.created),
    deletedObjects:clone(normalized.deleted),
    logicalQuantity:clone(mutationSet.logicalQuantity),
    nativeObjectCount:clone(mutationSet.nativeObjectCount),
    representationCounts:clone(mutationSet.representationCounts),
    persistentWriteAuthorized:false
  };
}

export function buildRoadFenceStructuralTransactionPlanV125({
  session,
  mutationSet,
  planId='01c-roadfence-structural-v125'
}={}){
  const normalized=requireMutationSet(mutationSet);
  const ctx=requireSessionBinding(session,normalized);
  return Object.freeze({
    contract:TRANSACTION_PLAN_CONTRACT,
    planId:String(planId),
    semanticOwner:ROADFENCE_SEMANTIC_OWNER,
    capabilityRequired:STRUCTURAL_WRITE_CANDIDATE_CAPABILITY,
    input:{
      platform:PlatformFamily.Switch,
      gameVersion:GAME_VERSION,
      profileGameInfoVersion:PROFILE_SCHEMA,
      originalFileLength:session.source.length,
      originalSha256:ctx.saveIdentity.sourceRawSha256,
      codecContract:ctx.codecContract,
      targetBuild:clone(TARGET_BUILD)
    },
    operation:{
      id:'ROADFENCE_NATIVE_GRID_OBJECT_SET_V125',
      owner:ROADFENCE_SEMANTIC_OWNER,
      kind:normalized.operation,
      structuralCapabilitiesSupported:true,
      planSupported:true,
      validationPassed:true,
      runtimeGate:'PASSED'
    },
    target:{
      kind:'GRID_OBJECT_SET',
      gridId:normalized.gridId,
      preservedGridObjectIds:[...normalized.preservedIds],
      createdGridObjectIds:[...normalized.createdIds],
      deletedGridObjectIds:[...normalized.deletedIds],
      replacementIdentityPairs:clone(normalized.replacementIdentityPairs),
      nextGridObjectIDBefore:normalized.nextBefore,
      nextGridObjectIDAfter:normalized.nextAfter
    },
    mutationAdapter:{
      contract:MUTATION_ADAPTER_CONTRACT,
      id:ROADFENCE_STRUCTURAL_ADAPTER_ID,
      owner:ROADFENCE_SEMANTIC_OWNER
    },
    preconditions:buildConditions(normalized,false),
    allowedChanges:normalized.allowedSemanticPaths.map(path=>({path,classification:'INTENTIONAL'})),
    forbiddenPathPrefixes:[
      '/GameInfo','/Player','/World/PlayerHouses','/World/Shops','/World/Stores',
      '/World/ConditionalEventHistoryData'
    ],
    postconditions:buildConditions(normalized,true),
    preservation:{
      gridObjectIdentityPolicy:'ALLOW_DECLARED_GRID_OBJECT_SET_DELTA',
      arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
      unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
      serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
      unknownPathPrefixes:['/World']
    },
    sourceEvidence:evidenceList(mutationSet),
    intent:intentFrom(normalized,mutationSet)
  });
}

function assertAdapterPlan(plan,intent){
  if(
    plan?.contract!==TRANSACTION_PLAN_CONTRACT||
    plan.semanticOwner!==ROADFENCE_SEMANTIC_OWNER||
    plan.capabilityRequired!==STRUCTURAL_WRITE_CANDIDATE_CAPABILITY||
    plan.target?.kind!=='GRID_OBJECT_SET'||
    plan.mutationAdapter?.contract!==MUTATION_ADAPTER_CONTRACT||
    plan.mutationAdapter?.id!==ROADFENCE_STRUCTURAL_ADAPTER_ID||
    plan.mutationAdapter?.owner!==ROADFENCE_SEMANTIC_OWNER||
    intent?.contract!==ROADFENCE_STRUCTURAL_INTENT_CONTRACT||
    intent?.persistentWriteAuthorized!==false
  )throw bindingError('ROADFENCE_TX_ADAPTER_PLAN_BINDING_MISMATCH');
  const target=intent.target;
  if(
    Number(target?.gridId)!==Number(plan.target.gridId)||
    !sameIds(target?.preservedGridObjectIds??[],plan.target.preservedGridObjectIds??[])||
    !sameIds(target?.createdGridObjectIds??[],plan.target.createdGridObjectIds??[])||
    !sameIds(target?.deletedGridObjectIds??[],plan.target.deletedGridObjectIds??[])||
    !same(target?.replacementIdentityPairs??[],plan.target.replacementIdentityPairs??[])||
    Number(target?.nextGridObjectIDBefore)!==Number(plan.target.nextGridObjectIDBefore)||
    Number(target?.nextGridObjectIDAfter)!==Number(plan.target.nextGridObjectIDAfter)
  )throw bindingError('ROADFENCE_TX_ADAPTER_TARGET_BINDING_MISMATCH');
}

export const roadFenceStructuralMutationAdapterV125=Object.freeze({
  contract:MUTATION_ADAPTER_CONTRACT,
  id:ROADFENCE_STRUCTURAL_ADAPTER_ID,
  owner:ROADFENCE_SEMANTIC_OWNER,
  apply(draft,intent,plan){
    assertAdapterPlan(plan,intent);
    const grid=gridOf(draft,plan.target.gridId);
    if(Number(grid.NextGridObjectID)!==Number(plan.target.nextGridObjectIDBefore))
      throw bindingError('ROADFENCE_TX_ADAPTER_NEXT_MISMATCH');
    const objects=asObj(grid.Objects);
    if(!objects)throw bindingError('ROADFENCE_TX_ADAPTER_OBJECT_MAP_REQUIRED');

    for(const entry of intent.preservedObjects??[]){
      if(!same(objects[String(entry.gridObjectId)],entry.sourceObject))
        throw bindingError('ROADFENCE_TX_ADAPTER_PRESERVED_SOURCE_MISMATCH',String(entry.gridObjectId));
    }
    for(const entry of intent.deletedObjects??[]){
      if(!same(objects[String(entry.gridObjectId)],entry.sourceObject))
        throw bindingError('ROADFENCE_TX_ADAPTER_DELETE_SOURCE_MISMATCH',String(entry.gridObjectId));
    }
    for(const entry of intent.createdObjects??[]){
      if(Object.prototype.hasOwnProperty.call(objects,String(entry.gridObjectId)))
        throw bindingError('ROADFENCE_TX_ADAPTER_CREATE_COLLISION',String(entry.gridObjectId));
    }

    for(const id of plan.target.deletedGridObjectIds)delete objects[String(id)];
    for(const entry of intent.createdObjects??[]){
      const id=Number(entry.gridObjectId);
      const object=clone(entry.object);
      if(Number(object.ID)!==id)throw bindingError('ROADFENCE_TX_ADAPTER_CREATED_ID_MISMATCH',String(id));
      objects[String(id)]=object;
    }
    grid.NextGridObjectID=plan.target.nextGridObjectIDAfter;
  },
  persistentWriteAuthorized:false,
  WORLD_PERSISTENT_WRITE_V125:false
});

export async function createRoadFenceVerifiedWriteCandidateV125({
  session,
  mutationSet,
  planId='01c-roadfence-structural-v125',
  contracts
}={}){
  const plan=buildRoadFenceStructuralTransactionPlanV125({
    session,mutationSet,planId
  });
  const candidate=await createVerifiedWriteCandidate({
    session,
    plan,
    adapter:roadFenceStructuralMutationAdapterV125,
    contracts
  });
  const verification=await verifyWriteCandidate({
    candidate,
    codec:session.codec,
    contracts
  });
  if(verification.status!=='PASS')
    throw bindingError('ROADFENCE_TX_CANDIDATE_VERIFICATION_FAILED');
  return Object.freeze({
    contract:ROADFENCE_STRUCTURAL_TRANSACTION_BINDING_CONTRACT,
    plan,
    candidate,
    verification,
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    productApplyAuthorized:false
  });
}
