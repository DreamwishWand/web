/* Dreamwish Wand DDV Core 01B — Indoor Room Finish semantics.
 * Nintendo Switch DDV v1.25.0 / BID 52BD625D9B4E0053 / schema 624.
 * Read/draft semantic owner for DEC-UX-241..242.
 * This module does NOT provide a save-layer writer and does NOT authorize Apply.
 */
'use strict';

export const ROOM_FINISH_CONTRACT='ddv.room-finish-semantics@1';
export const ROOM_PROJECTION_SCHEMA='ddv.indoor-room-finish-projection@1';
export const ROOM_MUTATION_SCHEMA='ddv.room-finish-mutation@1';
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

export function classifyRoomFinishDefinition({definition,kind}={}){
  const reasons=[];
  const expected=String(kind||'');
  if(!Object.values(FINISH_KIND).includes(expected))reasons.push('ROOM_FINISH_KIND_INVALID');
  if(definition?.concreteType!=='TrimmingItemData')reasons.push('TRIMMING_ITEM_DATA_REQUIRED');
  const itemId=positiveInt(definition?.itemID??definition?.id);
  if(itemId===null)reasons.push('TRIMMING_ITEM_ID_REQUIRED');
  const trimmingType=String(definition?.trimmingType??'');
  const expectedType=expected===FINISH_KIND.FLOORING?'Flooring':expected===FINISH_KIND.WALLPAPER?'Wallpaper':'';
  if(trimmingType!==expectedType)reasons.push('TRIMMING_SUBTYPE_MISMATCH');
  if(definition?.isUnavailableForGenerator!==false)reasons.push('TRIMMING_GENERATOR_AVAILABLE_REQUIRED');
  if(definition?.isSyncOnlineItem!==false)reasons.push('TRIMMING_SYNC_ONLINE_EXCLUDED');
  if(reasons.length)return result('REJECTED',reasons,{kind:'ROOM_FINISH_DEFINITION'});
  return result('READY',[],{
    kind:'ROOM_FINISH_DEFINITION',
    finishKind:expected,
    itemId,
    trimmingType,
    inventoryPolicy:'PRESERVE_EXACT_OFFLINE_ROOM_SURFACE_WRITE',
    nativeGameplayNotEnoughItemsGate:'NOT_REPLICATED_BY_THIS_OFFLINE_SEMANTIC_CONTRACT'
  });
}

function roomBasePointer(p){
  const x=p.currentSaveLocator;
  return `/World/PlayerHouses/${x.playerHouseIndex}/Floors/${p.semanticLocation.floorIndex}/Rooms/${p.semanticLocation.roomSlot}`;
}
function exactTargetIdentity(p){
  return Object.freeze({
    houseItemId:p.semanticLocation.houseItemId,
    floorIndex:p.semanticLocation.floorIndex,
    roomSlot:p.semanticLocation.roomSlot,
    playerHouseIndex:p.currentSaveLocator.playerHouseIndex,
    floorGridId:p.currentSaveLocator.floorGridId,
    wallGridIds:clone(p.currentSaveLocator.wallGridIds)
  });
}
function finishMutationBase(projection,definition){
  return {
    schema:ROOM_MUTATION_SCHEMA,
    contract:ROOM_FINISH_CONTRACT,
    semanticOwner:SEMANTIC_OWNER,
    target:exactTargetIdentity(projection),
    definition:Object.freeze({itemId:definition.itemId,trimmingType:definition.trimmingType}),
    preserveExact:Object.freeze([
      'Room.Name','Room.FloorGridID','Room.WallGridIDs','Room.RoomPrefabAddress',
      'Room.WallpaperOffsetById','Room.Ceiling',
      'all room Grid contents','all other rooms/houses','Trimming inventory','Collection',
      'ownership/provenance','entitlement/premium/DLC','Store/Shop','progression','all opaque/unrelated state'
    ]),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  };
}

