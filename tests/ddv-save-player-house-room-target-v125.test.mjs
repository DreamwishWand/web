import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import {
  MUTATION_ADAPTER_CONTRACT,
  PLAYER_HOUSE_ROOM_TARGET_KIND,
  TRANSACTION_PLAN_CONTRACT,
  WRITE_CANDIDATE_CAPABILITY,
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../src/lib/ddv/core/save/transaction-foundation.js';
import { BuildIdentityKind, PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const SWITCH_TARGET=Object.freeze({
  platform:PlatformFamily.Switch,
  kind:BuildIdentityKind.SwitchBid,
  value:'52BD625D9B4E0053'
});

function profile(){
  return {
    GameInfo:{
      InitialVersion:518,
      Version:624,
      LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
      OpaqueMetadata:{keep:'exact'}
    },
    Player:{Inventory:{keep:'exact'},Collection:{keep:'exact'}},
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
              WallpaperOffsetById:{'7100':0.25,'7101':0.5,'7102':0.75},
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
            '42':{ID:42,ItemID:40000001,X:10,Y:20,Orientation:0,State:null}
          }
        }
      }},
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

async function session(){
  return SafeProfileEditSession.open({
    sourceBytes:encoder.encode(JSON.stringify(profile())),
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
}

async function basePlan(s,override={}){
  const ctx=s.getPreflightContext();
  const root='/World/PlayerHouses/0/Floors/0/Rooms/0';
  const plan={
    contract:TRANSACTION_PLAN_CONTRACT,
    planId:'room-finish-test-001',
    semanticOwner:'01B CORE - World / Grid / Buildings',
    capabilityRequired:WRITE_CANDIDATE_CAPABILITY,
    input:{
      platform:PlatformFamily.Switch,
      gameVersion:'1.25.0',
      profileGameInfoVersion:624,
      originalFileLength:s.source.length,
      originalSha256:ctx.saveIdentity.sourceRawSha256,
      codecContract:ctx.codecContract,
      targetBuild:{...SWITCH_TARGET}
    },
    operation:{
      id:'WORLD_PLAYER_HOUSE_ROOM_FINISH_V125',
      owner:'01B CORE - World / Grid / Buildings',
      kind:'SET_FLOORING',
      structuralCapabilitiesSupported:true,
      planSupported:true,
      validationPassed:true,
      runtimeGate:'PENDING'
    },
    target:{
      kind:PLAYER_HOUSE_ROOM_TARGET_KIND,
      playerHouseIndex:0,
      houseItemId:20500005,
      floorIndex:0,
      roomSlot:0
    },
    mutationAdapter:{
      contract:MUTATION_ADAPTER_CONTRACT,
      id:'01b-room-finish-v125-v1',
      owner:'01B CORE - World / Grid / Buildings'
    },
    preconditions:[
      {path:'/World/PlayerHouses/0/HouseItemID',operator:'EQUALS',value:20500005},
      {path:root+'/Flooring',operator:'EQUALS',value:7000}
    ],
    allowedChanges:[
      {path:root+'/Flooring',classification:'INTENTIONAL'}
    ],
    forbiddenPathPrefixes:['/Player'],
    postconditions:[
      {path:root+'/Flooring',operator:'EQUALS',value:7001}
    ],
    preservation:{
      gridObjectIdentityPolicy:'PRESERVE_ALL_GRID_OBJECT_IDENTITIES',
      arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
      unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
      serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
      unknownPathPrefixes:['/World/OpaqueWorld']
    },
    sourceEvidence:[{id:'DDV-ROOM-FINISH-SEMANTICS-V125-V1_0',status:'INTEGRATOR_PROMOTED'}],
    intent:{operation:'SET_FLOORING',itemId:7001}
  };
  return deepMerge(plan,override);
}

function deepMerge(base,override){
  const out=structuredClone(base);
  for(const [k,v] of Object.entries(override)){
    if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k])) out[k]=deepMerge(out[k],v);
    else out[k]=structuredClone(v);
  }
  return out;
}

function adapter(apply){
  return {
    contract:MUTATION_ADAPTER_CONTRACT,
    id:'01b-room-finish-v125-v1',
    owner:'01B CORE - World / Grid / Buildings',
    apply
  };
}

async function expectCode(promise,code){
  await assert.rejects(promise,error=>{
    assert.equal(error.code,code,error?.stack||String(error));
    return true;
  });
}

