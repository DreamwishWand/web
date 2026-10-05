/* Dreamwish Wand DDV Core 01B — Indoor Room Finish semantics.
 * Nintendo Switch DDV v1.25.0 / BID 52BD625D9B4E0053 / schema 624.
 * Read/draft semantic owner for DEC-UX-241..242.
 * This module does NOT provide a save-layer writer and does NOT authorize Apply.
 */
'use strict';

export const ROOM_FINISH_CONTRACT='ddv.room-finish-semantics@1';
export const ROOM_PROJECTION_SCHEMA='ddv.indoor-room-finish-projection@1';
export const ROOM_MUTATION_SCHEMA='ddv.room-finish-mutation@1';
export const MUTATION_ADAPTER_CONTRACT='dreamwish.ddv.save-mutation-adapter@1';
export const MUTATION_ADAPTER_ID='01b-room-finish-v125-v1';
export const SEMANTIC_OWNER='01B CORE - World / Grid / Buildings';
export const GAME_VERSION='1.25.0';
export const PROFILE_SCHEMA=624;
export const SWITCH_BID='52BD625D9B4E0053';

export const ROOM_SLOT=Object.freeze({Center:0,Left:1,Right:2,Top:3});
export const WALL_POSITION=Object.freeze({Top:0,Right:1,Bottom:2,Left:3});
export const WALL_POSITIONS=Object.freeze([0,1,2,3]);
export const WALL_SCOPE=Object.freeze({CURRENT_WALL:'CURRENT_WALL',ALL_WALLS:'ALL_WALLS'});
export const FINISH_KIND=Object.freeze({FLOORING:'FLOORING',WALLPAPER:'WALLPAPER'});

function clone(v){return structuredClone(v);}
function int(v){const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function nonNegativeInt(v){const n=int(v);return n!==null&&n>=0?n:null;}
function positiveInt(v){const n=int(v);return n!==null&&n>0?n:null;}
function arr(v){return Array.isArray(v)?v:[];}
function obj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)?v:null;}
function unique(xs){return [...new Set(xs)];}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function result(status,reasons,extra={}){
  return Object.freeze({
    contract:ROOM_FINISH_CONTRACT,
    status,
    ok:status==='READY',
    reasonCodes:Object.freeze(unique(reasons)),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false,
    ...extra
  });
}
function exactSource(source,reasons){
  if(source?.platform!=='Nintendo Switch'||source?.gameVersion!==GAME_VERSION||
     Number(source?.profileSchemaVersion)!==PROFILE_SCHEMA||source?.buildIdentity!==SWITCH_BID)
    reasons.push('EXACT_SWITCH_V125_BUILD_REQUIRED');
}
function mapEntries(value,reason,reasons,{valueKind='int'}={}){
  const m=obj(value);
  if(!m){reasons.push(reason);return null;}
  const out=[];
  for(const [key,raw] of Object.entries(m)){
    const k=nonNegativeInt(key);
    let v;
    if(valueKind==='float'){
      const n=Number(raw);v=Number.isFinite(n)?n:null;
    }else v=nonNegativeInt(raw);
    if(k===null||v===null){reasons.push(reason);continue;}
    out.push([k,v]);
  }
  out.sort((a,b)=>a[0]-b[0]);
  if(new Set(out.map(x=>x[0])).size!==out.length)reasons.push(reason);
  return out;
}
function playerHouses(profile){return arr(profile?.World?.PlayerHouses);}
function roomByResolvedPath(profile,index,floorIndex,roomSlot,reasons){
  const houses=playerHouses(profile);
  const house=houses[index];
  if(!obj(house)){reasons.push('PLAYER_HOUSE_INDEX_UNRESOLVED');return null;}
  const floors=arr(house.Floors);
  const floor=floors[floorIndex];
  if(!obj(floor)){reasons.push('ROOM_FLOOR_INDEX_UNRESOLVED');return null;}
  const rooms=obj(floor.Rooms);
  if(!rooms){reasons.push('ROOM_MAP_UNRESOLVED');return null;}
  const room=rooms[String(roomSlot)]??rooms[roomSlot];
  if(!obj(room)){reasons.push('ROOM_SLOT_UNRESOLVED');return null;}
  return {house,floor,room};
}
function resolveHouseIndex(profile,location,reasons){
  const houses=playerHouses(profile);
  const houseItemId=positiveInt(location?.houseItemId);
  if(houseItemId===null){reasons.push('HOUSE_ITEM_ID_REQUIRED');return null;}
  const diagnostic=nonNegativeInt(location?.playerHouseIndex);
  if(diagnostic!==null){
    const h=houses[diagnostic];
    if(!obj(h)||positiveInt(h.HouseItemID)!==houseItemId){
      reasons.push('PLAYER_HOUSE_INDEX_HOUSE_ITEM_MISMATCH');return null;
    }
    return diagnostic;
  }
  const matches=[];
  for(let i=0;i<houses.length;i++)if(positiveInt(houses[i]?.HouseItemID)===houseItemId)matches.push(i);
  if(matches.length===0){reasons.push('HOUSE_ITEM_ID_NOT_FOUND');return null;}
  if(matches.length!==1){reasons.push('HOUSE_ITEM_ID_AMBIGUOUS_REQUIRES_CURRENT_SAVE_INDEX');return null;}
  return matches[0];
}
function normalizeLocation(location,reasons){
  const houseItemId=positiveInt(location?.houseItemId);
  const floorIndex=nonNegativeInt(location?.floorIndex);
  const roomSlot=nonNegativeInt(location?.roomSlot);
  if(houseItemId===null)reasons.push('HOUSE_ITEM_ID_REQUIRED');
  if(floorIndex===null)reasons.push('FLOOR_INDEX_REQUIRED');
  if(roomSlot===null||!Object.values(ROOM_SLOT).includes(roomSlot))reasons.push('ROOM_SLOT_INVALID');
  return {houseItemId,floorIndex,roomSlot};
}

