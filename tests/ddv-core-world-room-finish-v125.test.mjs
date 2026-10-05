import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  FINISH_KIND,
  ROOM_FINISH_CONTRACT,
  ROOM_MUTATION_SCHEMA,
  ROOM_PROJECTION_SCHEMA,
  WALL_SCOPE,
  applyRoomFinishDraft,
  buildRoomFinishTransactionPlanCandidate,
  classifyRoomFinishDefinition,
  planFlooringMutation,
  planWallpaperMutation,
  projectIndoorRoomFinish,
  resolveCurrentWall,
  roomFinishMutationAdapter
} from '../src/lib/ddv/core/world/room-finish-v125.js';

const source={
  platform:'Nintendo Switch',
  gameVersion:'1.25.0',
  profileSchemaVersion:624,
  buildIdentity:'52BD625D9B4E0053'
};

function profile(){
  return {
    GameInfo:{Version:624,Opaque:{keep:true}},
    Player:{
      Trimming:{Data:{'16000001':{Amount:3,Marker:1}}},
      Collection:{Opaque:{keep:true}}
    },
    World:{
      PlayerHouses:[
        {
          HouseItemID:20000036,
          Floors:[
            {
              Rooms:{
                '0':{
                  Name:'Main room',
                  FloorGridID:501,
                  WallGridIDs:{'0':601,'1':602,'2':603,'3':604},
                  RoomPrefabAddress:'Room/Test',
                  Flooring:16100001,
                  Wallpapers:{'0':16000001,'1':16000002,'2':16000003,'3':16000004},
                  WallpaperOffsetById:{'16000001':0.25,'16000002':-0.125},
                  Ceiling:16200001,
                  FutureOpaque:{keep:'exact'}
                }
              },
              BoughtRooms:{}
            }
          ],
          HideMailbox:false,
          FutureHouseOpaque:{keep:true}
        }
      ],
      GridCollection:{Grids:{'501':{ID:501,Objects:{},NextGridObjectID:1}}},
      Stores:{Opaque:{keep:true}},
      OpaqueWorld:{keep:['a','b']}
    },
    Settings:{Language:'ja'}
  };
}
function location(extra={}){
  return {houseItemId:20000036,floorIndex:0,roomSlot:0,playerHouseIndex:0,...extra};
}
function projection(root=profile(),loc=location()){
  return projectIndoorRoomFinish({source,profile:root,location:loc});
}
function flooringDef(extra={}){
  return classifyRoomFinishDefinition({
    kind:FINISH_KIND.FLOORING,
    definition:{
      itemID:16100009,
      concreteType:'TrimmingItemData',
      trimmingType:'Flooring',
      isUnavailableForGenerator:false,
      isSyncOnlineItem:false,
      ...extra
    }
  });
}
function wallpaperDef(extra={}){
  return classifyRoomFinishDefinition({
    kind:FINISH_KIND.WALLPAPER,
    definition:{
      itemID:16000009,
      concreteType:'TrimmingItemData',
      trimmingType:'Wallpaper',
      isUnavailableForGenerator:false,
      isSyncOnlineItem:false,
      ...extra
    }
  });
}

test('Room Finish projection uses semantic house/floor/slot identity and map-key wall semantics',()=>{
  const p=projection();
  assert.equal(p.contract,ROOM_FINISH_CONTRACT);
  assert.equal(p.schema,ROOM_PROJECTION_SCHEMA);
  assert.equal(p.status,'READY');
  assert.deepEqual(p.semanticLocation,{houseItemId:20000036,floorIndex:0,roomSlot:0});
  assert.equal(p.currentSaveLocator.playerHouseIndex,0);
  assert.equal(p.currentSaveLocator.floorGridId,501);
  assert.deepEqual(p.currentSaveLocator.wallGridIds,{'0':601,'1':602,'2':603,'3':604});
  assert.deepEqual(p.roomState.wallpapers,{'0':16000001,'1':16000002,'2':16000003,'3':16000004});
  assert.deepEqual(p.roomState.wallpaperOffsetById,{'16000001':0.25,'16000002':-0.125});
  assert.equal(p.wallMapSemantics,'MAP_BY_HOUSE_WALL_POSITION_NOT_ORDERED_SEQUENCE');
  assert.equal(p.wallpaperOffsetKeySemantics,'MAP_BY_WALLPAPER_ITEM_ID_NOT_WALL_POSITION');
  assert.equal(p.ceilingWriteAuthorized,false);
});

