import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROOM_FINISH_MUTATION_SET_CONTRACT,
  ROOM_FINISH_OPERATION,
  ROOM_FINISH_PROJECTION_CONTRACT,
  ROOM_FINISH_UPSTREAM_REQUEST_ID,
  WALLPAPER_SCOPE,
  compileRoomFlooringMutationV125,
  compileRoomWallpaperMutationV125,
  describeWallpaperOffsetSemanticsV125,
  resolveCurrentWallV125,
  resolveIndoorRoomFinishV125,
  roomFinishUpstreamNeedV125
} from '../src/lib/ddv/core/world/room-finish-v125.js';

const source={
  platform:'Nintendo Switch',
  gameVersion:'1.25.0',
  profileSchemaVersion:624,
  buildIdentity:'52BD625D9B4E0053'
};

function profile(){
  return {
    GameInfo:{Version:624,Keep:'exact'},
    Player:{
      Catalog:{Items:{'7001':1,'7100':1}},
      Collection:{Keep:'exact'},
      Entitlements:{Keep:'exact'}
    },
    World:{
      PlayerHouses:[
        {
          HouseItemID:20500005,
          HideMailbox:false,
          Floors:[
            {
              BoughtRooms:{},
              Rooms:{
                '0':{
                  Name:'Main',
                  FloorGridID:900,
                  WallGridIDs:{'0':901,'1':902,'2':903,'3':904},
                  RoomPrefabAddress:'Room/Main',
                  Flooring:7000,
                  Wallpapers:{'0':7100,'1':7100,'2':7101,'3':7102},
                  WallpaperOffsetById:{'7100':0.25,'7101':0.5,'7102':0.75,'7200':0.125},
                  Ceiling:7300,
                  OpaqueRoom:{keep:true}
                }
              }
            }
          ],
          OpaqueHouse:{keep:true}
        }
      ],
      GridCollection:{
        Grids:{
          '900':{ID:900,Objects:{}},
          '901':{ID:901,Objects:{}},
          '902':{ID:902,Objects:{}},
          '903':{ID:903,Objects:{}},
          '904':{ID:904,Objects:{}}
        }
      },
      Stores:[{Keep:'exact'}],
      OpaqueWorld:{keep:true}
    }
  };
}
function locator(extra={}){
  return {houseItemId:20500005,playerHouseIndex:0,floorIndex:0,roomSlot:0,...extra};
}
function projection(root=profile(),loc=locator()){
  const r=resolveIndoorRoomFinishV125({source,profile:root,locator:loc});
  assert.equal(r.status,'VALID',JSON.stringify(r));
  assert.equal(r.projection.contract,ROOM_FINISH_PROJECTION_CONTRACT);
  return r.projection;
}
function item(itemId,trimmingItemType,ownedAmount=1){
  return {itemId,concreteType:'TrimmingItemData',trimmingItemType,ownedAmount};
}

test('room projection binds durable identity to current PlayerHouse index and exposes finish read state',()=>{
  const p=projection();
  assert.deepEqual(p.semanticIdentity,{houseItemId:20500005,floorIndex:0,roomSlot:0});
  assert.equal(p.currentSaveLocator.playerHouseIndex,0);
  assert.equal(p.currentSaveLocator.floorGridId,900);
  assert.deepEqual(p.currentSaveLocator.wallGridIds,{'0':901,'1':902,'2':903,'3':904});
  assert.equal(p.flooringItemId,7000);
  assert.deepEqual(p.wallpapers,{'0':7100,'1':7100,'2':7101,'3':7102});
  assert.deepEqual(p.wallpaperOffsetById,{'7100':0.25,'7101':0.5,'7102':0.75,'7200':0.125});
  assert.equal(p.ceilingItemId,7300);
  assert.equal(p.ceilingWriteAuthorized,false);
  assert.equal(p.roomPath,'/World/PlayerHouses/0/Floors/0/Rooms/0');
});

test('room resolution fails closed when current PlayerHouse index does not bind HouseItemID',()=>{
  const r=resolveIndoorRoomFinishV125({
    source,profile:profile(),locator:locator({houseItemId:20500999})
  });
  assert.equal(r.status,'REJECTED');
  assert.ok(r.reasonCodes.includes('PLAYER_HOUSE_INDEX_HOUSE_ITEM_ID_MISMATCH'));
});

test('HouseItemID-only resolution requires exactly one current-save match',()=>{
  const root=profile();
  let r=resolveIndoorRoomFinishV125({
    source,profile:root,locator:{houseItemId:20500005,floorIndex:0,roomSlot:0}
  });
  assert.equal(r.status,'VALID');
  root.World.PlayerHouses.push(structuredClone(root.World.PlayerHouses[0]));
  r=resolveIndoorRoomFinishV125({
    source,profile:root,locator:{houseItemId:20500005,floorIndex:0,roomSlot:0}
  });
  assert.equal(r.status,'REJECTED');
  assert.ok(r.reasonCodes.includes('HOUSE_ITEM_ID_AMBIGUOUS_CURRENT_SAVE'));
});

