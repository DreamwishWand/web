/* Dreamwish Wand DDV Core 01B — Room Finish semantics.
 * Nintendo Switch DDV v1.25.0 / BID 52BD625D9B4E0053 / schema 624.
 * Semantic compiler only. No persistent write authorization.
 */
'use strict';

export const ROOM_FINISH_CONTRACT='ddv.room-finish-semantics@1';
export const ROOM_FINISH_PROJECTION_CONTRACT='ddv.indoor-room-finish-projection@1';
export const ROOM_FINISH_MUTATION_SET_CONTRACT='ddv.room-finish-mutation-set@1';
export const ROOM_FINISH_UPSTREAM_REQUEST_ID='01B-TO-01A-ROOM-FINISH-TARGET-V125-V1';
export const SEMANTIC_OWNER='01B CORE - World / Grid / Buildings';
export const GAME_VERSION='1.25.0';
export const PROFILE_SCHEMA=624;
export const SWITCH_BID='52BD625D9B4E0053';
export const TITLE_ID='0100D39012C1A000';

export const ROOM_SLOTS=Object.freeze({
  CENTER:0, LEFT:1, RIGHT:2, TOP:3
});
export const WALL_POSITIONS=Object.freeze({
  TOP:0, RIGHT:1, BOTTOM:2, LEFT:3
});
export const WALL_POSITION_NAMES=Object.freeze(['Top','Right','Bottom','Left']);
export const WALLPAPER_SCOPE=Object.freeze({
  CURRENT_WALL:'CURRENT_WALL',
  ALL_WALLS:'ALL_WALLS'
});
export const ROOM_FINISH_OPERATION=Object.freeze({
  SET_FLOORING:'SET_FLOORING',
  SET_WALLPAPER:'SET_WALLPAPER'
});

const ROOM_SLOT_SET=new Set(Object.values(ROOM_SLOTS));
const WALL_POSITION_SET=new Set(Object.values(WALL_POSITIONS));

function isObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function int(v){const n=Number(v);return Number.isSafeInteger(n)?n:null;}
function clone(v){return structuredClone(v);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function ptr(v){return String(v).replace(/~/g,'~0').replace(/\//g,'~1');}
function own(o,k){return Boolean(o&&Object.prototype.hasOwnProperty.call(o,String(k)));}
function objMap(v){return isObj(v)?v:null;}
function unique(xs){return [...new Set(xs)];}

function baseResult(status,reasons=[],extra={}){
  return Object.freeze({
    contract:ROOM_FINISH_CONTRACT,
    status,
    ok:status==='VALID'||status==='READY',
    reasonCodes:Object.freeze(unique(reasons)),
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false,
    ...extra
  });
}

export function validateRoomFinishSource(source){
  const reasons=[];
  if(source?.platform!=='Nintendo Switch')reasons.push('EXACT_SWITCH_PLATFORM_REQUIRED');
  if(source?.gameVersion!==GAME_VERSION)reasons.push('EXACT_V125_GAME_VERSION_REQUIRED');
  if(Number(source?.profileSchemaVersion)!==PROFILE_SCHEMA)reasons.push('EXACT_SCHEMA_624_REQUIRED');
  if(source?.buildIdentity!==SWITCH_BID)reasons.push('EXACT_SWITCH_BID_REQUIRED');
  return reasons;
}

function playerHouses(profile){
  return Array.isArray(profile?.World?.PlayerHouses)?profile.World.PlayerHouses:null;
}
function roomsMap(floor){return objMap(floor?.Rooms);}
function wallMap(room){return objMap(room?.WallGridIDs);}
function wallpapersMap(room){return objMap(room?.Wallpapers);}
function offsetsMap(room){return objMap(room?.WallpaperOffsetById);}

function findHouse(profile,{houseItemId,playerHouseIndex}){
  const houses=playerHouses(profile);
  if(!houses)return {error:'PLAYER_HOUSES_REQUIRED'};
  const wanted=int(houseItemId);
  if(wanted===null)return {error:'HOUSE_ITEM_ID_REQUIRED'};
  const suppliedIndex=playerHouseIndex===null||playerHouseIndex===undefined?null:int(playerHouseIndex);
  if(playerHouseIndex!==null&&playerHouseIndex!==undefined&&suppliedIndex===null)return {error:'PLAYER_HOUSE_INDEX_INVALID'};

  if(suppliedIndex!==null){
    if(suppliedIndex<0||suppliedIndex>=houses.length)return {error:'PLAYER_HOUSE_INDEX_OUT_OF_RANGE'};
    const house=houses[suppliedIndex];
    if(!isObj(house)||int(house.HouseItemID)!==wanted)return {error:'PLAYER_HOUSE_INDEX_HOUSE_ITEM_ID_MISMATCH'};
    return {house,index:suppliedIndex,houses};
  }

  const matches=[];
  for(let i=0;i<houses.length;i++){
    if(isObj(houses[i])&&int(houses[i].HouseItemID)===wanted)matches.push(i);
  }
  if(matches.length===0)return {error:'HOUSE_ITEM_ID_NOT_FOUND'};
  if(matches.length!==1)return {error:'HOUSE_ITEM_ID_AMBIGUOUS_CURRENT_SAVE',matches};
  return {house:houses[matches[0]],index:matches[0],houses};
}

export function resolveIndoorRoomFinishV125({source,profile,locator}={}){
  const reasons=validateRoomFinishSource(source);
  const houseItemId=int(locator?.houseItemId);
  const floorIndex=int(locator?.floorIndex);
  const roomSlot=int(locator?.roomSlot);
  if(houseItemId===null)reasons.push('HOUSE_ITEM_ID_REQUIRED');
  if(floorIndex===null||floorIndex<0)reasons.push('FLOOR_INDEX_REQUIRED');
  if(roomSlot===null||!ROOM_SLOT_SET.has(roomSlot))reasons.push('ROOM_SLOT_INVALID');
  if(reasons.length)return baseResult('REJECTED',reasons);

  const h=findHouse(profile,{houseItemId,playerHouseIndex:locator?.playerHouseIndex});
  if(h.error)return baseResult('REJECTED',[h.error],{locator:clone(locator??null)});
  const floors=Array.isArray(h.house?.Floors)?h.house.Floors:null;
  if(!floors)return baseResult('REJECTED',['HOUSE_FLOORS_REQUIRED']);
  if(floorIndex>=floors.length)return baseResult('REJECTED',['FLOOR_INDEX_OUT_OF_RANGE']);
  const floor=floors[floorIndex];
  if(!isObj(floor))return baseResult('REJECTED',['FLOOR_RECORD_INVALID']);
  const rooms=roomsMap(floor);
  if(!rooms)return baseResult('REJECTED',['FLOOR_ROOMS_MAP_REQUIRED']);
  const room=rooms[String(roomSlot)]??rooms[roomSlot];
  if(!isObj(room))return baseResult('REJECTED',['ROOM_SLOT_NOT_PRESENT']);

  const wallGridIds=wallMap(room);
  const wallpapers=wallpapersMap(room);
  const offsets=offsetsMap(room);
  if(!wallGridIds)return baseResult('REJECTED',['ROOM_WALL_GRID_IDS_REQUIRED']);
  if(!wallpapers)return baseResult('REJECTED',['ROOM_WALLPAPERS_MAP_REQUIRED']);
  if(!offsets)return baseResult('REJECTED',['ROOM_WALLPAPER_OFFSETS_MAP_REQUIRED']);

  const normalizedWallGridIds={};
  for(const p of Object.values(WALL_POSITIONS)){
    if(!own(wallGridIds,p))return baseResult('REJECTED',['ROOM_FOUR_WALL_GRID_IDS_REQUIRED']);
    const gid=int(wallGridIds[String(p)]);
    if(gid===null||gid<0)return baseResult('REJECTED',['ROOM_WALL_GRID_ID_INVALID']);
    normalizedWallGridIds[String(p)]=gid;
  }
  if(new Set(Object.values(normalizedWallGridIds)).size!==4)
    return baseResult('REJECTED',['ROOM_WALL_GRID_IDS_NOT_UNIQUE']);

  const floorGridId=int(room.FloorGridID);
  if(floorGridId===null||floorGridId<0)return baseResult('REJECTED',['ROOM_FLOOR_GRID_ID_INVALID']);
  const flooringItemId=int(room.Flooring);
  const ceilingItemId=int(room.Ceiling);
  if(flooringItemId===null||ceilingItemId===null)
    return baseResult('REJECTED',['ROOM_FINISH_ITEM_ID_INVALID']);

  const roomPath=`/World/PlayerHouses/${h.index}/Floors/${floorIndex}/Rooms/${ptr(roomSlot)}`;
  return baseResult('VALID',[],{
    projection:Object.freeze({
      contract:ROOM_FINISH_PROJECTION_CONTRACT,
      semanticIdentity:Object.freeze({houseItemId,floorIndex,roomSlot}),
      currentSaveLocator:Object.freeze({
        playerHouseIndex:h.index,
        floorGridId,
        wallGridIds:Object.freeze(normalizedWallGridIds)
      }),
      roomPath,
      roomPrefabAddress:typeof room.RoomPrefabAddress==='string'?room.RoomPrefabAddress:'',
      flooringItemId,
      wallpapers:Object.freeze(clone(wallpapers)),
      wallpaperOffsetById:Object.freeze(clone(offsets)),
      ceilingItemId,
      ceilingWriteAuthorized:false,
      mapSemantics:Object.freeze({
        wallpapers:'PROTOBUF_MAP_BY_WALL_POSITION_NO_ORDER_IDENTITY',
        wallpaperOffsetById:'PROTOBUF_MAP_BY_WALLPAPER_ITEM_ID_SHARED_BY_ALL_WALLS_USING_THAT_ITEM'
      })
    })
  });
}

export function resolveCurrentWallV125(projection,{wallPosition,wallGridId}={}){
  if(!projection||projection.contract!==ROOM_FINISH_PROJECTION_CONTRACT)
    return baseResult('REJECTED',['ROOM_PROJECTION_REQUIRED']);
  const p=wallPosition===null||wallPosition===undefined?null:int(wallPosition);
  const g=wallGridId===null||wallGridId===undefined?null:int(wallGridId);
  if(p!==null&&!WALL_POSITION_SET.has(p))return baseResult('REJECTED',['WALL_POSITION_INVALID']);
  if(g!==null&&g<0)return baseResult('REJECTED',['WALL_GRID_ID_INVALID']);
  if(p===null&&g===null)return baseResult('REJECTED',['ACTIVE_WALL_IDENTITY_REQUIRED']);

  let resolved=p;
  if(resolved===null){
    const matches=Object.entries(projection.currentSaveLocator.wallGridIds)
      .filter(([,id])=>Number(id)===g)
      .map(([key])=>Number(key));
    if(matches.length!==1)return baseResult('REJECTED',['ACTIVE_WALL_GRID_ID_NOT_UNIQUE_IN_ROOM']);
    resolved=matches[0];
  }
  const expectedGrid=Number(projection.currentSaveLocator.wallGridIds[String(resolved)]);
  if(g!==null&&expectedGrid!==g)
    return baseResult('REJECTED',['ACTIVE_WALL_POSITION_GRID_BINDING_MISMATCH']);

  return baseResult('VALID',[],{
    wall:Object.freeze({
      wallPosition:resolved,
      wallPositionName:WALL_POSITION_NAMES[resolved],
      wallGridId:expectedGrid
    })
  });
}

function validateTrimmingItem(itemEvidence,requiredType){
  const reasons=[];
  const itemId=int(itemEvidence?.itemId);
  if(itemId===null||itemId<=0)reasons.push('TRIMMING_ITEM_ID_REQUIRED');
  if(itemEvidence?.concreteType!=='TrimmingItemData')reasons.push('TRIMMING_ITEM_DATA_REQUIRED');
  const t=itemEvidence?.trimmingItemType;
  const requiredName=requiredType===0?'Wallpaper':'Flooring';
  if(!(t===requiredType||t===requiredName))reasons.push(`${requiredName.toUpperCase()}_TRIMMING_SUBTYPE_REQUIRED`);
  const owned=Number(itemEvidence?.ownedAmount);
  if(!Number.isFinite(owned)||owned<1)reasons.push('OWNED_TRIMMING_REQUIRED');
  return {reasons,itemId,requiredType,ownedAmount:owned};
}

function roomMutationBase(projection,operation,itemId){
  return {
    contract:ROOM_FINISH_MUTATION_SET_CONTRACT,
    semanticOwner:SEMANTIC_OWNER,
    operation,
    target:{
      kind:'PLAYER_HOUSE_ROOM',
      houseItemId:projection.semanticIdentity.houseItemId,
      playerHouseIndex:projection.currentSaveLocator.playerHouseIndex,
      floorIndex:projection.semanticIdentity.floorIndex,
      roomSlot:projection.semanticIdentity.roomSlot
    },
    roomPath:projection.roomPath,
    itemId,
    changes:[],
    allowedSemanticPaths:[],
    gridObjectIdentityPolicy:'PRESERVE_ALL_GRID_OBJECT_IDENTITIES',
    arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
    unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
    serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
    ownershipMutation:false,
    inventoryMutation:false,
    collectionMutation:false,
    entitlementMutation:false,
    storeMutation:false,
    progressionMutation:false,
    ceilingMutation:false,
    persistentWriteAuthorized:false,
    WORLD_PERSISTENT_WRITE_V125:false,
    PERSISTENT_WRITE:false,
    productApplyAuthorized:false,
    directSourceReplacementAuthorized:false
  };
}
function pushReplace(m,path,before,after){
  if(same(before,after))return;
  m.changes.push({path,kind:'REPLACE',before:clone(before),after:clone(after)});
  m.allowedSemanticPaths.push(path);
}
function pushMapSet(m,path,beforeExists,before,after){
  if(beforeExists&&same(before,after))return;
  m.changes.push(beforeExists
    ? {path,kind:'REPLACE',before:clone(before),after:clone(after)}
    : {path,kind:'ADD',after:clone(after)});
  m.allowedSemanticPaths.push(path);
}
function pushMapRemove(m,path,before){
  m.changes.push({path,kind:'REMOVE',before:clone(before)});
  m.allowedSemanticPaths.push(path);
}
function finalizeMutation(m,extra={}){
  m.allowedSemanticPaths=Object.freeze([...m.allowedSemanticPaths].sort());
  m.changes=Object.freeze(m.changes.map(x=>Object.freeze(x)));
  return baseResult('READY',[],{
    mutation:Object.freeze({...m,...extra,changes:m.changes,allowedSemanticPaths:m.allowedSemanticPaths})
  });
}

export function compileRoomFlooringMutationV125({projection,itemEvidence}={}){
  if(!projection||projection.contract!==ROOM_FINISH_PROJECTION_CONTRACT)
    return baseResult('REJECTED',['ROOM_PROJECTION_REQUIRED']);
  const item=validateTrimmingItem(itemEvidence,1);
  if(item.reasons.length)return baseResult('REJECTED',item.reasons);
  if(projection.flooringItemId===item.itemId)
    return baseResult('ALREADY_SET',['FLOORING_ALREADY_SET'],{noOp:true});

  const m=roomMutationBase(projection,ROOM_FINISH_OPERATION.SET_FLOORING,item.itemId);
  pushReplace(m,`${projection.roomPath}/Flooring`,projection.flooringItemId,item.itemId);
  return finalizeMutation(m,{
    nativeTransaction:'ChangePlayerHouseFlooring',
    nativeEligibility:Object.freeze([
      'Item.TryGet<TrimmingItemType> succeeds',
      'TrimmingItemType == Flooring (1)',
      'ProfilePlayer.HasItem(item,1) == true'
    ]),
    nativeInventoryConsumption:false,
    failureSemantics:Object.freeze([
      'InvalidHouse','InvalidFloor','InvalidRoom','InvalidItem','NotEnoughItems','AlreadySet'
    ])
  });
}

export function compileRoomWallpaperMutationV125({
  projection,itemEvidence,scope,currentWall
}={}){
  if(!projection||projection.contract!==ROOM_FINISH_PROJECTION_CONTRACT)
    return baseResult('REJECTED',['ROOM_PROJECTION_REQUIRED']);
  const item=validateTrimmingItem(itemEvidence,0);
  if(item.reasons.length)return baseResult('REJECTED',item.reasons);
  if(!Object.values(WALLPAPER_SCOPE).includes(scope))
    return baseResult('REJECTED',['WALLPAPER_SCOPE_INVALID']);

  let selected;
  let wallBinding=null;
  if(scope===WALLPAPER_SCOPE.CURRENT_WALL){
    const r=resolveCurrentWallV125(projection,currentWall);
    if(r.status!=='VALID')return r;
    selected=[r.wall.wallPosition];
    wallBinding=r.wall;
  }else{
    selected=[0,1,2,3];
  }

  const m=roomMutationBase(projection,ROOM_FINISH_OPERATION.SET_WALLPAPER,item.itemId);
  const wallpapers=clone(projection.wallpapers);
  const offsets=clone(projection.wallpaperOffsetById);
  const displaced=[];

  for(const position of selected){
    const key=String(position);
    const existed=own(wallpapers,key);
    const oldId=existed?int(wallpapers[key]):0;
    if(oldId===null)return baseResult('REJECTED',['ROOM_WALLPAPER_ITEM_ID_INVALID']);
    if(existed&&oldId===item.itemId)continue;

    pushMapSet(m,`${projection.roomPath}/Wallpapers/${key}`,existed,existed?wallpapers[key]:undefined,item.itemId);
    wallpapers[key]=item.itemId;
    displaced.push(oldId);

    const oldStillUsed=Object.values(wallpapers).some(v=>int(v)===oldId);
    const oldOffsetKey=String(oldId);
    if(!oldStillUsed&&own(offsets,oldOffsetKey)){
      pushMapRemove(m,`${projection.roomPath}/WallpaperOffsetById/${ptr(oldOffsetKey)}`,offsets[oldOffsetKey]);
      delete offsets[oldOffsetKey];
    }
  }

  if(!m.changes.length)return baseResult('ALREADY_SET',['WALLPAPER_ALREADY_SET'],{noOp:true});

  return finalizeMutation(m,{
    scope,
    selectedWallPositions:Object.freeze(selected),
    currentWallBinding:wallBinding?Object.freeze(wallBinding):null,
    nativeTransaction:'ChangePlayerHouseWallpaper',
    nativeWallSelection:scope===WALLPAPER_SCOPE.CURRENT_WALL
      ? 'Request.WallPosition oneof present'
      : 'Request.WallPosition oneof absent; native code enumerates all WallPosition values',
    nativeEligibility:Object.freeze([
      'Item.TryGet<TrimmingItemType> succeeds',
      'TrimmingItemType == Wallpaper (0)',
      'ProfilePlayer.HasItem(item,1) == true'
    ]),
    nativeInventoryConsumption:false,
    offsetPolicy:Object.freeze({
      targetWallpaperOffset:'PRESERVE_EXISTING_OR_ABSENT',
      displacedWallpaperOffset:'REMOVE_ONLY_WHEN_DISPLACED_ITEM_ID_IS_NO_LONGER_USED_BY_ANY_ROOM_WALL',
      synthesizedTargetOffset:false,
      standaloneOffsetWriteProductAuthorized:false
    }),
    displacedWallpaperItemIds:Object.freeze(unique(displaced)),
    finalWallpapers:Object.freeze(wallpapers),
    finalWallpaperOffsetById:Object.freeze(offsets),
    failureSemantics:Object.freeze([
      'InvalidHouse','InvalidFloor','InvalidRoom','InvalidItem','NotEnoughItems','AlreadySet'
    ])
  });
}

export function describeWallpaperOffsetSemanticsV125({projection,wallpaperItemId}={}){
  if(!projection||projection.contract!==ROOM_FINISH_PROJECTION_CONTRACT)
    return baseResult('REJECTED',['ROOM_PROJECTION_REQUIRED']);
  const id=int(wallpaperItemId);
  if(id===null||id<=0)return baseResult('REJECTED',['WALLPAPER_ITEM_ID_REQUIRED']);
  const usedBy=Object.entries(projection.wallpapers)
    .filter(([,v])=>int(v)===id)
    .map(([k])=>Number(k))
    .filter(v=>WALL_POSITION_SET.has(v))
    .sort((a,b)=>a-b);
  const key=String(id);
  return baseResult('VALID',[],{
    wallpaperOffset:Object.freeze({
      wallpaperItemId:id,
      usedByWallPositions:Object.freeze(usedBy),
      exists:own(projection.wallpaperOffsetById,key),
      value:own(projection.wallpaperOffsetById,key)?projection.wallpaperOffsetById[key]:null,
      nativeKeying:'ONE_OFFSET_PER_WALLPAPER_ITEM_ID_PER_ROOM',
      nativeDirectTransaction:'ChangePlayerHouseWallpaperOffset',
      nativeDirectWrite:'room.WallpaperOffsetById[WallpaperItemID] = float Offset',
      nativeDirectOwnershipCheckObserved:false,
      productStandaloneWriteAuthorized:false
    })
  });
}

export function roomFinishUpstreamNeedV125(){
  return Object.freeze({
    requestId:ROOM_FINISH_UPSTREAM_REQUEST_ID,
    required:true,
    reason:'01A transaction-foundation v1.0 only accepts GRID_OBJECT and GRID_OBJECT_SET targets and therefore cannot bind or independently re-resolve a World.PlayerHouses room target.',
    minimumExtension:'ADD PLAYER_HOUSE_ROOM TARGET KIND TO EXISTING WRITE_CANDIDATE',
    newGenericWriterRequired:false,
    arbitraryPathWriterRequired:false
  });
}