export function projectIndoorRoomFinish({source,profile,location}={}){
  const reasons=[];exactSource(source,reasons);
  const loc=normalizeLocation(location,reasons);
  if(reasons.length)return result('REJECTED',reasons,{schema:ROOM_PROJECTION_SCHEMA});
  const playerHouseIndex=resolveHouseIndex(profile,location,reasons);
  if(playerHouseIndex===null)return result('REJECTED',reasons,{schema:ROOM_PROJECTION_SCHEMA});
  const resolved=roomByResolvedPath(profile,playerHouseIndex,loc.floorIndex,loc.roomSlot,reasons);
  if(!resolved)return result('REJECTED',reasons,{schema:ROOM_PROJECTION_SCHEMA});
  const {house,room}=resolved;
  if(positiveInt(house.HouseItemID)!==loc.houseItemId)reasons.push('HOUSE_ITEM_ID_RESOLUTION_DRIFT');

  const floorGridId=nonNegativeInt(room.FloorGridID);
  if(floorGridId===null)reasons.push('ROOM_FLOOR_GRID_ID_INVALID');
  const wallGridEntries=mapEntries(room.WallGridIDs,'ROOM_WALL_GRID_MAP_INVALID',reasons,{valueKind:'uint'});
  const wallpaperEntries=mapEntries(room.Wallpapers,'ROOM_WALLPAPER_MAP_INVALID',reasons);
  const offsets=mapEntries(room.WallpaperOffsetById,'ROOM_WALLPAPER_OFFSET_MAP_INVALID',reasons,{valueKind:'float'});
  const flooring=nonNegativeInt(room.Flooring),ceiling=nonNegativeInt(room.Ceiling);
  if(flooring===null)reasons.push('ROOM_FLOORING_INVALID');
  if(ceiling===null)reasons.push('ROOM_CEILING_INVALID');

  if(wallGridEntries){
    const keys=wallGridEntries.map(x=>x[0]);
    if(!same(keys,WALL_POSITIONS))reasons.push('ROOM_WALL_POSITION_SET_UNSUPPORTED');
  }
  if(wallpaperEntries){
    const wpKeys=wallpaperEntries.map(x=>x[0]);
    for(const p of WALL_POSITIONS)if(!wpKeys.includes(p))reasons.push('ROOM_WALLPAPER_POSITION_MISSING');
    if(wpKeys.some(p=>!WALL_POSITIONS.includes(p)))reasons.push('ROOM_WALLPAPER_POSITION_UNKNOWN');
  }
  if(reasons.length)return result('REJECTED',reasons,{schema:ROOM_PROJECTION_SCHEMA});

  const wallpapers=Object.freeze(Object.fromEntries(wallpaperEntries.map(([k,v])=>[String(k),v])));
  const wallGridIds=Object.freeze(Object.fromEntries(wallGridEntries.map(([k,v])=>[String(k),v])));
  const wallpaperOffsetById=Object.freeze(Object.fromEntries(offsets.map(([k,v])=>[String(k),v])));
  return result('READY',[],{
    schema:ROOM_PROJECTION_SCHEMA,
    semanticLocation:Object.freeze({houseItemId:loc.houseItemId,floorIndex:loc.floorIndex,roomSlot:loc.roomSlot}),
    currentSaveLocator:Object.freeze({
      playerHouseIndex,
      floorGridId,
      wallGridIds
    }),
    roomState:Object.freeze({
      roomPrefabAddress:String(room.RoomPrefabAddress??''),
      flooring,
      wallpapers,
      wallpaperOffsetById,
      ceiling
    }),
    wallMapSemantics:'MAP_BY_HOUSE_WALL_POSITION_NOT_ORDERED_SEQUENCE',
    wallPositionEnum:WALL_POSITION,
    wallpaperOffsetKeySemantics:'MAP_BY_WALLPAPER_ITEM_ID_NOT_WALL_POSITION',
    ceilingWriteAuthorized:false
  });
}