test('Current Wall semantic identity is WallPosition with current WallGridID consistency check',()=>{
  const p=projection();
  let r=resolveCurrentWallV125(p,{wallPosition:2,wallGridId:903});
  assert.equal(r.status,'VALID');
  assert.deepEqual(r.wall,{wallPosition:2,wallPositionName:'Bottom',wallGridId:903});

  r=resolveCurrentWallV125(p,{wallGridId:904});
  assert.equal(r.status,'VALID');
  assert.equal(r.wall.wallPosition,3);

  r=resolveCurrentWallV125(p,{wallPosition:1,wallGridId:904});
  assert.equal(r.status,'REJECTED');
  assert.ok(r.reasonCodes.includes('ACTIVE_WALL_POSITION_GRID_BINDING_MISMATCH'));
});

test('Flooring compiles to one room scalar replace and never mutates ownership/inventory',()=>{
  const p=projection();
  const r=compileRoomFlooringMutationV125({
    projection:p,itemEvidence:item(7001,'Flooring',1)
  });
  assert.equal(r.status,'READY');
  assert.equal(r.mutation.contract,ROOM_FINISH_MUTATION_SET_CONTRACT);
  assert.equal(r.mutation.operation,ROOM_FINISH_OPERATION.SET_FLOORING);
  assert.deepEqual(r.mutation.changes,[{
    path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Flooring',
    kind:'REPLACE',
    before:7000,
    after:7001
  }]);
  assert.equal(r.mutation.inventoryMutation,false);
  assert.equal(r.mutation.ownershipMutation,false);
  assert.equal(r.mutation.ceilingMutation,false);
  assert.equal(r.mutation.nativeInventoryConsumption,false);
  assert.equal(r.mutation.persistentWriteAuthorized,false);
});

test('Flooring requires native Flooring subtype and owned trimming',()=>{
  let r=compileRoomFlooringMutationV125({
    projection:projection(),itemEvidence:item(7001,'Wallpaper',1)
  });
  assert.equal(r.status,'REJECTED');
  assert.ok(r.reasonCodes.includes('FLOORING_TRIMMING_SUBTYPE_REQUIRED'));

  r=compileRoomFlooringMutationV125({
    projection:projection(),itemEvidence:item(7001,'Flooring',0)
  });
  assert.equal(r.status,'REJECTED');
  assert.ok(r.reasonCodes.includes('OWNED_TRIMMING_REQUIRED'));
});

test('Current Wall wallpaper changes only selected key and preserves displaced offset while old wallpaper remains used',()=>{
  const p=projection();
  const r=compileRoomWallpaperMutationV125({
    projection:p,
    itemEvidence:item(7200,'Wallpaper',1),
    scope:WALLPAPER_SCOPE.CURRENT_WALL,
    currentWall:{wallPosition:0,wallGridId:901}
  });
  assert.equal(r.status,'READY');
  assert.deepEqual(r.mutation.selectedWallPositions,[0]);
  assert.deepEqual(r.mutation.changes,[{
    path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Wallpapers/0',
    kind:'REPLACE',
    before:7100,
    after:7200
  }]);
  assert.equal(r.mutation.finalWallpapers['1'],7100);
  assert.equal(r.mutation.finalWallpaperOffsetById['7100'],0.25);
  assert.equal(r.mutation.finalWallpaperOffsetById['7200'],0.125);
});

test('Current Wall wallpaper removes displaced offset only when the old ItemID has no remaining wall use',()=>{
  const p=projection();
  const r=compileRoomWallpaperMutationV125({
    projection:p,
    itemEvidence:item(7200,0,1),
    scope:WALLPAPER_SCOPE.CURRENT_WALL,
    currentWall:{wallPosition:2,wallGridId:903}
  });
  assert.equal(r.status,'READY');
  assert.deepEqual(r.mutation.changes,[
    {
      path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Wallpapers/2',
      kind:'REPLACE',
      before:7101,
      after:7200
    },
    {
      path:'/World/PlayerHouses/0/Floors/0/Rooms/0/WallpaperOffsetById/7101',
      kind:'REMOVE',
      before:0.5
    }
  ]);
  assert.equal(Object.hasOwn(r.mutation.finalWallpaperOffsetById,'7101'),false);
  assert.equal(r.mutation.finalWallpaperOffsetById['7100'],0.25);
});

