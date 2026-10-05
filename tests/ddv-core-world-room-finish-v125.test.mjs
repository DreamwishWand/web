import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  FINISH_KIND,ROOM_FINISH_CONTRACT,ROOM_MUTATION_SCHEMA,ROOM_PROJECTION_SCHEMA,WALL_SCOPE,
  applyRoomFinishDraft,buildRoomFinishTransactionPlanCandidate,classifyRoomFinishDefinition,
  planFlooringMutation,planWallpaperMutation,projectIndoorRoomFinish,resolveCurrentWall,roomFinishMutationAdapter
} from '../src/lib/ddv/core/world/room-finish-v125.js';

const source={platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:'52BD625D9B4E0053'};

function profile(){
  return {
    GameInfo:{Version:624,Opaque:{keep:true}},
    Player:{
      ListInventories:{
        '4':{
          ID:4,CompatibleItemType:'ItemType_Trimming',
          Inventory:{
            '16000001':{Amount:3,Marker:'ItemMarker_None'},
            '16000002':{Amount:2,Marker:'ItemMarker_None'},
            '16000003':{Amount:1,Marker:'ItemMarker_None'},
            '16000004':{Amount:1,Marker:'ItemMarker_None'},
            '16000009':{Amount:1,Marker:'ItemMarker_None'},
            '16100001':{Amount:1,Marker:'ItemMarker_None'},
            '16100009':{Amount:1,Marker:'ItemMarker_None'}
          }
        }
      },
      Collection:{Opaque:{keep:true}}
    },
    World:{
      PlayerHouses:[{
        HouseItemID:20000036,
        Floors:[{
          Rooms:{
            '0':{
              Name:'Main room',FloorGridID:501,
              WallGridIDs:{'0':601,'1':602,'2':603,'3':604},
              RoomPrefabAddress:'Room/Test',Flooring:16100001,
              Wallpapers:{'0':16000001,'1':16000002,'2':16000003,'3':16000004},
              WallpaperOffsetById:{'16000001':0.25,'16000002':-0.125,'16000009':0.5},
              Ceiling:16200001,FutureOpaque:{keep:'exact'}
            }
          },BoughtRooms:{}
        }],
        HideMailbox:false,FutureHouseOpaque:{keep:true}
      }],
      GridCollection:{Grids:{'501':{ID:501,Objects:{},NextGridObjectID:1}}},
      Stores:{Opaque:{keep:true}},OpaqueWorld:{keep:['a','b']}
    },
    Settings:{Language:'ja'}
  };
}
function location(extra={}){return {houseItemId:20000036,floorIndex:0,roomSlot:0,playerHouseIndex:0,...extra};}
function projection(root=profile(),loc=location()){return projectIndoorRoomFinish({source,profile:root,location:loc});}
function flooringDef(root=profile(),extra={}){
  return classifyRoomFinishDefinition({profile:root,kind:FINISH_KIND.FLOORING,definition:{
    itemID:16100009,concreteType:'TrimmingItemData',trimmingType:'Flooring',
    isUnavailableForGenerator:false,isSyncOnlineItem:false,...extra
  }});
}
function wallpaperDef(root=profile(),extra={}){
  return classifyRoomFinishDefinition({profile:root,kind:FINISH_KIND.WALLPAPER,definition:{
    itemID:16000009,concreteType:'TrimmingItemData',trimmingType:'Wallpaper',
    isUnavailableForGenerator:false,isSyncOnlineItem:false,...extra
  }});
}

test('Room Finish projection freezes semantic room identity and wall/offset map semantics',()=>{
  const p=projection();
  assert.equal(p.contract,ROOM_FINISH_CONTRACT);assert.equal(p.schema,ROOM_PROJECTION_SCHEMA);assert.equal(p.status,'READY');
  assert.deepEqual(p.semanticLocation,{houseItemId:20000036,floorIndex:0,roomSlot:0});
  assert.deepEqual(p.currentSaveLocator,{playerHouseIndex:0,floorGridId:501,wallGridIds:{'0':601,'1':602,'2':603,'3':604}});
  assert.deepEqual(p.roomState.wallpapers,{'0':16000001,'1':16000002,'2':16000003,'3':16000004});
  assert.equal(p.wallMapSemantics,'MAP_BY_HOUSE_WALL_POSITION_NOT_ORDERED_SEQUENCE');
  assert.equal(p.wallpaperOffsetKeySemantics,'MAP_BY_WALLPAPER_ITEM_ID_NOT_WALL_POSITION');
  assert.equal(p.ceilingWriteAuthorized,false);
});