export function resolveCurrentWall({projection,activeWallGridId}={}){
  const reasons=[];
  if(!projection||projection.schema!==ROOM_PROJECTION_SCHEMA||projection.status!=='READY')
    reasons.push('ROOM_PROJECTION_READY_REQUIRED');
  const gid=nonNegativeInt(activeWallGridId);
  if(gid===null)reasons.push('ACTIVE_WALL_GRID_ID_REQUIRED');
  if(reasons.length)return result('REJECTED',reasons,{kind:'CURRENT_WALL_RESOLUTION'});
  const matches=[];
  for(const [key,value] of Object.entries(projection.currentSaveLocator.wallGridIds))
    if(Number(value)===gid)matches.push(Number(key));
  if(matches.length===0)return result('REJECTED',['ACTIVE_WALL_GRID_NOT_IN_ROOM'],{kind:'CURRENT_WALL_RESOLUTION'});
  if(matches.length!==1)return result('REJECTED',['ACTIVE_WALL_GRID_AMBIGUOUS'],{kind:'CURRENT_WALL_RESOLUTION'});
  const wallPosition=matches[0];
  const wallpaperItemId=nonNegativeInt(projection.roomState.wallpapers[String(wallPosition)]);
  if(wallpaperItemId===null)return result('REJECTED',['CURRENT_WALL_WALLPAPER_UNRESOLVED'],{kind:'CURRENT_WALL_RESOLUTION'});
  return result('READY',[],{
    kind:'CURRENT_WALL_RESOLUTION',
    wallPosition,
    wallGridId:gid,
    currentWallpaperItemId:wallpaperItemId
  });
}

// 01B native correction: exact v1.25 ApplyThis ownership + wallpaper-offset companion semantics.
function nativeHasOwn(o,k){return Boolean(o)&&Object.prototype.hasOwnProperty.call(o,k);}
function nativeNormalizeTrimmingType(v){
  if(v===0||v==='0'||v==='Wallpaper'||v==='TrimmingItemType_Wallpaper')return 'Wallpaper';
  if(v===1||v==='1'||v==='Flooring'||v==='TrimmingItemType_Flooring')return 'Flooring';
  return null;
}
function nativeResolveTrimmingOwnership(profile,itemId,reasons){
  const inventories=obj(profile?.Player?.ListInventories);
  if(!inventories){reasons.push('PLAYER_LIST_INVENTORIES_REQUIRED');return null;}
  const matches=[];
  for(const [mapKey,raw] of Object.entries(inventories)){
    const inv=obj(raw);
    if(inv?.CompatibleItemType==='ItemType_Trimming')matches.push({mapKey,inv});
  }
  if(matches.length!==1){
    reasons.push(matches.length?'TRIMMING_LIST_INVENTORY_AMBIGUOUS':'TRIMMING_LIST_INVENTORY_MISSING');
    return null;
  }
  const {mapKey,inv}=matches[0];
  const inventoryId=nonNegativeInt(inv.ID),keyId=nonNegativeInt(mapKey);
  if(inventoryId===null||keyId===null||inventoryId!==keyId){
    reasons.push('TRIMMING_LIST_INVENTORY_IDENTITY_MISMATCH');return null;
  }
  const inventory=obj(inv.Inventory);
  if(!inventory){reasons.push('TRIMMING_INVENTORY_MAP_REQUIRED');return null;}
  const entry=obj(inventory[String(itemId)]??inventory[itemId]);
  const amount=entry?nonNegativeInt(entry.Amount):0;
  if(amount===null){reasons.push('TRIMMING_INVENTORY_AMOUNT_INVALID');return null;}
  if(amount<1){reasons.push('NATIVE_NOT_ENOUGH_ITEMS');return null;}
  return Object.freeze({
    listInventoryMapKey:String(mapKey),listInventoryId:inventoryId,
    itemId,amount,marker:entry?.Marker??null
  });
}

