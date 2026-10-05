import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';
import {
  WALLPAPER_SCOPE,
  compileRoomFlooringMutationV125,
  compileRoomWallpaperMutationV125,
  resolveIndoorRoomFinishV125
} from '../src/lib/ddv/core/world/room-finish-v125.js';
import {
  ROOM_FINISH_ADAPTER_ID,
  buildRoomFinishTransactionPlanV125,
  createRoomFinishVerifiedWriteCandidateV125
} from '../src/lib/ddv/core/world/room-finish-transaction-v125.js';

const encoder=new TextEncoder(),decoder=new TextDecoder();

function profile(){
  return {
    GameInfo:{
      InitialVersion:518,
      Version:624,
      LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
      OpaqueMetadata:{keep:'exact'}
    },
    Player:{
      Inventory:{keep:'exact'},
      Collection:{keep:'exact'},
      Entitlements:{keep:'exact'}
    },
    World:{
      PlayerHouses:[{
        HouseItemID:20500005,
        Floors:[{
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
          },
          OpaqueFloor:{keep:true}
        }],
        OpaqueHouse:{keep:true}
      }],
      GridCollection:{Grids:{
        '7':{
          ID:7,
          NextGridObjectID:100,
          Objects:{
            '42':{ID:42,ItemID:40000001,X:10,Y:20,Orientation:0,State:null,Opaque:{keep:true}}
          }
        }
      }},
      Stores:[{keep:'exact'}],
      OpaqueWorld:{keep:true}
    }
  };
}

function codec(){
  return {
    contract:'p1g-v0',
    async loadProfile(input){
      const text=decoder.decode(input);
      return {inputType:'plain',jsonText:text,metadata:{version:JSON.parse(text).GameInfo.Version}};
    },
    parseProfileText(text){return {metadata:{version:JSON.parse(text).GameInfo.Version}};},
    async createEncodedProfile(text){return encoder.encode(text);},
    getProfileVersion(metadata){return metadata.version;}
  };
}

async function session(root=profile()){
  return SafeProfileEditSession.open({
    sourceBytes:encoder.encode(JSON.stringify(root)),
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
}
function source(){
  return {
    platform:'Nintendo Switch',
    gameVersion:'1.25.0',
    profileSchemaVersion:624,
    buildIdentity:'52BD625D9B4E0053'
  };
}
function projection(root){
  const resolved=resolveIndoorRoomFinishV125({
    source:source(),
    profile:root,
    locator:{houseItemId:20500005,playerHouseIndex:0,floorIndex:0,roomSlot:0}
  });
  assert.equal(resolved.status,'VALID',JSON.stringify(resolved));
  return resolved.projection;
}
function item(itemId,trimmingItemType){
  return {itemId,concreteType:'TrimmingItemData',trimmingItemType,ownedAmount:1};
}

test('Flooring mutation set binds through PLAYER_HOUSE_ROOM candidate and verifies independently',async()=>{
  const root=profile(),p=projection(root);
  const compiled=compileRoomFlooringMutationV125({
    projection:p,
    itemEvidence:item(7001,'Flooring')
  });
  assert.equal(compiled.status,'READY');
  const s=await session(root);
  const plan=buildRoomFinishTransactionPlanV125({
    session:s,
    mutationSet:compiled.mutation,
    planId:'room-finish-flooring-binding'
  });
  assert.equal(plan.target.kind,'PLAYER_HOUSE_ROOM');
  assert.equal(plan.mutationAdapter.id,ROOM_FINISH_ADAPTER_ID);
  assert.deepEqual(plan.allowedChanges.map(x=>x.path),[
    '/World/PlayerHouses/0/Floors/0/Rooms/0/Flooring'
  ]);
  const bound=await createRoomFinishVerifiedWriteCandidateV125({
    session:s,
    mutationSet:compiled.mutation,
    planId:'room-finish-flooring-binding'
  });
  assert.equal(bound.status,'PASS');
  assert.equal(bound.verification.status,'PASS');
  assert.equal(bound.runtimeGate,'PENDING_01E_ROOM_FINISH');
  assert.equal(bound.persistentWriteAuthorized,false);
  const reopened=await SafeProfileEditSession.open({
    sourceBytes:bound.candidate.candidateBytes,
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
  const snap=reopened.getSnapshot();
  assert.equal(snap.World.PlayerHouses[0].Floors[0].Rooms['0'].Flooring,7001);
  assert.deepEqual(snap.World.GridCollection,root.World.GridCollection);
  assert.deepEqual(snap.Player,root.Player);
});

test('All-Walls wallpaper binds exact map replacements plus stale offset removals atomically',async()=>{
  const root=profile(),p=projection(root);
  const compiled=compileRoomWallpaperMutationV125({
    projection:p,
    itemEvidence:item(7200,'Wallpaper'),
    scope:WALLPAPER_SCOPE.ALL_WALLS
  });
  assert.equal(compiled.status,'READY');
  assert.equal(compiled.mutation.changes.filter(x=>x.kind==='REMOVE').length,3);
  const s=await session(root);
  const bound=await createRoomFinishVerifiedWriteCandidateV125({
    session:s,
    mutationSet:compiled.mutation,
    planId:'room-finish-all-walls-binding'
  });
  assert.equal(bound.verification.status,'PASS');
  const reopened=await SafeProfileEditSession.open({
    sourceBytes:bound.candidate.candidateBytes,
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
  const room=reopened.getSnapshot().World.PlayerHouses[0].Floors[0].Rooms['0'];
  assert.deepEqual(room.Wallpapers,{'0':7200,'1':7200,'2':7200,'3':7200});
  assert.deepEqual(room.WallpaperOffsetById,{'7200':0.125});
  assert.equal(room.Ceiling,7300);
  assert.equal(room.FloorGridID,900);
  assert.deepEqual(room.WallGridIDs,{'0':901,'1':902,'2':903,'3':904});
  assert.deepEqual(reopened.getSnapshot().World.GridCollection,root.World.GridCollection);
});

test('binding rejects mutation-set path drift even when change payload is otherwise well shaped',async()=>{
  const root=profile(),p=projection(root);
  const compiled=compileRoomFlooringMutationV125({
    projection:p,
    itemEvidence:item(7001,'Flooring')
  });
  const tampered=structuredClone(compiled.mutation);
  tampered.changes[0].path='/World/PlayerHouses/0/Floors/0/Rooms/0/Ceiling';
  tampered.allowedSemanticPaths=[tampered.changes[0].path];
  const s=await session(root);
  assert.throws(
    ()=>buildRoomFinishTransactionPlanV125({session:s,mutationSet:tampered}),
    /ROOM_FINISH_TX_PATH_UNSUPPORTED/
  );
});

test('binding rejects non-false ownership/inventory/progression mutation flags',async()=>{
  const root=profile(),p=projection(root);
  const compiled=compileRoomFlooringMutationV125({
    projection:p,
    itemEvidence:item(7001,'Flooring')
  });
  for(const flag of ['ownershipMutation','inventoryMutation','progressionMutation']){
    const tampered=structuredClone(compiled.mutation);
    tampered[flag]=true;
    const s=await session(root);
    assert.throws(
      ()=>buildRoomFinishTransactionPlanV125({session:s,mutationSet:tampered}),
      /ROOM_FINISH_TX_UNRELATED_MUTATION_FORBIDDEN/
    );
  }
});