test('active wall GridID reverse-resolves exact Current Wall and fails closed on ambiguity/miss',()=>{
  const p=projection();
  const wall=resolveCurrentWall({projection:p,activeWallGridId:603});
  assert.equal(wall.status,'READY');assert.equal(wall.wallPosition,2);assert.equal(wall.currentWallpaperItemId,16000003);
  assert.ok(resolveCurrentWall({projection:p,activeWallGridId:999}).reasonCodes.includes('ACTIVE_WALL_GRID_NOT_IN_ROOM'));
  const root=profile();
  root.World.PlayerHouses[0].Floors[0].Rooms['0'].WallGridIDs['3']=603;
  const ambiguous=resolveCurrentWall({projection:projection(root),activeWallGridId:603});
  assert.ok(ambiguous.reasonCodes.includes('ACTIVE_WALL_GRID_AMBIGUOUS'));
});

test('definition eligibility mirrors native subtype + owned Trimming gate and does not grant/unlock',()=>{
  const root=profile(),f=flooringDef(root),w=wallpaperDef(root);
  assert.equal(f.status,'READY');assert.equal(w.status,'READY');
  assert.equal(w.ownership.listInventoryMapKey,'4');assert.equal(w.ownership.amount,1);
  assert.equal(w.inventoryPolicy,'OWNED_REQUIRED_PRESERVE_EXACT_NO_DEBIT_NO_GRANT');
  assert.equal(wallpaperDef(root,{concreteType:'FurnitureItemData'}).status,'REJECTED');
  assert.equal(wallpaperDef(root,{trimmingType:'Flooring'}).status,'REJECTED');
  const unowned=profile();delete unowned.Player.ListInventories['4'].Inventory['16000009'];
  const u=wallpaperDef(unowned);assert.equal(u.status,'REJECTED');assert.ok(u.reasonCodes.includes('NATIVE_NOT_ENOUGH_ITEMS'));
  const syncOwned=wallpaperDef(root,{isSyncOnlineItem:true,isUnavailableForGenerator:true});
  assert.equal(syncOwned.status,'READY');assert.equal(syncOwned.isSyncOnlineItem,true);assert.equal(syncOwned.isUnavailableForGenerator,true);
});