export function classifyRoomFinishDefinition({profile,definition,kind}={}){
  const reasons=[],expected=String(kind||'');
  if(!Object.values(FINISH_KIND).includes(expected))reasons.push('ROOM_FINISH_KIND_INVALID');
  if(definition?.concreteType!=='TrimmingItemData')reasons.push('TRIMMING_ITEM_DATA_REQUIRED');
  const itemId=positiveInt(definition?.itemID??definition?.id);
  if(itemId===null)reasons.push('TRIMMING_ITEM_ID_REQUIRED');
  const trimmingType=nativeNormalizeTrimmingType(definition?.trimmingType);
  const expectedType=expected===FINISH_KIND.FLOORING?'Flooring':expected===FINISH_KIND.WALLPAPER?'Wallpaper':null;
  if(trimmingType!==expectedType)reasons.push('TRIMMING_SUBTYPE_MISMATCH');
  const ownership=itemId===null?null:nativeResolveTrimmingOwnership(profile,itemId,reasons);
  if(reasons.length)return result('REJECTED',reasons,{kind:'ROOM_FINISH_DEFINITION'});
  return result('READY',[],{
    kind:'ROOM_FINISH_DEFINITION',finishKind:expected,itemId,trimmingType,ownership,
    isSyncOnlineItem:Boolean(definition?.isSyncOnlineItem),
    isUnavailableForGenerator:Boolean(definition?.isUnavailableForGenerator),
    inventoryPolicy:'OWNED_REQUIRED_PRESERVE_EXACT_NO_DEBIT_NO_GRANT',
    entitlementPolicy:'PRESERVE_EXACT_NO_GRANT'
  });
}
function nativeRoomBasePointer(p){
  const x=p.currentSaveLocator;
  return `/World/PlayerHouses/${x.playerHouseIndex}/Floors/${p.semanticLocation.floorIndex}/Rooms/${p.semanticLocation.roomSlot}`;
}
function nativeTargetIdentity(p){
  return Object.freeze({
    houseItemId:p.semanticLocation.houseItemId,floorIndex:p.semanticLocation.floorIndex,roomSlot:p.semanticLocation.roomSlot,
    playerHouseIndex:p.currentSaveLocator.playerHouseIndex,floorGridId:p.currentSaveLocator.floorGridId,
    wallGridIds:clone(p.currentSaveLocator.wallGridIds)
  });
}
function nativeMutationBase(projection,definition){
  return {
    schema:ROOM_MUTATION_SCHEMA,contract:ROOM_FINISH_CONTRACT,semanticOwner:SEMANTIC_OWNER,
    target:nativeTargetIdentity(projection),
    definition:Object.freeze({
      itemId:definition.itemId,trimmingType:definition.trimmingType,ownership:clone(definition.ownership),
      isSyncOnlineItem:definition.isSyncOnlineItem,isUnavailableForGenerator:definition.isUnavailableForGenerator
    }),
    preserveExact:Object.freeze([
      'Room.Name','Room.FloorGridID','Room.WallGridIDs','Room.RoomPrefabAddress','Room.Ceiling',
      'all WallpaperOffsetById entries except declared native stale-offset cleanup removals',
      'all room Grid contents','all other rooms/houses','Trimming inventory','Collection',
      'ownership/provenance','entitlement/premium/DLC','Store/Shop','progression','all opaque/unrelated state'
    ]),
    persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false,PERSISTENT_WRITE:false,
    productApplyAuthorized:false,directSourceReplacementAuthorized:false
  };
}
function nativeSetChange(path,before,after,extra={}){return Object.freeze({kind:'SET',path,...extra,before,after});}
function nativeRemoveChange(path,before,extra={}){return Object.freeze({kind:'REMOVE',path,...extra,before});}