test('PLAYER_HOUSE_ROOM flooring candidate is independently verified and preserves GridObjects',async()=>{
  const s=await session();
  const plan=await basePlan(s);
  const candidate=await createVerifiedWriteCandidate({
    session:s,
    plan,
    adapter:adapter(draft=>{
      draft.World.PlayerHouses[0].Floors[0].Rooms['0'].Flooring=7001;
    })
  });
  assert.equal(candidate.manifest.target.kind,PLAYER_HOUSE_ROOM_TARGET_KIND);
  assert.deepEqual(candidate.manifest.semanticDiff.intentionalChangedPaths,[
    '/World/PlayerHouses/0/Floors/0/Rooms/0/Flooring'
  ]);
  assert.equal(candidate.manifest.semanticDiff.identityDelta.changed,false);
  assert.equal(candidate.manifest.persistentWriteAuthorized,false);
  const verified=await verifyWriteCandidate({candidate,codec:codec()});
  assert.equal(verified.status,'PASS');
});

test('PLAYER_HOUSE_ROOM wallpaper + stale offset removal are accepted only on exact room leaves',async()=>{
  const s=await session();
  const root='/World/PlayerHouses/0/Floors/0/Rooms/0';
  const plan=await basePlan(s,{
    planId:'room-finish-wallpaper-001',
    operation:{kind:'SET_WALLPAPER'},
    preconditions:[
      {path:'/World/PlayerHouses/0/HouseItemID',operator:'EQUALS',value:20500005},
      {path:root+'/Wallpapers/2',operator:'EQUALS',value:7101},
      {path:root+'/WallpaperOffsetById/7101',operator:'EQUALS',value:0.5}
    ],
    allowedChanges:[
      {path:root+'/Wallpapers/2',classification:'INTENTIONAL'},
      {path:root+'/WallpaperOffsetById/7101',classification:'INTENTIONAL'}
    ],
    postconditions:[
      {path:root+'/Wallpapers/2',operator:'EQUALS',value:7200},
      {path:root+'/WallpaperOffsetById/7101',operator:'NOT_EXISTS'}
    ],
    intent:{operation:'SET_WALLPAPER',scope:'CURRENT_WALL',wallPosition:2,itemId:7200}
  });
  const candidate=await createVerifiedWriteCandidate({
    session:s,
    plan,
    adapter:adapter(draft=>{
      const room=draft.World.PlayerHouses[0].Floors[0].Rooms['0'];
      room.Wallpapers['2']=7200;
      delete room.WallpaperOffsetById['7101'];
    })
  });
  const verified=await verifyWriteCandidate({candidate,codec:codec()});
  assert.equal(verified.status,'PASS');
});

test('PLAYER_HOUSE_ROOM rejects Ceiling and arbitrary room paths at plan normalization',async()=>{
  const s=await session();
  const root='/World/PlayerHouses/0/Floors/0/Rooms/0';
  const plan=await basePlan(s,{
    allowedChanges:[{path:root+'/Ceiling',classification:'INTENTIONAL'}],
    postconditions:[{path:root+'/Ceiling',operator:'EQUALS',value:9999}]
  });
  await expectCode(
    createVerifiedWriteCandidate({
      session:s,
      plan,
      adapter:adapter(draft=>{draft.World.PlayerHouses[0].Floors[0].Rooms['0'].Ceiling=9999;})
    }),
    'TX_PLAYER_HOUSE_ROOM_ALLOWED_PATH_UNSUPPORTED'
  );
});

test('PLAYER_HOUSE_ROOM rejects HouseItemID rebinding',async()=>{
  const s=await session();
  const plan=await basePlan(s,{target:{houseItemId:20500999}});
  await expectCode(
    createVerifiedWriteCandidate({
      session:s,
      plan,
      adapter:adapter(draft=>{draft.World.PlayerHouses[0].Floors[0].Rooms['0'].Flooring=7001;})
    }),
    'TX_PLAYER_HOUSE_ITEM_ID_MISMATCH'
  );
});

test('PLAYER_HOUSE_ROOM keeps all GridObject identity immutable',async()=>{
  const s=await session();
  const plan=await basePlan(s);
  await expectCode(
    createVerifiedWriteCandidate({
      session:s,
      plan,
      adapter:adapter(draft=>{
        draft.World.PlayerHouses[0].Floors[0].Rooms['0'].Flooring=7001;
        draft.World.GridCollection.Grids['7'].Objects['43']={ID:43,ItemID:40000002,X:1,Y:1,Orientation:0,State:null};
      })
    }),
    'TX_MUTATION_OR_SERIALIZATION_FAILED'
  );
});