export function planFlooringMutation({projection,definition}={}){
  if(!projection||projection.schema!==ROOM_PROJECTION_SCHEMA||projection.status!=='READY')
    return result('REJECTED',['ROOM_PROJECTION_READY_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  if(!definition||definition.status!=='READY'||definition.finishKind!==FINISH_KIND.FLOORING)
    return result('REJECTED',['FLOORING_DEFINITION_READY_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  const before=projection.roomState.flooring,after=definition.itemId;
  if(before===after)return result('REJECTED',['ROOM_FINISH_NOOP'],{schema:ROOM_MUTATION_SCHEMA});
  const base=finishMutationBase(projection,definition);
  const path=roomBasePointer(projection)+'/Flooring';
  return result('READY',[],{
    ...base,
    operation:'SET_FLOORING',
    wallpaperScope:null,
    changes:Object.freeze([{path,before,after}]),
    atomicity:'ONE_ROOM_ONE_SCALAR_ALL_OR_NOTHING'
  });
}

export function planWallpaperMutation({projection,definition,scope,activeWallGridId}={}){
  if(!projection||projection.schema!==ROOM_PROJECTION_SCHEMA||projection.status!=='READY')
    return result('REJECTED',['ROOM_PROJECTION_READY_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  if(!definition||definition.status!=='READY'||definition.finishKind!==FINISH_KIND.WALLPAPER)
    return result('REJECTED',['WALLPAPER_DEFINITION_READY_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  if(!Object.values(WALL_SCOPE).includes(scope))
    return result('REJECTED',['WALLPAPER_SCOPE_INVALID'],{schema:ROOM_MUTATION_SCHEMA});

  let positions;
  let currentWall=null;
  if(scope===WALL_SCOPE.CURRENT_WALL){
    currentWall=resolveCurrentWall({projection,activeWallGridId});
    if(currentWall.status!=='READY')return result('REJECTED',currentWall.reasonCodes,{schema:ROOM_MUTATION_SCHEMA});
    positions=[currentWall.wallPosition];
  }else{
    positions=Object.keys(projection.currentSaveLocator.wallGridIds).map(Number).sort((a,b)=>a-b);
    if(!same(positions,WALL_POSITIONS))
      return result('REJECTED',['ALL_WALLS_EXACT_POSITION_SET_REQUIRED'],{schema:ROOM_MUTATION_SCHEMA});
  }
  const root=roomBasePointer(projection)+'/Wallpapers';
  const changes=[];
  for(const position of positions){
    const before=nonNegativeInt(projection.roomState.wallpapers[String(position)]);
    if(before===null)return result('REJECTED',['ROOM_WALLPAPER_POSITION_MISSING'],{schema:ROOM_MUTATION_SCHEMA});
    if(before!==definition.itemId)changes.push({
      path:root+'/'+position,
      wallPosition:position,
      wallGridId:projection.currentSaveLocator.wallGridIds[String(position)],
      before,
      after:definition.itemId
    });
  }
  if(!changes.length)return result('REJECTED',['ROOM_FINISH_NOOP'],{schema:ROOM_MUTATION_SCHEMA});
  const base=finishMutationBase(projection,definition);
  return result('READY',[],{
    ...base,
    operation:'SET_WALLPAPER',
    wallpaperScope:scope,
    activeWall:currentWall?.status==='READY'
      ? Object.freeze({wallPosition:currentWall.wallPosition,wallGridId:currentWall.wallGridId})
      : null,
    changes:Object.freeze(changes),
    wallpaperOffsetPolicy:'PRESERVE_EXACT_DEC_UX_241_242_OFFSET_IS_SEPARATE_TRANSACTION_AND_NOT_EDITED',
    atomicity:scope===WALL_SCOPE.CURRENT_WALL
      ? 'ONE_ROOM_ONE_WALL_MAP_ENTRY_ALL_OR_NOTHING'
      : 'ONE_ROOM_ALL_FOUR_WALL_MAP_ENTRIES_ALL_OR_NOTHING'
  });
}

export function applyRoomFinishDraft(profile,mutation){
  if(!mutation||mutation.schema!==ROOM_MUTATION_SCHEMA||mutation.status!=='READY')
    throw Error('ROOM_FINISH_READY_MUTATION_REQUIRED');
  const draft=clone(profile),t=mutation.target,reasons=[];
  const resolved=roomByResolvedPath(draft,t.playerHouseIndex,t.floorIndex,t.roomSlot,reasons);
  if(!resolved||reasons.length)throw Error('ROOM_FINISH_TARGET_ROOM_UNRESOLVED');
  if(positiveInt(resolved.house.HouseItemID)!==t.houseItemId)throw Error('ROOM_FINISH_HOUSE_IDENTITY_MISMATCH');
  if(nonNegativeInt(resolved.room.FloorGridID)!==t.floorGridId)throw Error('ROOM_FINISH_FLOOR_GRID_IDENTITY_MISMATCH');
  const wallEntries=mapEntries(resolved.room.WallGridIDs,'ROOM_FINISH_WALL_GRID_IDENTITY_MISMATCH',reasons,{valueKind:'uint'});
  const wallMap=Object.fromEntries((wallEntries??[]).map(([k,v])=>[String(k),v]));
  if(reasons.length||!same(wallMap,t.wallGridIds))throw Error('ROOM_FINISH_WALL_GRID_IDENTITY_MISMATCH');

  const roomBase=roomBasePointer({
    semanticLocation:{floorIndex:t.floorIndex,roomSlot:t.roomSlot},
    currentSaveLocator:{playerHouseIndex:t.playerHouseIndex}
  });
  for(const change of mutation.changes){
    if(!change.path.startsWith(roomBase+'/'))throw Error('ROOM_FINISH_CHANGE_OUTSIDE_TARGET_ROOM');
    const suffix=change.path.slice((roomBase+'/').length).split('/');
    if(suffix[0]==='Flooring'&&suffix.length===1){
      if(nonNegativeInt(resolved.room.Flooring)!==change.before)throw Error('ROOM_FINISH_PRECONDITION_DRIFT');
      resolved.room.Flooring=change.after;
    }else if(suffix[0]==='Wallpapers'&&suffix.length===2){
      const key=suffix[1];
      if(nonNegativeInt(resolved.room.Wallpapers?.[key])!==change.before)throw Error('ROOM_FINISH_PRECONDITION_DRIFT');
      resolved.room.Wallpapers[key]=change.after;
    }else throw Error('ROOM_FINISH_CHANGE_PATH_UNSUPPORTED');
  }
  return draft;
}