test('Flooring changes one scalar and preserves inventory/room companions exactly',()=>{
  const root=profile(),p=projection(root),d=flooringDef(root),m=planFlooringMutation({projection:p,definition:d});
  assert.equal(m.schema,ROOM_MUTATION_SCHEMA);assert.equal(m.status,'READY');assert.equal(m.operation,'SET_FLOORING');
  assert.deepEqual(m.changes,[{kind:'SET',path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Flooring',before:16100001,after:16100009}]);
  const out=applyRoomFinishDraft(root,m),room=out.World.PlayerHouses[0].Floors[0].Rooms['0'],before=root.World.PlayerHouses[0].Floors[0].Rooms['0'];
  assert.equal(room.Flooring,16100009);assert.deepEqual(room.Wallpapers,before.Wallpapers);assert.deepEqual(room.WallpaperOffsetById,before.WallpaperOffsetById);
  assert.equal(room.Ceiling,before.Ceiling);assert.deepEqual(out.Player,root.Player);
});

test('CURRENT_WALL removes old wallpaper offset only when old wallpaper becomes unreferenced',()=>{
  const root=profile(),p=projection(root),d=wallpaperDef(root);
  const m=planWallpaperMutation({projection:p,definition:d,scope:WALL_SCOPE.CURRENT_WALL,activeWallGridId:602});
  assert.equal(m.status,'READY');assert.equal(m.wallpaperScope,'CURRENT_WALL');
  assert.deepEqual(m.changes,[
    {kind:'SET',path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Wallpapers/1',wallPosition:1,wallGridId:602,before:16000002,after:16000009},
    {kind:'REMOVE',path:'/World/PlayerHouses/0/Floors/0/Rooms/0/WallpaperOffsetById/16000002',wallpaperItemId:16000002,reason:'NATIVE_OLD_WALLPAPER_NO_LONGER_REFERENCED',before:-0.125}
  ]);
  const out=applyRoomFinishDraft(root,m).World.PlayerHouses[0].Floors[0].Rooms['0'];
  assert.equal(out.Wallpapers['1'],16000009);assert.equal(Object.hasOwn(out.WallpaperOffsetById,'16000002'),false);
  assert.equal(out.WallpaperOffsetById['16000001'],0.25);assert.equal(out.WallpaperOffsetById['16000009'],0.5);
});

test('CURRENT_WALL preserves old offset while another wall still references old wallpaper',()=>{
  const root=profile(),room=root.World.PlayerHouses[0].Floors[0].Rooms['0'];room.Wallpapers['2']=16000002;
  const m=planWallpaperMutation({projection:projection(root),definition:wallpaperDef(root),scope:WALL_SCOPE.CURRENT_WALL,activeWallGridId:602});
  assert.equal(m.status,'READY');assert.deepEqual(m.wallpaperOffsetCleanupItemIds,[]);assert.equal(m.changes.length,1);
  const out=applyRoomFinishDraft(root,m).World.PlayerHouses[0].Floors[0].Rooms['0'];assert.equal(out.WallpaperOffsetById['16000002'],-0.125);
});

test('CURRENT_WALL does not create new wallpaper offset when none exists',()=>{
  const root=profile(),room=root.World.PlayerHouses[0].Floors[0].Rooms['0'];delete room.WallpaperOffsetById['16000009'];
  const m=planWallpaperMutation({projection:projection(root),definition:wallpaperDef(root),scope:WALL_SCOPE.CURRENT_WALL,activeWallGridId:603});
  const out=applyRoomFinishDraft(root,m).World.PlayerHouses[0].Floors[0].Rooms['0'];assert.equal(Object.hasOwn(out.WallpaperOffsetById,'16000009'),false);
});

test('ALL_WALLS is atomic and removes only offset entries for eliminated old wallpaper IDs',()=>{
  const root=profile(),p=projection(root),d=wallpaperDef(root),m=planWallpaperMutation({projection:p,definition:d,scope:WALL_SCOPE.ALL_WALLS});
  assert.equal(m.status,'READY');assert.equal(m.wallpaperScope,'ALL_WALLS');assert.deepEqual(m.changes.filter(x=>x.kind==='SET').map(x=>x.wallPosition),[0,1,2,3]);
  assert.deepEqual(m.wallpaperOffsetCleanupItemIds,[16000001,16000002]);
  const out=applyRoomFinishDraft(root,m).World.PlayerHouses[0].Floors[0].Rooms['0'];
  assert.deepEqual(out.Wallpapers,{'0':16000009,'1':16000009,'2':16000009,'3':16000009});assert.deepEqual(out.WallpaperOffsetById,{'16000009':0.5});
});

test('ALL_WALLS may have fewer changed wallpaper leaves but exact four-wall target identity',()=>{
  const root=profile();root.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers['2']=16000009;
  const m=planWallpaperMutation({projection:projection(root),definition:wallpaperDef(root),scope:WALL_SCOPE.ALL_WALLS});
  assert.deepEqual(m.changes.filter(x=>x.kind==='SET').map(x=>x.wallPosition),[0,1,3]);
  const broken=profile();delete broken.World.PlayerHouses[0].Floors[0].Rooms['0'].WallGridIDs['3'];
  const bp=projection(broken);assert.equal(bp.status,'REJECTED');assert.ok(bp.reasonCodes.includes('ROOM_WALL_POSITION_SET_UNSUPPORTED'));
});

test('semantic locator fails closed on HouseItemID ambiguity unless current-save index disambiguates',()=>{
  const root=profile();root.World.PlayerHouses.push(structuredClone(root.World.PlayerHouses[0]));
  const ambiguous=projectIndoorRoomFinish({source,profile:root,location:{houseItemId:20000036,floorIndex:0,roomSlot:0}});
  assert.ok(ambiguous.reasonCodes.includes('HOUSE_ITEM_ID_AMBIGUOUS_REQUIRES_CURRENT_SAVE_INDEX'));
  const resolved=projectIndoorRoomFinish({source,profile:root,location:{houseItemId:20000036,floorIndex:0,roomSlot:0,playerHouseIndex:1}});
  assert.equal(resolved.status,'READY');assert.equal(resolved.currentSaveLocator.playerHouseIndex,1);
});

test('draft application fails closed on Room locator or ownership drift',()=>{
  const root=profile(),m=planWallpaperMutation({projection:projection(root),definition:wallpaperDef(root),scope:WALL_SCOPE.CURRENT_WALL,activeWallGridId:601});
  const locatorDrift=profile();locatorDrift.World.PlayerHouses[0].Floors[0].Rooms['0'].WallGridIDs['0']=999;
  assert.throws(()=>applyRoomFinishDraft(locatorDrift,m),/ROOM_FINISH_WALL_GRID_IDENTITY_MISMATCH/);
  const ownershipDrift=profile();ownershipDrift.Player.ListInventories['4'].Inventory['16000009'].Amount=2;
  assert.throws(()=>applyRoomFinishDraft(ownershipDrift,m),/ROOM_FINISH_TRIMMING_OWNERSHIP_DRIFT/);
});

test('bounded 01A request includes native stale-offset deletion envelope but no generic writer',async()=>{
  const contract=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25/room-finish-semantics-v125.json',import.meta.url),'utf8'));
  const request=JSON.parse(await readFile(new URL('../static/ddv/core/world/v1.25/room-finish-01a-extension-request-v125.json',import.meta.url),'utf8'));
  assert.equal(contract.saveLayerBinding.existingFoundationCanRepresentDirectly,false);assert.equal(contract.saveLayerBinding.newGenericCapabilityRequired,false);
  assert.equal(contract.serializedMutationSemantics.wallpaperOffsetById.policy,'NATIVE_STALE_OLD_ITEM_CLEANUP_ONLY');assert.equal(contract.definitionEligibility.nativeOwnershipRequired,true);
  assert.equal(request.minimumAdditiveExtension.capability,'WRITE_CANDIDATE');assert.equal(request.minimumAdditiveExtension.targetKind,'PLAYER_HOUSE_ROOM_SURFACE');
  assert.ok(request.minimumAdditiveExtension.allowedPathEnvelope.some(x=>x.includes('WallpaperOffsetById')));
  assert.ok(request.explicitlyNotRequested.includes('generic PlayerHouse writer'));assert.ok(request.explicitlyNotRequested.includes('arbitrary WallpaperOffset value edit'));
  assert.equal(request.hardFlags.PERSISTENT_WRITE,false);
});

test('proposed 01A binding carries native offset cleanup as declared REMOVE and freezes ownership',()=>{
  const root=profile(),m=planWallpaperMutation({projection:projection(root),definition:wallpaperDef(root),scope:WALL_SCOPE.CURRENT_WALL,activeWallGridId:602});
  const plan=buildRoomFinishTransactionPlanCandidate({mutation:m,transactionInput:{platform:'switch',gameVersion:'1.25.0',profileGameInfoVersion:624,originalFileLength:123,originalSha256:'0'.repeat(64),codecContract:'p1g-v0',targetBuild:{platform:'switch',kind:'switch-bid',value:'52BD625D9B4E0053'}},planId:'room-current-wall'});
  assert.equal(plan.capabilityRequired,'WRITE_CANDIDATE');assert.equal(plan.target.kind,'PLAYER_HOUSE_ROOM_SURFACE');assert.equal(plan.operation.kind,'ROOM_SET_WALLPAPER_CURRENT_WALL');
  assert.deepEqual(plan.allowedChanges.map(x=>x.path),m.changes.map(x=>x.path));assert.equal(plan.intent.wallpaperOffsetEdit,false);assert.equal(plan.intent.wallpaperOffsetCleanup,true);
  assert.ok(plan.preconditions.some(x=>x.path==='/Player/ListInventories/4/Inventory/16000009/Amount'&&x.value===1));
  assert.ok(plan.postconditions.some(x=>x.path.endsWith('/WallpaperOffsetById/16000002')&&x.operator==='NOT_EXISTS'));
  const draft=structuredClone(root);roomFinishMutationAdapter.apply(draft,structuredClone(plan.intent),plan);
  const out=draft.World.PlayerHouses[0].Floors[0].Rooms['0'];assert.equal(out.Wallpapers['1'],16000009);assert.equal(Object.hasOwn(out.WallpaperOffsetById,'16000002'),false);assert.deepEqual(draft.Player,root.Player);
});