test('active wall GridID resolves exact current wall position and wallpaper identity',()=>{
  const p=projection();
  const wall=resolveCurrentWall({projection:p,activeWallGridId:603});
  assert.equal(wall.status,'READY');
  assert.equal(wall.wallPosition,2);
  assert.equal(wall.wallGridId,603);
  assert.equal(wall.currentWallpaperItemId,16000003);

  const missing=resolveCurrentWall({projection:p,activeWallGridId:999});
  assert.equal(missing.status,'REJECTED');
  assert.ok(missing.reasonCodes.includes('ACTIVE_WALL_GRID_NOT_IN_ROOM'));
});

test('Flooring semantic mutation changes only Room.Flooring and preserves all companion state',()=>{
  const root=profile(),p=projection(root),d=flooringDef();
  assert.equal(d.status,'READY');
  const m=planFlooringMutation({projection:p,definition:d});
  assert.equal(m.schema,ROOM_MUTATION_SCHEMA);
  assert.equal(m.status,'READY');
  assert.equal(m.operation,'SET_FLOORING');
  assert.deepEqual(m.changes,[{
    path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Flooring',
    before:16100001,
    after:16100009
  }]);

  const out=applyRoomFinishDraft(root,m);
  assert.equal(out.World.PlayerHouses[0].Floors[0].Rooms['0'].Flooring,16100009);
  assert.deepEqual(out.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers,root.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers);
  assert.deepEqual(out.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById,root.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById);
  assert.equal(out.World.PlayerHouses[0].Floors[0].Rooms['0'].Ceiling,16200001);
  assert.deepEqual(out.Player,root.Player);
  assert.deepEqual(out.World.Stores,root.World.Stores);
  assert.deepEqual(out.World.OpaqueWorld,root.World.OpaqueWorld);
});

test('CURRENT_WALL mutation changes exactly the reverse-resolved Wallpapers map key',()=>{
  const root=profile(),p=projection(root),d=wallpaperDef();
  const m=planWallpaperMutation({
    projection:p,definition:d,scope:WALL_SCOPE.CURRENT_WALL,activeWallGridId:602
  });
  assert.equal(m.status,'READY');
  assert.equal(m.wallpaperScope,'CURRENT_WALL');
  assert.deepEqual(m.activeWall,{wallPosition:1,wallGridId:602});
  assert.deepEqual(m.changes,[{
    path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Wallpapers/1',
    wallPosition:1,
    wallGridId:602,
    before:16000002,
    after:16000009
  }]);

  const out=applyRoomFinishDraft(root,m);
  assert.equal(out.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers['1'],16000009);
  assert.equal(out.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers['0'],16000001);
  assert.equal(out.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers['2'],16000003);
  assert.equal(out.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers['3'],16000004);
  assert.deepEqual(out.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById,root.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById);
});

test('ALL_WALLS is one atomic semantic operation over exact wall positions 0..3',()=>{
  const root=profile(),p=projection(root),d=wallpaperDef();
  const m=planWallpaperMutation({
    projection:p,definition:d,scope:WALL_SCOPE.ALL_WALLS
  });
  assert.equal(m.status,'READY');
  assert.equal(m.wallpaperScope,'ALL_WALLS');
  assert.deepEqual(m.changes.map(x=>x.wallPosition),[0,1,2,3]);
  const out=applyRoomFinishDraft(root,m);
  assert.deepEqual(
    out.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers,
    {'0':16000009,'1':16000009,'2':16000009,'3':16000009}
  );
  assert.deepEqual(out.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById,root.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById);
});

test('ALL_WALLS may have fewer changed leaves but still requires exact four-wall target identity',()=>{
  const root=profile();
  root.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers['2']=16000009;
  const p=projection(root),d=wallpaperDef();
  const m=planWallpaperMutation({projection:p,definition:d,scope:WALL_SCOPE.ALL_WALLS});
  assert.equal(m.status,'READY');
  assert.deepEqual(m.changes.map(x=>x.wallPosition),[0,1,3]);

  const broken=profile();
  delete broken.World.PlayerHouses[0].Floors[0].Rooms['0'].WallGridIDs['3'];
  const bp=projection(broken);
  assert.equal(bp.status,'REJECTED');
  assert.ok(bp.reasonCodes.includes('ROOM_WALL_POSITION_SET_UNSUPPORTED'));
});

test('definition eligibility is exact TrimmingItemData subtype and generator/sync boundary',()=>{
  assert.equal(flooringDef().status,'READY');
  assert.equal(wallpaperDef().status,'READY');

  for(const bad of [
    wallpaperDef({concreteType:'FurnitureItemData'}),
    wallpaperDef({trimmingType:'Flooring'}),
    wallpaperDef({isUnavailableForGenerator:true}),
    wallpaperDef({isSyncOnlineItem:true})
  ]) assert.equal(bad.status,'REJECTED');
});

