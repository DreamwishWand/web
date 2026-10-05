import {
  MUTATION_ADAPTER_CONTRACT,
  PLAYER_HOUSE_ROOM_TARGET_KIND,
  TRANSACTION_PLAN_CONTRACT,
  WRITE_CANDIDATE_CAPABILITY,
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../save/transaction-foundation.js';
import {
  BuildIdentityKind,
  PlatformFamily
} from '../save/versioning.js';
import {
  GAME_VERSION,
  PROFILE_SCHEMA,
  ROOM_FINISH_MUTATION_SET_CONTRACT,
  ROOM_FINISH_OPERATION,
  SEMANTIC_OWNER,
  SWITCH_BID
} from './room-finish-v125.js';

export const ROOM_FINISH_TRANSACTION_BINDING_CONTRACT=
  'ddv.room-finish-transaction-binding@1';
export const ROOM_FINISH_TRANSACTION_INTENT_CONTRACT=
  'ddv.room-finish-transaction-intent@1';
export const ROOM_FINISH_ADAPTER_ID='01b-room-finish-v125-v1';

const TARGET_BUILD=Object.freeze({
  platform:PlatformFamily.Switch,
  kind:BuildIdentityKind.SwitchBid,
  value:SWITCH_BID
});
const ROOM_TARGET_EXTENSION='DDV-SAFE-PLAYER-HOUSE-ROOM-TARGET-EXTENSION-V125-V1_0';

function clone(value){return structuredClone(value);}
function asObj(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)?value:null;}
function own(value,key){return Boolean(value&&Object.prototype.hasOwnProperty.call(value,String(key)));}
function int(value,code){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw bindingError(code,String(value));
  return n;
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
function bindingError(code,detail=''){
  const e=new Error(detail?code+': '+detail:code);
  e.code=code;
  return e;
}
function roomPath(target){
  return '/World/PlayerHouses/'+target.playerHouseIndex+
    '/Floors/'+target.floorIndex+
    '/Rooms/'+target.roomSlot;
}
function roomOf(profile,target){
  const houses=Array.isArray(profile?.World?.PlayerHouses)?profile.World.PlayerHouses:null;
  if(!houses)throw bindingError('ROOM_FINISH_TX_PLAYER_HOUSES_REQUIRED');
  const house=asObj(houses[target.playerHouseIndex]);
  if(!house)throw bindingError('ROOM_FINISH_TX_HOUSE_INDEX_INVALID');
  if(Number(house.HouseItemID)!==target.houseItemId)
    throw bindingError('ROOM_FINISH_TX_HOUSE_ITEM_ID_MISMATCH');
  const floors=Array.isArray(house.Floors)?house.Floors:null;
  const floor=floors?asObj(floors[target.floorIndex]):null;
  if(!floor)throw bindingError('ROOM_FINISH_TX_FLOOR_INDEX_INVALID');
  const rooms=asObj(floor.Rooms);
  const room=rooms?asObj(rooms[String(target.roomSlot)]??rooms[target.roomSlot]):null;
  if(!room)throw bindingError('ROOM_FINISH_TX_ROOM_SLOT_INVALID');
  return room;
}
function normalizeTarget(target){
  if(!asObj(target)||target.kind!==PLAYER_HOUSE_ROOM_TARGET_KIND)
    throw bindingError('ROOM_FINISH_TX_TARGET_INVALID');
  const normalized={
    kind:PLAYER_HOUSE_ROOM_TARGET_KIND,
    playerHouseIndex:int(target.playerHouseIndex,'ROOM_FINISH_TX_PLAYER_HOUSE_INDEX_INVALID'),
    houseItemId:int(target.houseItemId,'ROOM_FINISH_TX_HOUSE_ITEM_ID_INVALID'),
    floorIndex:int(target.floorIndex,'ROOM_FINISH_TX_FLOOR_INDEX_INVALID'),
    roomSlot:int(target.roomSlot,'ROOM_FINISH_TX_ROOM_SLOT_INVALID')
  };
  if(normalized.roomSlot>3)throw bindingError('ROOM_FINISH_TX_ROOM_SLOT_INVALID');
  return normalized;
}
function parseRoomPath(path,target){
  const root=roomPath(target);
  if(path===root+'/Flooring')return {kind:'FLOORING'};
  const wp=root+'/Wallpapers/';
  if(path.startsWith(wp)){
    const key=path.slice(wp.length),position=Number(key);
    if(String(position)===key&&Number.isInteger(position)&&position>=0&&position<=3)
      return {kind:'WALLPAPER',key,position};
  }
  const op=root+'/WallpaperOffsetById/';
  if(path.startsWith(op)){
    const key=path.slice(op.length),itemId=Number(key);
    if(String(itemId)===key&&Number.isSafeInteger(itemId)&&itemId>=0)
      return {kind:'OFFSET',key,itemId};
  }
  throw bindingError('ROOM_FINISH_TX_PATH_UNSUPPORTED',path);
}
function normalizeChange(change,target,operation){
  if(!asObj(change)||typeof change.path!=='string')
    throw bindingError('ROOM_FINISH_TX_CHANGE_INVALID');
  const parsed=parseRoomPath(change.path,target);
  if(!['REPLACE','ADD','REMOVE'].includes(change.kind))
    throw bindingError('ROOM_FINISH_TX_CHANGE_KIND_INVALID',String(change.kind));
  if(operation===ROOM_FINISH_OPERATION.SET_FLOORING){
    if(parsed.kind!=='FLOORING'||change.kind!=='REPLACE')
      throw bindingError('ROOM_FINISH_TX_FLOORING_CHANGE_INVALID',change.path);
  }else if(operation===ROOM_FINISH_OPERATION.SET_WALLPAPER){
    if(parsed.kind==='FLOORING')
      throw bindingError('ROOM_FINISH_TX_WALLPAPER_CHANGE_INVALID',change.path);
    if(parsed.kind==='OFFSET'&&change.kind!=='REMOVE')
      throw bindingError('ROOM_FINISH_TX_OFFSET_CHANGE_INVALID',change.path);
    if(parsed.kind==='WALLPAPER'&&!['ADD','REPLACE'].includes(change.kind))
      throw bindingError('ROOM_FINISH_TX_WALLPAPER_CHANGE_INVALID',change.path);
  }else{
    throw bindingError('ROOM_FINISH_TX_OPERATION_UNSUPPORTED',String(operation));
  }

  if(change.kind==='REPLACE'){
    if(!own(change,'before')||!own(change,'after'))
      throw bindingError('ROOM_FINISH_TX_REPLACE_VALUES_REQUIRED',change.path);
    return Object.freeze({
      path:change.path,kind:'REPLACE',
      before:clone(change.before),after:clone(change.after),parsed:Object.freeze(parsed)
    });
  }
  if(change.kind==='ADD'){
    if(own(change,'before')||!own(change,'after'))
      throw bindingError('ROOM_FINISH_TX_ADD_VALUES_INVALID',change.path);
    return Object.freeze({
      path:change.path,kind:'ADD',after:clone(change.after),parsed:Object.freeze(parsed)
    });
  }
  if(!own(change,'before')||own(change,'after'))
    throw bindingError('ROOM_FINISH_TX_REMOVE_VALUES_INVALID',change.path);
  return Object.freeze({
    path:change.path,kind:'REMOVE',before:clone(change.before),parsed:Object.freeze(parsed)
  });
}
function requireMutationSet(value){
  if(
    !asObj(value)||
    value.contract!==ROOM_FINISH_MUTATION_SET_CONTRACT||
    value.semanticOwner!==SEMANTIC_OWNER||
    value.persistentWriteAuthorized!==false||
    value.WORLD_PERSISTENT_WRITE_V125!==false||
    value.PERSISTENT_WRITE!==false||
    value.productApplyAuthorized!==false||
    value.directSourceReplacementAuthorized!==false
  )throw bindingError('ROOM_FINISH_TX_MUTATION_SET_INVALID');

  const target=normalizeTarget(value.target);
  if(value.roomPath!==roomPath(target))
    throw bindingError('ROOM_FINISH_TX_ROOM_PATH_MISMATCH');
  if(
    value.gridObjectIdentityPolicy!=='PRESERVE_ALL_GRID_OBJECT_IDENTITIES'||
    value.arrayPolicy!=='PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL'||
    value.unknownStatePolicy!=='OPAQUE_UNCHANGED_REQUIRED'||
    value.serializerNormalizationPolicy!=='REJECT_SEMANTIC_NORMALIZATION'
  )throw bindingError('ROOM_FINISH_TX_PRESERVATION_POLICY_MISMATCH');

  for(const flag of [
    'ownershipMutation','inventoryMutation','collectionMutation',
    'entitlementMutation','storeMutation','progressionMutation','ceilingMutation'
  ]){
    if(value[flag]!==false)throw bindingError('ROOM_FINISH_TX_UNRELATED_MUTATION_FORBIDDEN',flag);
  }

  if(!Array.isArray(value.changes)||!value.changes.length)
    throw bindingError('ROOM_FINISH_TX_CHANGES_REQUIRED');
  const changes=value.changes.map(change=>normalizeChange(change,target,value.operation));
  const paths=changes.map(change=>change.path);
  if(new Set(paths).size!==paths.length)
    throw bindingError('ROOM_FINISH_TX_DUPLICATE_PATH');
  const allowed=[...(value.allowedSemanticPaths??[])].map(String).sort();
  const expected=[...paths].sort();
  if(!same(allowed,expected))
    throw bindingError('ROOM_FINISH_TX_ALLOWED_PATHS_MISMATCH');

  if(value.operation===ROOM_FINISH_OPERATION.SET_FLOORING){
    if(changes.length!==1||changes[0].parsed.kind!=='FLOORING')
      throw bindingError('ROOM_FINISH_TX_FLOORING_CHANGE_COUNT_INVALID');
  }else if(value.operation===ROOM_FINISH_OPERATION.SET_WALLPAPER){
    if(!changes.some(change=>change.parsed.kind==='WALLPAPER'))
      throw bindingError('ROOM_FINISH_TX_WALLPAPER_CHANGE_REQUIRED');
  }else{
    throw bindingError('ROOM_FINISH_TX_OPERATION_UNSUPPORTED',String(value.operation));
  }

  return Object.freeze({
    target:Object.freeze(target),
    operation:String(value.operation),
    itemId:int(value.itemId,'ROOM_FINISH_TX_ITEM_ID_INVALID'),
    changes:Object.freeze(changes),
    allowedPaths:Object.freeze(expected),
    scope:value.scope??null,
    selectedWallPositions:Object.freeze([...(value.selectedWallPositions??[])]),
    mutationSet:clone(value)
  });
}
function requireSession(session,normalized){
  if(
    !session||
    typeof session.getSnapshot!=='function'||
    typeof session.getPreflightContext!=='function'||
    !(session.source instanceof Uint8Array)
  )throw bindingError('ROOM_FINISH_TX_SAFE_SESSION_REQUIRED');
  const ctx=session.getPreflightContext();
  if(
    ctx.saveIdentity?.sourcePlatform!==PlatformFamily.Switch||
    Number(ctx.saveIdentity?.profileGameInfoVersion)!==PROFILE_SCHEMA||
    ctx.codecContract!==session.codec?.contract
  )throw bindingError('ROOM_FINISH_TX_SESSION_IDENTITY_MISMATCH');
  const room=roomOf(session.getSnapshot(),normalized.target);
  for(const change of normalized.changes){
    assertChangePrestate(room,change);
  }
  return ctx;
}
function assertChangePrestate(room,change){
  const p=change.parsed;
  if(p.kind==='FLOORING'){
    if(change.kind!=='REPLACE'||!same(room.Flooring,change.before))
      throw bindingError('ROOM_FINISH_TX_BEFORE_MISMATCH',change.path);
    return;
  }
  const map=p.kind==='WALLPAPER'?asObj(room.Wallpapers):asObj(room.WallpaperOffsetById);
  if(!map)throw bindingError('ROOM_FINISH_TX_ROOM_MAP_REQUIRED',change.path);
  const exists=own(map,p.key);
  if(change.kind==='ADD'){
    if(exists)throw bindingError('ROOM_FINISH_TX_EXPECTED_ABSENT',change.path);
  }else{
    if(!exists||!same(map[p.key],change.before))
      throw bindingError('ROOM_FINISH_TX_BEFORE_MISMATCH',change.path);
  }
}
function conditionFromChange(change,after){
  if(after){
    if(change.kind==='REMOVE')return {path:change.path,operator:'NOT_EXISTS'};
    return {path:change.path,operator:'EQUALS',value:clone(change.after)};
  }
  if(change.kind==='ADD')return {path:change.path,operator:'NOT_EXISTS'};
  return {path:change.path,operator:'EQUALS',value:clone(change.before)};
}
function intentFrom(normalized){
  return Object.freeze({
    contract:ROOM_FINISH_TRANSACTION_INTENT_CONTRACT,
    mutationSetContract:ROOM_FINISH_MUTATION_SET_CONTRACT,
    operation:normalized.operation,
    target:clone(normalized.target),
    itemId:normalized.itemId,
    scope:normalized.scope,
    selectedWallPositions:[...normalized.selectedWallPositions],
    changes:normalized.changes.map(change=>{
      const out={path:change.path,kind:change.kind};
      if(own(change,'before'))out.before=clone(change.before);
      if(own(change,'after'))out.after=clone(change.after);
      return out;
    }),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}

export function buildRoomFinishTransactionPlanV125({
  session,
  mutationSet,
  planId='01b-room-finish-v125'
}={}){
  const normalized=requireMutationSet(mutationSet);
  const ctx=requireSession(session,normalized);
  const root=roomPath(normalized.target);
  return Object.freeze({
    contract:TRANSACTION_PLAN_CONTRACT,
    planId:String(planId),
    semanticOwner:SEMANTIC_OWNER,
    capabilityRequired:WRITE_CANDIDATE_CAPABILITY,
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
      id:'WORLD_PLAYER_HOUSE_ROOM_FINISH_V125',
      owner:SEMANTIC_OWNER,
      kind:normalized.operation,
      structuralCapabilitiesSupported:true,
      planSupported:true,
      validationPassed:true,
      runtimeGate:'PENDING'
    },
    target:clone(normalized.target),
    mutationAdapter:{
      contract:MUTATION_ADAPTER_CONTRACT,
      id:ROOM_FINISH_ADAPTER_ID,
      owner:SEMANTIC_OWNER
    },
    preconditions:[
      {
        path:'/World/PlayerHouses/'+normalized.target.playerHouseIndex+'/HouseItemID',
        operator:'EQUALS',
        value:normalized.target.houseItemId
      },
      ...normalized.changes.map(change=>conditionFromChange(change,false))
    ],
    allowedChanges:normalized.allowedPaths.map(path=>({path,classification:'INTENTIONAL'})),
    forbiddenPathPrefixes:[
      '/GameInfo',
      '/Player',
      '/World/GridCollection',
      '/World/Shops',
      '/World/Stores',
      '/World/ConditionalEventHistoryData'
    ],
    postconditions:[
      {
        path:'/World/PlayerHouses/'+normalized.target.playerHouseIndex+'/HouseItemID',
        operator:'EQUALS',
        value:normalized.target.houseItemId
      },
      ...normalized.changes.map(change=>conditionFromChange(change,true))
    ],
    preservation:{
      gridObjectIdentityPolicy:'PRESERVE_ALL_GRID_OBJECT_IDENTITIES',
      arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
      unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
      serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
      unknownPathPrefixes:[]
    },
    sourceEvidence:[
      {id:'DDV-ROOM-FINISH-SEMANTICS-V125-V1_0',status:'INTEGRATOR_PROMOTED'},
      {id:ROOM_TARGET_EXTENSION,status:'INTEGRATOR_PROMOTED'}
    ],
    intent:intentFrom(normalized)
  });
}
function assertPlanBinding(plan,intent){
  if(
    plan?.contract!==TRANSACTION_PLAN_CONTRACT||
    plan.semanticOwner!==SEMANTIC_OWNER||
    plan.capabilityRequired!==WRITE_CANDIDATE_CAPABILITY||
    plan.target?.kind!==PLAYER_HOUSE_ROOM_TARGET_KIND||
    plan.mutationAdapter?.contract!==MUTATION_ADAPTER_CONTRACT||
    plan.mutationAdapter?.id!==ROOM_FINISH_ADAPTER_ID||
    plan.mutationAdapter?.owner!==SEMANTIC_OWNER||
    intent?.contract!==ROOM_FINISH_TRANSACTION_INTENT_CONTRACT||
    intent?.mutationSetContract!==ROOM_FINISH_MUTATION_SET_CONTRACT||
    intent?.persistentWriteAuthorized!==false||
    intent?.productApplyAuthorized!==false||
    intent?.directSourceReplacementAuthorized!==false
  )throw bindingError('ROOM_FINISH_TX_ADAPTER_PLAN_BINDING_MISMATCH');
  if(!same(plan.target,intent.target))
    throw bindingError('ROOM_FINISH_TX_ADAPTER_TARGET_BINDING_MISMATCH');
  const allowed=(plan.allowedChanges??[]).map(entry=>entry.path).sort();
  const intended=(intent.changes??[]).map(change=>change.path).sort();
  if(!same(allowed,intended))
    throw bindingError('ROOM_FINISH_TX_ADAPTER_PATH_BINDING_MISMATCH');
}
function applyExactChange(room,change,target){
  const parsed=parseRoomPath(change.path,target);
  if(parsed.kind==='FLOORING'){
    if(change.kind!=='REPLACE'||!same(room.Flooring,change.before))
      throw bindingError('ROOM_FINISH_TX_ADAPTER_BEFORE_MISMATCH',change.path);
    room.Flooring=clone(change.after);
    return;
  }
  const mapName=parsed.kind==='WALLPAPER'?'Wallpapers':'WallpaperOffsetById';
  const map=asObj(room[mapName]);
  if(!map)throw bindingError('ROOM_FINISH_TX_ADAPTER_MAP_REQUIRED',mapName);
  const exists=own(map,parsed.key);
  if(change.kind==='ADD'){
    if(exists)throw bindingError('ROOM_FINISH_TX_ADAPTER_EXPECTED_ABSENT',change.path);
    map[parsed.key]=clone(change.after);
    return;
  }
  if(!exists||!same(map[parsed.key],change.before))
    throw bindingError('ROOM_FINISH_TX_ADAPTER_BEFORE_MISMATCH',change.path);
  if(change.kind==='REPLACE'){
    map[parsed.key]=clone(change.after);
    return;
  }
  if(change.kind==='REMOVE'){
    delete map[parsed.key];
    return;
  }
  throw bindingError('ROOM_FINISH_TX_ADAPTER_CHANGE_KIND_INVALID',String(change.kind));
}

export const roomFinishMutationAdapterV125=Object.freeze({
  contract:MUTATION_ADAPTER_CONTRACT,
  id:ROOM_FINISH_ADAPTER_ID,
  owner:SEMANTIC_OWNER,
  apply(draft,intent,plan){
    assertPlanBinding(plan,intent);
    const room=roomOf(draft,plan.target);
    for(const change of intent.changes??[])applyExactChange(room,change,plan.target);
  },
  persistentWriteAuthorized:false,
  WORLD_PERSISTENT_WRITE_V125:false
});

export async function createRoomFinishVerifiedWriteCandidateV125({
  session,
  mutationSet,
  planId='01b-room-finish-v125'
}={}){
  const plan=buildRoomFinishTransactionPlanV125({session,mutationSet,planId});
  const candidate=await createVerifiedWriteCandidate({
    session,
    plan,
    adapter:roomFinishMutationAdapterV125
  });
  const verification=await verifyWriteCandidate({
    candidate,
    codec:session.codec
  });
  if(verification?.status!=='PASS')
    throw bindingError('ROOM_FINISH_TX_CANDIDATE_VERIFICATION_FAILED');
  return Object.freeze({
    contract:ROOM_FINISH_TRANSACTION_BINDING_CONTRACT,
    status:'PASS',
    plan,
    candidate,
    verification,
    runtimeGate:'PENDING_01E_ROOM_FINISH',
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  });
}