export function planFlooringMutation({projection,definition}={}){
  if(!projection||projection.schema!==ROOM_PROJECTION_SCHEMA||projection.status!=='READY')
    return result('REJECTED',['ROOM_PROJECTION_READY_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  if(!definition||definition.status!=='READY'||definition.finishKind!==FINISH_KIND.FLOORING)
    return result('REJECTED',['FLOORING_DEFINITION_READY_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  const before=projection.roomState.flooring,after=definition.itemId;
  if(before===after)return result('REJECTED',['ROOM_FINISH_NOOP'],{schema:ROOM_MUTATION_SCHEMA});
  return result('READY',[],{
    ...nativeMutationBase(projection,definition),operation:'SET_FLOORING',wallpaperScope:null,
    changes:Object.freeze([nativeSetChange(nativeRoomBasePointer(projection)+'/Flooring',before,after)]),
    nativeCompanionPolicy:'NONE',atomicity:'ONE_ROOM_ONE_SCALAR_ALL_OR_NOTHING'
  });
}

export function planWallpaperMutation({projection,definition,scope,activeWallGridId}={}){
  if(!projection||projection.schema!==ROOM_PROJECTION_SCHEMA||projection.status!=='READY')
    return result('REJECTED',['ROOM_PROJECTION_READY_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  if(!definition||definition.status!=='READY'||definition.finishKind!==FINISH_KIND.WALLPAPER)
    return result('REJECTED',['WALLPAPER_DEFINITION_READY_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  if(!Object.values(WALL_SCOPE).includes(scope))
    return result('REJECTED',['WALLPAPER_SCOPE_INVALID'],{schema:ROOM_MUTATION_SCHEMA});

  let positions,currentWall=null;
  if(scope===WALL_SCOPE.CURRENT_WALL){
    currentWall=resolveCurrentWall({projection,activeWallGridId});
    if(currentWall.status!=='READY')return result('REJECTED',currentWall.reasonCodes,{schema:ROOM_MUTATION_SCHEMA});
    positions=[currentWall.wallPosition];
  }else{
    positions=Object.keys(projection.currentSaveLocator.wallGridIds).map(Number).sort((a,b)=>a-b);
    if(!same(positions,WALL_POSITIONS))
      return result('REJECTED',['ALL_WALLS_EXACT_POSITION_SET_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  }
  const beforeMap={...projection.roomState.wallpapers},afterMap={...beforeMap};
  const changes=[],wallRoot=nativeRoomBasePointer(projection)+'/Wallpapers';
  for(const position of positions){
    const key=String(position),before=nonNegativeInt(beforeMap[key]);
    if(before===null)return result('REJECTED',['ROOM_WALLPAPER_POSITION_MISSING'],{schema:ROOM_MUTATION_SCHEMA});
    if(before!==definition.itemId){
      changes.push(nativeSetChange(wallRoot+'/'+position,before,definition.itemId,{
        wallPosition:position,wallGridId:projection.currentSaveLocator.wallGridIds[key]
      }));
      afterMap[key]=definition.itemId;
    }
  }
  if(!changes.length)return result('REJECTED',['ROOM_FINISH_NOOP'],{schema:ROOM_MUTATION_SCHEMA});

  const finalIds=new Set(Object.values(afterMap).map(Number));
  const oldIds=unique(changes.map(x=>x.before));
  const offsetRoot=nativeRoomBasePointer(projection)+'/WallpaperOffsetById',cleanup=[];
  for(const oldId of oldIds){
    if(finalIds.has(oldId))continue;
    const key=String(oldId);
    if(nativeHasOwn(projection.roomState.wallpaperOffsetById,key)){
      cleanup.push(nativeRemoveChange(offsetRoot+'/'+key,projection.roomState.wallpaperOffsetById[key],{
        wallpaperItemId:oldId,reason:'NATIVE_OLD_WALLPAPER_NO_LONGER_REFERENCED'
      }));
    }
  }
  changes.push(...cleanup);
  return result('READY',[],{
    ...nativeMutationBase(projection,definition),operation:'SET_WALLPAPER',wallpaperScope:scope,
    activeWall:currentWall?.status==='READY'?Object.freeze({wallPosition:currentWall.wallPosition,wallGridId:currentWall.wallGridId}):null,
    changes:Object.freeze(changes),
    wallpaperOffsetPolicy:'REMOVE_OLD_WALLPAPER_OFFSET_ONLY_IF_OLD_ID_NO_LONGER_REFERENCED_AFTER_REPLACEMENT',
    wallpaperOffsetCleanupItemIds:Object.freeze(cleanup.map(x=>x.wallpaperItemId).sort((a,b)=>a-b)),
    newWallpaperOffsetPolicy:'PRESERVE_EXISTING_IF_PRESENT_OTHERWISE_DO_NOT_CREATE',
    atomicity:scope===WALL_SCOPE.CURRENT_WALL
      ? 'ONE_ROOM_ONE_WALL_PLUS_NATIVE_STALE_OFFSET_CLEANUP_ALL_OR_NOTHING'
      : 'ONE_ROOM_ALL_FOUR_WALL_INTENT_PLUS_NATIVE_STALE_OFFSET_CLEANUP_ALL_OR_NOTHING'
  });
}
function nativeAssertTargetRoom(draft,t){
  const reasons=[],resolved=roomByResolvedPath(draft,t.playerHouseIndex,t.floorIndex,t.roomSlot,reasons);
  if(!resolved||reasons.length)throw Error('ROOM_FINISH_TARGET_ROOM_UNRESOLVED');
  if(positiveInt(resolved.house.HouseItemID)!==t.houseItemId)throw Error('ROOM_FINISH_HOUSE_IDENTITY_MISMATCH');
  if(nonNegativeInt(resolved.room.FloorGridID)!==t.floorGridId)throw Error('ROOM_FINISH_FLOOR_GRID_IDENTITY_MISMATCH');
  const entries=mapEntries(resolved.room.WallGridIDs,'ROOM_FINISH_WALL_GRID_IDENTITY_MISMATCH',reasons,{valueKind:'uint'});
  const map=Object.fromEntries((entries??[]).map(([k,v])=>[String(k),v]));
  if(reasons.length||!same(map,t.wallGridIds))throw Error('ROOM_FINISH_WALL_GRID_IDENTITY_MISMATCH');
  return resolved;
}
function nativeApplyChange(room,base,change){
  if(!change.path.startsWith(base+'/'))throw Error('ROOM_FINISH_CHANGE_OUTSIDE_TARGET_ROOM');
  const suffix=change.path.slice((base+'/').length).split('/');
  if(change.kind==='SET'&&suffix[0]==='Flooring'&&suffix.length===1){
    if(nonNegativeInt(room.Flooring)!==change.before)throw Error('ROOM_FINISH_PRECONDITION_DRIFT');
    room.Flooring=change.after;return;
  }
  if(change.kind==='SET'&&suffix[0]==='Wallpapers'&&suffix.length===2){
    const key=suffix[1];
    if(nonNegativeInt(room.Wallpapers?.[key])!==change.before)throw Error('ROOM_FINISH_PRECONDITION_DRIFT');
    room.Wallpapers[key]=change.after;return;
  }
  if(change.kind==='REMOVE'&&suffix[0]==='WallpaperOffsetById'&&suffix.length===2){
    const key=suffix[1];
    if(!nativeHasOwn(room.WallpaperOffsetById,key)||Number(room.WallpaperOffsetById[key])!==Number(change.before))
      throw Error('ROOM_FINISH_PRECONDITION_DRIFT');
    delete room.WallpaperOffsetById[key];return;
  }
  throw Error('ROOM_FINISH_CHANGE_PATH_UNSUPPORTED');
}
function nativeAssertOwnership(profile,definition){
  const reasons=[],o=nativeResolveTrimmingOwnership(profile,definition.itemId,reasons),f=definition.ownership;
  if(!o||reasons.length||o.listInventoryMapKey!==f.listInventoryMapKey||o.listInventoryId!==f.listInventoryId||o.amount!==f.amount)
    throw Error('ROOM_FINISH_TRIMMING_OWNERSHIP_DRIFT');
}

export function applyRoomFinishDraft(profile,mutation){
  if(!mutation||mutation.schema!==ROOM_MUTATION_SCHEMA||mutation.status!=='READY')throw Error('ROOM_FINISH_READY_MUTATION_REQUIRED');
  const draft=clone(profile),resolved=nativeAssertTargetRoom(draft,mutation.target);
  nativeAssertOwnership(draft,mutation.definition);
  const t=mutation.target,base=`/World/PlayerHouses/${t.playerHouseIndex}/Floors/${t.floorIndex}/Rooms/${t.roomSlot}`;
  for(const change of mutation.changes)nativeApplyChange(resolved.room,base,change);
  return draft;
}
function nativePointer(t,tail=''){
  const base=`/World/PlayerHouses/${t.playerHouseIndex}/Floors/${t.floorIndex}/Rooms/${t.roomSlot}`;
  return tail?base+'/'+tail:base;
}
function nativeOwnershipAmountPointer(d){
  return `/Player/ListInventories/${d.ownership.listInventoryMapKey}/Inventory/${d.itemId}/Amount`;
}
function nativeMutationByPlan(plan){
  const m=plan?.intent?.roomFinishMutation;
  if(!m||m.schema!==ROOM_MUTATION_SCHEMA||m.status!=='READY')throw Error('ROOM_FINISH_PLAN_MUTATION_REQUIRED');
  return m;
}
function nativeAssertPlan(plan){
  if(!plan||plan.contract!=='dreamwish.ddv.save-transaction-plan@1')throw Error('ROOM_FINISH_TRANSACTION_PLAN_REQUIRED');
  if(plan.semanticOwner!==SEMANTIC_OWNER||plan.operation?.owner!==SEMANTIC_OWNER)throw Error('ROOM_FINISH_TRANSACTION_OWNER_MISMATCH');
  if(plan.capabilityRequired!=='WRITE_CANDIDATE'||plan.target?.kind!=='PLAYER_HOUSE_ROOM_SURFACE')
    throw Error('ROOM_FINISH_TRANSACTION_TARGET_MISMATCH');
  if(plan.mutationAdapter?.contract!==MUTATION_ADAPTER_CONTRACT||plan.mutationAdapter?.id!==MUTATION_ADAPTER_ID||plan.mutationAdapter?.owner!==SEMANTIC_OWNER)
    throw Error('ROOM_FINISH_ADAPTER_BINDING_MISMATCH');
  const m=nativeMutationByPlan(plan);
  for(const k of ['playerHouseIndex','houseItemId','floorIndex','roomSlot','floorGridId'])
    if(!same(plan.target[k],m.target[k]))throw Error('ROOM_FINISH_TARGET_MUTATION_BINDING_MISMATCH');
  if(!same(plan.target.wallGridIds,m.target.wallGridIds))throw Error('ROOM_FINISH_TARGET_MUTATION_BINDING_MISMATCH');
  if(!same(arr(plan.allowedChanges).map(x=>x?.path).sort(),m.changes.map(x=>x.path).sort()))
    throw Error('ROOM_FINISH_ALLOWED_PATH_BINDING_MISMATCH');
  if(plan.intent?.semanticContract!==ROOM_FINISH_CONTRACT||plan.intent?.persistentWriteAuthorized!==false)
    throw Error('ROOM_FINISH_INTENT_CONTRACT_MISMATCH');
  return m;
}
export function buildRoomFinishTransactionPlanCandidate({mutation,transactionInput,planId='01b-room-finish-v125'}={}){
  if(!mutation||mutation.schema!==ROOM_MUTATION_SCHEMA||mutation.status!=='READY')throw Error('ROOM_FINISH_READY_MUTATION_REQUIRED');
  const t=mutation.target,roomRoot=nativePointer(t),ownershipPath=nativeOwnershipAmountPointer(mutation.definition);
  const preconditions=[
    {path:`/World/PlayerHouses/${t.playerHouseIndex}/HouseItemID`,operator:'EQUALS',value:t.houseItemId},
    {path:roomRoot+'/FloorGridID',operator:'EQUALS',value:t.floorGridId},
    {path:roomRoot+'/WallGridIDs',operator:'EQUALS',value:clone(t.wallGridIds)},
    {path:ownershipPath,operator:'EQUALS',value:mutation.definition.ownership.amount},
    ...mutation.changes.map(x=>({path:x.path,operator:'EQUALS',value:clone(x.before)}))
  ];
  const postconditions=[
    {path:`/World/PlayerHouses/${t.playerHouseIndex}/HouseItemID`,operator:'EQUALS',value:t.houseItemId},
    {path:roomRoot+'/FloorGridID',operator:'EQUALS',value:t.floorGridId},
    {path:roomRoot+'/WallGridIDs',operator:'EQUALS',value:clone(t.wallGridIds)},
    {path:ownershipPath,operator:'EQUALS',value:mutation.definition.ownership.amount},
    ...mutation.changes.map(x=>x.kind==='REMOVE'
      ? {path:x.path,operator:'NOT_EXISTS'}
      : {path:x.path,operator:'EQUALS',value:clone(x.after)})
  ];
  const operationKind=mutation.operation==='SET_FLOORING'?'ROOM_SET_FLOORING'
    :mutation.wallpaperScope===WALL_SCOPE.CURRENT_WALL?'ROOM_SET_WALLPAPER_CURRENT_WALL':'ROOM_SET_WALLPAPER_ALL_WALLS';
  return Object.freeze({
    contract:'dreamwish.ddv.save-transaction-plan@1',planId,semanticOwner:SEMANTIC_OWNER,capabilityRequired:'WRITE_CANDIDATE',
    input:clone(transactionInput),
    operation:{id:'WORLD_PLAYER_HOUSE_ROOM_FINISH_V125',owner:SEMANTIC_OWNER,kind:operationKind,structuralCapabilitiesSupported:false,planSupported:true,validationPassed:true,runtimeGate:'PENDING'},
    target:{kind:'PLAYER_HOUSE_ROOM_SURFACE',playerHouseIndex:t.playerHouseIndex,houseItemId:t.houseItemId,floorIndex:t.floorIndex,roomSlot:t.roomSlot,floorGridId:t.floorGridId,wallGridIds:clone(t.wallGridIds)},
    mutationAdapter:{contract:MUTATION_ADAPTER_CONTRACT,id:MUTATION_ADAPTER_ID,owner:SEMANTIC_OWNER},
    preconditions,allowedChanges:mutation.changes.map(x=>({path:x.path,classification:'INTENTIONAL'})),
    forbiddenPathPrefixes:['/GameInfo','/Player','/World/GridCollection','/World/Stores','/World/Shops'],
    postconditions,
    preservation:{gridObjectIdentityPolicy:'PRESERVE_ALL_GRID_OBJECT_IDENTITIES',arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',unknownPathPrefixes:[roomRoot+'/FutureOpaque','/World/OpaqueWorld']},
    sourceEvidence:[
      {id:'DDV-V1.25-WAND-INDOOR-ROOM-RESOLVER-CONTRACT-2026-09-29',status:'CONFIRMED_STATIC_CROSS_PLATFORM'},
      {id:'DDV-V1.25-SAVE-BACKED-WAND-STRUCTURE-AUDIT-2026-09-29',status:'CONFIRMED_CURRENT_SAVE'},
      {id:'SWITCH-V125-CHANGE-PLAYER-HOUSE-FLOORING-APPLYTHIS-RVA-53D4D00',status:'CONFIRMED_CURRENT_V125_NATIVE'},
      {id:'SWITCH-V125-CHANGE-PLAYER-HOUSE-WALLPAPER-APPLYTHIS-RVA-53E1E30-HELPER-53E2470',status:'CONFIRMED_CURRENT_V125_NATIVE'},
      {id:'SWITCH-V125-CHANGE-PLAYER-HOUSE-WALLPAPER-OFFSET-APPLYTHIS-RVA-53DCB30',status:'CONFIRMED_CURRENT_V125_NATIVE_CORROBORATION'},
      {id:'01B-TO-01A-ROOM-SURFACE-TARGET-V125-V1',status:'UPSTREAM_TARGET_SUPPORT_REQUIRED'}
    ],
    intent:{
      semanticContract:ROOM_FINISH_CONTRACT,roomFinishMutation:clone(mutation),wallpaperOffsetEdit:false,
      wallpaperOffsetCleanup:mutation.changes.some(x=>x.kind==='REMOVE'&&x.path.includes('/WallpaperOffsetById/')),
      ceilingMutation:false,trimmingInventoryMutation:false,collectionMutation:false,entitlementMutation:false,storeMutation:false,progressionMutation:false,persistentWriteAuthorized:false
    }
  });
}
export const roomFinishMutationAdapter=Object.freeze({
  contract:MUTATION_ADAPTER_CONTRACT,id:MUTATION_ADAPTER_ID,owner:SEMANTIC_OWNER,
  apply(draft,intent,plan){
    const m=nativeAssertPlan(plan),expectedCleanup=m.changes.some(x=>x.kind==='REMOVE'&&x.path.includes('/WallpaperOffsetById/'));
    if(!same(intent?.roomFinishMutation,m))throw Error('ROOM_FINISH_INTENT_MUTATION_MISMATCH');
    if(intent?.wallpaperOffsetEdit!==false||intent?.wallpaperOffsetCleanup!==expectedCleanup||
       intent?.ceilingMutation!==false||intent?.trimmingInventoryMutation!==false||intent?.collectionMutation!==false||
       intent?.entitlementMutation!==false||intent?.storeMutation!==false||intent?.progressionMutation!==false)
      throw Error('ROOM_FINISH_UNRELATED_MUTATION_FORBIDDEN');
    const resolved=nativeAssertTargetRoom(draft,m.target);
    nativeAssertOwnership(draft,m.definition);
    const base=nativePointer(m.target);
    for(const change of m.changes)nativeApplyChange(resolved.room,base,change);
  },
  persistentWriteAuthorized:false,WORLD_PERSISTENT_WRITE_V125:false
});