test('semantic locator fails closed on HouseItemID ambiguity unless current-save index disambiguates',()=>{
  const root=profile();
  root.World.PlayerHouses.push(structuredClone(root.World.PlayerHouses[0]));
  const ambiguous=projectIndoorRoomFinish({
    source,profile:root,location:{houseItemId:20000036,floorIndex:0,roomSlot:0}
  });
  assert.equal(ambiguous.status,'REJECTED');
  assert.ok(ambiguous.reasonCodes.includes('HOUSE_ITEM_ID_AMBIGUOUS_REQUIRES_CURRENT_SAVE_INDEX'));

  const resolved=projectIndoorRoomFinish({
    source,profile:root,location:{houseItemId:20000036,floorIndex:0,roomSlot:0,playerHouseIndex:1}
  });
  assert.equal(resolved.status,'READY');
  assert.equal(resolved.currentSaveLocator.playerHouseIndex,1);
});

test('draft application fails closed when current-save Room identity drifts',()=>{
  const root=profile(),p=projection(root),d=wallpaperDef();
  const m=planWallpaperMutation({
    projection:p,definition:d,scope:WALL_SCOPE.CURRENT_WALL,activeWallGridId:601
  });
  const drift=profile();
  drift.World.PlayerHouses[0].Floors[0].Rooms['0'].WallGridIDs['0']=999;
  assert.throws(()=>applyRoomFinishDraft(drift,m),/ROOM_FINISH_WALL_GRID_IDENTITY_MISMATCH/);
});

test('machine contract returns minimal bounded 01A target extension and keeps hard flags false',async()=>{
  const contract=JSON.parse(await readFile(
    new URL('../static/ddv/core/world/v1.25/room-finish-semantics-v125.json',import.meta.url),'utf8'
  ));
  const request=JSON.parse(await readFile(
    new URL('../static/ddv/core/world/v1.25/room-finish-01a-extension-request-v125.json',import.meta.url),'utf8'
  ));
  assert.equal(contract.saveLayerBinding.existingFoundationCanRepresentDirectly,false);
  assert.equal(contract.saveLayerBinding.newGenericCapabilityRequired,false);
  assert.equal(contract.saveLayerBinding.requestedTargetKind,'PLAYER_HOUSE_ROOM_SURFACE');
  assert.equal(contract.serializedMutationSemantics.wallpaperOffsetById.policy,'PRESERVE_EXACT');
  assert.equal(contract.hardFlags.persistentWriteAuthorized,false);
  assert.equal(request.minimumAdditiveExtension.capability,'WRITE_CANDIDATE');
  assert.equal(request.minimumAdditiveExtension.newCapabilityRequired,false);
  assert.equal(request.minimumAdditiveExtension.targetKind,'PLAYER_HOUSE_ROOM_SURFACE');
  assert.ok(request.explicitlyNotRequested.includes('arbitrary JSON patch'));
  assert.ok(request.explicitlyNotRequested.includes('generic PlayerHouse writer'));
  assert.equal(request.hardFlags.PERSISTENT_WRITE,false);
});


test('proposed 01A binding is a bounded WRITE_CANDIDATE target and adapter mutates only frozen leaves',()=>{
  const root=profile(),p=projection(root),d=wallpaperDef();
  const m=planWallpaperMutation({
    projection:p,definition:d,scope:WALL_SCOPE.CURRENT_WALL,activeWallGridId:604
  });
  const plan=buildRoomFinishTransactionPlanCandidate({
    mutation:m,
    transactionInput:{
      platform:'switch',
      gameVersion:'1.25.0',
      profileGameInfoVersion:624,
      originalFileLength:123,
      originalSha256:'0'.repeat(64),
      codecContract:'p1g-v0',
      targetBuild:{platform:'switch',kind:'switch-bid',value:'52BD625D9B4E0053'}
    },
    planId:'room-current-wall'
  });
  assert.equal(plan.capabilityRequired,'WRITE_CANDIDATE');
  assert.equal(plan.target.kind,'PLAYER_HOUSE_ROOM_SURFACE');
  assert.equal(plan.operation.kind,'ROOM_SET_WALLPAPER_CURRENT_WALL');
  assert.deepEqual(plan.allowedChanges,[{
    path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Wallpapers/3',
    classification:'INTENTIONAL'
  }]);
  assert.equal(plan.intent.wallpaperOffsetMutation,false);
  assert.equal(plan.intent.trimmingInventoryMutation,false);

  const draft=structuredClone(root);
  roomFinishMutationAdapter.apply(draft,structuredClone(plan.intent),plan);
  assert.equal(draft.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers['3'],16000009);
  assert.deepEqual(draft.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById,root.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById);
  assert.deepEqual(draft.Player,root.Player);
});
