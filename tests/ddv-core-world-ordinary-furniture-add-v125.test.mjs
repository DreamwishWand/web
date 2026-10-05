import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import {
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../src/lib/ddv/core/save/transaction-foundation.js';
import {
  PlatformFamily,
  BuildIdentityKind
} from '../src/lib/ddv/core/save/versioning.js';
import {
  ADD_ADMISSIBILITY_SCHEMA,
  MUTATION_ADAPTER_ID,
  ORDINARY_FURNITURE_ADD_CONTRACT,
  PLACEMENT_REVISION,
  buildOrdinaryFurnitureAddTransactionPlan,
  classifyOrdinaryFurnitureAdd,
  ordinaryFurnitureAddAdapter
} from '../src/lib/ddv/core/world/ordinary-furniture-add-v125.js';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const BID='52BD625D9B4E0053';

function profile({next=100}={}){
  return {
    GameInfo:{
      InitialVersion:518,
      Version:624,
      LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
      OpaqueMetadata:{keep:'exact'}
    },
    Player:{
      Level:50,
      FurnitureInventory:{40000048:3},
      Collection:{Furniture:{40000048:{Owned:true}}},
      OpaqueUnknown:{keep:true}
    },
    World:{
      GridCollection:{Grids:{
        '7':{
          ID:7,
          GridDataPath:'GridData/Test/Test-GridData.json',
          GridDefaultLayoutPath:'',
          TessellationFactor:2,
          NextGridObjectID:next,
          Objects:{
            '42':{ID:42,ItemID:40000047,X:1,Y:1,Orientation:'GridOrientation_Up',State:null},
            '77':{ID:77,ItemID:40000049,X:30,Y:30,Orientation:'GridOrientation_Down',State:null,Opaque:{preserve:true}}
          },
          OpaqueGrid:{keep:'exact'}
        }
      }},
      PlayerHouses:[{HouseItemID:20000036,Opaque:{keep:true}}],
      Stores:[{BuildingItemID:20200005,Opaque:{keep:true}}],
      ConditionalEventHistoryData:{Opaque:{keep:true}},
      OpaqueWorld:{keep:['x','y']}
    },
    Settings:{Language:'en'}
  };
}
function scopeRecord(overrides={}){
  return {
    itemID:40000048,
    concreteType:'FurnitureItemData',
    scopeTier:'CORE_STATELESS_FURNITURE',
    interaction:'None',
    forPuzzleOnly:false,
    explicitGridEditRestriction:null,
    isSyncOnlineItem:false,
    isUnavailableForGenerator:false,
    isMissionItem:false,
    acceptedFloorTypesFlag:130807039,
    nativePresetKnownRejectReasons:[],
    ...overrides
  };
}
function coreClassification(overrides={}){
  return {
    concreteType:'FurnitureItemData',
    stateKind:'NONE',
    layer:'furniture',
    editability:'editable',
    reasons:[],
    ...overrides
  };
}
function placement(overrides={}){
  return {
    revision:PLACEMENT_REVISION,
    sameRootGrid:true,
    clearArea:false,
    automaticSpawning:false,
    candidate:{itemId:40000048,x:10,y:20,orientation:4},
    result:{status:'VALID',valid:true,verdict:'VALID',reasons:[],conflicts:[]},
    ...overrides
  };
}
function classify(root=profile(),overrides={}){
  return classifyOrdinaryFurnitureAdd({
    source:{
      platform:'Nintendo Switch',
      gameVersion:'1.25.0',
      profileSchemaVersion:624,
      buildIdentity:BID
    },
    profile:root,
    target:{gridId:7,itemId:40000048,x:10,y:20,orientation:4},
    scopeRecord:scopeRecord(),
    coreClassification:coreClassification(),
    rootEvidence:{relation:'ROOT',gridId:7,parentAddress:null},
    placementEvidence:placement(),
    ...overrides
  });
}
function readVersion(text){
  try{return JSON.parse(text)?.GameInfo?.Version??624;}catch{return 624;}
}
function codec(){
  return {
    contract:'p1g-v0',
    async loadProfile(input){
      const text=decoder.decode(input);
      return {inputType:'plain',jsonText:text,metadata:{version:readVersion(text)}};
    },
    parseProfileText(text){return {metadata:{version:readVersion(text)};},
    async createEncodedProfile(text){return encoder.encode(text);},
    getProfileVersion(metadata){return metadata.version;}
  };
}
async function sessionFor(root=profile()){
  return SafeProfileEditSession.open({
    sourceBytes:encoder.encode(JSON.stringify(root)),
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
}
function transactionInput(session){
  const ctx=session.getPreflightContext();
  return {
    platform:PlatformFamily.Switch,
    gameVersion:'1.25.0',
    profileGameInfoVersion:624,
    originalFileLength:session.source.length,
    originalSha256:ctx.saveIdentity.sourceRawSha256,
    codecContract:ctx.codecContract,
    targetBuild:{
      platform:PlatformFamily.Switch,
      kind:BuildIdentityKind.SwitchBid,
      value:BID
    }
  };
}

test('ordinary Furniture ADD classifier freezes one exact native-shaped root object',()=>{
  const a=classify();
  assert.equal(a.schema,ADD_ADMISSIBILITY_SCHEMA);
  assert.equal(a.contract,ORDINARY_FURNITURE_ADD_CONTRACT);
  assert.equal(a.status,'ADMISSIBLE');
  assert.equal(a.target.createdGridObjectId,100);
  assert.equal(a.target.objectMapKey,'100');
  assert.deepEqual(a.existingGridObjectIds,[42,77]);
  assert.deepEqual(a.nextGridObjectID,{before:100,after:101});
  assert.deepEqual(a.createdObject,{
    ID:100,
    ItemID:40000048,
    X:10,
    Y:20,
    Orientation:'GridOrientation_Right',
    State:null
  });
  assert.deepEqual(Object.keys(a.createdObject).sort(),['ID','ItemID','Orientation','State','X','Y'].sort());
  assert.equal(Object.prototype.hasOwnProperty.call(a.createdObject,'From'),false);
  assert.equal(a.inventoryMutationPolicy,'FORBIDDEN_PRESERVE_EXACT');
  assert.equal(a.entitlementMutationPolicy,'FORBIDDEN_PRESERVE_EXACT');
  assert.equal(a.persistentWriteAuthorized,false);
});

test('ADD binds directly to promoted 01A STRUCTURAL_WRITE_CANDIDATE / GRID_OBJECT_SET',async()=>{
  const root=profile();
  const session=await sessionFor(root);
  const a=classify(root);
  const plan=buildOrdinaryFurnitureAddTransactionPlan({
    admissibility:a,
    transactionInput:transactionInput(session),
    planId:'ordinary-add-integration'
  });

  assert.equal(plan.capabilityRequired,'STRUCTURAL_WRITE_CANDIDATE');
  assert.equal(plan.target.kind,'GRID_OBJECT_SET');
  assert.deepEqual(plan.target.preservedGridObjectIds,[42,77]);
  assert.deepEqual(plan.target.createdGridObjectIds,[100]);
  assert.deepEqual(plan.target.deletedGridObjectIds,[]);
  assert.deepEqual(plan.target.replacementIdentityPairs,[]);
  assert.equal(plan.target.nextGridObjectIDBefore,100);
  assert.equal(plan.target.nextGridObjectIDAfter,101);
  assert.equal(plan.mutationAdapter.id,MUTATION_ADAPTER_ID);
  assert.deepEqual(
    plan.allowedChanges.map(x=>x.path).sort(),
    [
      '/World/GridCollection/Grids/7/NextGridObjectID',
      '/World/GridCollection/Grids/7/Objects/100'
    ].sort()
  );

  const candidate=await createVerifiedWriteCandidate({
    session,
    plan,
    adapter:ordinaryFurnitureAddAdapter
  });
  assert.equal(candidate.manifest.semanticDiff.accepted,true);
  assert.deepEqual(
    candidate.manifest.semanticDiff.identityDelta.added.map(x=>({path:x.path,id:x.id,itemId:x.itemId})),
    [{path:'/World/GridCollection/Grids/7/Objects/100',id:100,itemId:40000048}]
  );
  assert.deepEqual(candidate.manifest.semanticDiff.identityDelta.removed,[]);
  assert.deepEqual(
    candidate.manifest.semanticDiff.allChangedPaths,
    [
      '/World/GridCollection/Grids/7/NextGridObjectID',
      '/World/GridCollection/Grids/7/Objects/100'
    ].sort()
  );

  const verified=await verifyWriteCandidate({candidate,codec:codec()});
  assert.equal(verified.status,'PASS');

  const reopened=await SafeProfileEditSession.open({
    sourceBytes:candidate.candidateBytes,
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
  const snap=reopened.getSnapshot();
  assert.equal(snap.World.GridCollection.Grids['7'].NextGridObjectID,101);
  assert.deepEqual(snap.World.GridCollection.Grids['7'].Objects['100'],a.createdObject);
  assert.equal(Object.prototype.hasOwnProperty.call(snap.World.GridCollection.Grids['7'].Objects['100'],'From'),false);
  assert.deepEqual(snap.World.GridCollection.Grids['7'].Objects['42'],root.World.GridCollection.Grids['7'].Objects['42']);
  assert.deepEqual(snap.World.GridCollection.Grids['7'].Objects['77'],root.World.GridCollection.Grids['7'].Objects['77']);
  assert.deepEqual(snap.Player,root.Player);
  assert.deepEqual(snap.World.PlayerHouses,root.World.PlayerHouses);
  assert.deepEqual(snap.World.Stores,root.World.Stores);
  assert.deepEqual(snap.World.ConditionalEventHistoryData,root.World.ConditionalEventHistoryData);
  assert.deepEqual(snap.World.OpaqueWorld,root.World.OpaqueWorld);
});

test('ADD fails closed for generator-unavailable, mission, sync-online and stateful definitions',()=>{
  for(const record of [
    scopeRecord({isUnavailableForGenerator:true}),
    scopeRecord({isMissionItem:true}),
    scopeRecord({isSyncOnlineItem:true}),
    scopeRecord({interaction:'SubGrid',scopeTier:'STATEFUL_INTERACTION'})
  ]){
    const a=classify(profile(),{scopeRecord:record});
    assert.equal(a.status,'REJECTED');
    assert.ok(a.reasonCodes.includes('ADD_CORE_STATELESS_FURNITURE_SCOPE_REQUIRED'));
  }
  const stateful=classify(profile(),{coreClassification:coreClassification({stateKind:'SubGrid'})});
  assert.equal(stateful.status,'REJECTED');
  assert.ok(stateful.reasonCodes.includes('ADD_CORE_OBJECT_CLASSIFICATION_NOT_EDITABLE_STATELESS_FURNITURE'));
});

test('ADD placement evidence must bind the exact Item/X/Y/orientation and same root',()=>{
  for(const evidence of [
    placement({candidate:{itemId:40000047,x:10,y:20,orientation:4}}),
    placement({candidate:{itemId:40000048,x:11,y:20,orientation:4}}),
    placement({candidate:{itemId:40000048,x:10,y:20,orientation:8}}),
    placement({sameRootGrid:false}),
    placement({result:{status:'INVALID',valid:false,verdict:'OCCUPIED'}})
  ]){
    const a=classify(profile(),{placementEvidence:evidence});
    assert.equal(a.status,'REJECTED');
    assert.ok(a.reasonCodes.includes('V125_NATIVE_PLACEMENT_VALID_REQUIRED'));
  }
});

test('ADD rejects non-root/non-cardinal targets and stale NextGridObjectID',()=>{
  const nonRoot=classify(profile(),{rootEvidence:{relation:'SUBGRID',gridId:7,parentAddress:{gridId:1,gridObjectId:2}}});
  assert.equal(nonRoot.status,'REJECTED');
  assert.ok(nonRoot.reasonCodes.includes('ADD_EXACT_ROOT_RELATION_REQUIRED'));

  const nonCardinal=classify(profile(),{
    target:{gridId:7,itemId:40000048,x:10,y:20,orientation:2},
    placementEvidence:placement({candidate:{itemId:40000048,x:10,y:20,orientation:2}})
  });
  assert.equal(nonCardinal.status,'REJECTED');
  assert.ok(nonCardinal.reasonCodes.includes('CARDINAL_ORIENTATION_REQUIRED'));

  const stale=classify(profile({next:70}));
  assert.equal(stale.status,'REJECTED');
  assert.ok(stale.reasonCodes.includes('NEXT_GRID_OBJECT_ID_NOT_ABOVE_OBSERVED'));
});

test('ADD rejects target Grid object-map key/ID corruption before allocation',()=>{
  const root=profile();
  root.World.GridCollection.Grids['7'].Objects['77'].ID=78;
  const a=classify(root);
  assert.equal(a.status,'REJECTED');
  assert.ok(a.reasonCodes.includes('TARGET_GRID_OBJECT_MAP_KEY_ID_MISMATCH'));
});