test('All Walls is one atomic mutation set and removes offsets for every displaced ItemID no longer used',()=>{
  const p=projection();
  const r=compileRoomWallpaperMutationV125({
    projection:p,
    itemEvidence:item(7200,'Wallpaper',1),
    scope:WALLPAPER_SCOPE.ALL_WALLS
  });
  assert.equal(r.status,'READY');
  assert.deepEqual(r.mutation.selectedWallPositions,[0,1,2,3]);
  assert.deepEqual(r.mutation.finalWallpapers,{'0':7200,'1':7200,'2':7200,'3':7200});
  assert.deepEqual(r.mutation.finalWallpaperOffsetById,{'7200':0.125});
  assert.equal(r.mutation.changes.filter(x=>x.path.includes('/Wallpapers/')).length,4);
  assert.equal(r.mutation.changes.filter(x=>x.kind==='REMOVE').length,3);
  assert.deepEqual(
    r.mutation.changes.filter(x=>x.kind==='REMOVE').map(x=>x.path).sort(),
    [
      '/World/PlayerHouses/0/Floors/0/Rooms/0/WallpaperOffsetById/7100',
      '/World/PlayerHouses/0/Floors/0/Rooms/0/WallpaperOffsetById/7101',
      '/World/PlayerHouses/0/Floors/0/Rooms/0/WallpaperOffsetById/7102'
    ]
  );
  assert.equal(r.mutation.offsetPolicy.synthesizedTargetOffset,false);
  assert.equal(r.mutation.inventoryMutation,false);
  assert.equal(r.mutation.ceilingMutation,false);
});

test('Wallpaper map entry can be added for an absent wall key using native default old ItemID zero semantics',()=>{
  const root=profile();
  delete root.World.PlayerHouses[0].Floors[0].Rooms['0'].Wallpapers['3'];
  root.World.PlayerHouses[0].Floors[0].Rooms['0'].WallpaperOffsetById['0']=0.875;
  const p=projection(root);
  const r=compileRoomWallpaperMutationV125({
    projection:p,
    itemEvidence:item(7200,'Wallpaper',1),
    scope:WALLPAPER_SCOPE.CURRENT_WALL,
    currentWall:{wallPosition:3,wallGridId:904}
  });
  assert.equal(r.status,'READY');
  assert.deepEqual(r.mutation.changes,[
    {
      path:'/World/PlayerHouses/0/Floors/0/Rooms/0/Wallpapers/3',
      kind:'ADD',
      after:7200
    },
    {
      path:'/World/PlayerHouses/0/Floors/0/Rooms/0/WallpaperOffsetById/0',
      kind:'REMOVE',
      before:0.875
    }
  ]);
});

test('Wallpaper requires native Wallpaper subtype and ownership',()=>{
  let r=compileRoomWallpaperMutationV125({
    projection:projection(),itemEvidence:item(7200,'Flooring',1),scope:WALLPAPER_SCOPE.ALL_WALLS
  });
  assert.equal(r.status,'REJECTED');
  assert.ok(r.reasonCodes.includes('WALLPAPER_TRIMMING_SUBTYPE_REQUIRED'));

  r=compileRoomWallpaperMutationV125({
    projection:projection(),itemEvidence:item(7200,'Wallpaper',0),scope:WALLPAPER_SCOPE.ALL_WALLS
  });
  assert.equal(r.status,'REJECTED');
  assert.ok(r.reasonCodes.includes('OWNED_TRIMMING_REQUIRED'));
});

test('Wallpaper offset projection is keyed by wallpaper ItemID and standalone write remains product-blocked',()=>{
  const r=describeWallpaperOffsetSemanticsV125({projection:projection(),wallpaperItemId:7100});
  assert.equal(r.status,'VALID');
  assert.deepEqual(r.wallpaperOffset.usedByWallPositions,[0,1]);
  assert.equal(r.wallpaperOffset.exists,true);
  assert.equal(r.wallpaperOffset.value,0.25);
  assert.equal(r.wallpaperOffset.nativeKeying,'ONE_OFFSET_PER_WALLPAPER_ITEM_ID_PER_ROOM');
  assert.equal(r.wallpaperOffset.productStandaloneWriteAuthorized,false);
});

test('Room Finish reports exact minimal 01A target extension rather than a generic writer',()=>{
  const r=roomFinishUpstreamNeedV125();
  assert.equal(r.requestId,ROOM_FINISH_UPSTREAM_REQUEST_ID);
  assert.equal(r.required,true);
  assert.equal(r.minimumExtension,'ADD PLAYER_HOUSE_ROOM TARGET KIND TO EXISTING WRITE_CANDIDATE');
  assert.equal(r.newGenericWriterRequired,false);
  assert.equal(r.arbitraryPathWriterRequired,false);
});
