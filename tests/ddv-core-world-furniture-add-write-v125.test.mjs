import test from 'node:test';
import assert from 'node:assert/strict';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { createVerifiedWriteCandidate, verifyWriteCandidate } from '../src/lib/ddv/core/save/transaction-foundation.js';
import { BuildIdentityKind, PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';
import {
  ADMISSIBILITY_SCHEMA,
  FURNITURE_ADD_CONTRACT,
  MUTATION_ADAPTER_ID,
  PLACEMENT_REVISION,
  buildOrdinaryFurnitureAddTransactionPlan,
  classifyOrdinaryFurnitureAdd,
  ordinaryFurnitureAddAdapter
} from '../src/lib/ddv/core/world/furniture-add-write-v125.js';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const TARGET=Object.freeze({platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'52BD625D9B4E0053'});
const scope=Object.freeze({
  itemID:40000048,concreteType:'FurnitureItemData',scopeTier:'CORE_STATELESS_FURNITURE',interaction:'None',
  isMissionItem:false,forPuzzleOnly:false,explicitGridEditRestriction:null,nativePresetKnownRejectReasons:[],isSyncOnlineItem:false
});
const placement=Object.freeze({
  revision:PLACEMENT_REVISION,sameRootGrid:true,clearArea:false,automaticSpawning:false,
  result:{status:'VALID',valid:true,verdict:'VALID'}
});
function profile(){return {
  GameInfo:{InitialVersion:518,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Level:50,ListInventories:{40000048:{Amount:0}},CollectionSets:{Furniture:{40000048:false}},Opaque:{keep:true}},
  World:{GridCollection:{Grids:{'7':{
    ID:7,GridDataPath:'GridData/Villages/Test-GridData.json',GridDefaultLayoutPath:'',TessellationFactor:2,NextGridObjectID:100,
    Objects:{
      '42':{ID:42,ItemID:40000049,X:20,Y:20,Orientation:'GridOrientation_Down',State:null},
      '77':{ID:77,ItemID:40000050,X:40,Y:40,Orientation:'GridOrientation_Left',State:null}
    },OpaqueGrid:{keep:'exact'}
  }}},PlayerHouses:[],Shops:{},Stores:{},ConditionalEventHistoryData:{},OpaqueWorld:{keep:['x','y']}},
  Settings:{Language:'en'}
};}
function readVersion(text){try{return JSON.parse(text)?.GameInfo?.Version??624;}catch{return 624;}}
function codec(){return {
  contract:'p1g-v0',
  async loadProfile(input){const text=decoder.decode(input);return {inputType:'plain',jsonText:text,metadata:{version:readVersion(text)}};},
  parseProfileText(text){return {metadata:{version:readVersion(text)}};},
  async createEncodedProfile(text){return encoder.encode(text);},
  getProfileVersion(metadata){return metadata.version;}
};}
async function sessionFor(root=profile()){return SafeProfileEditSession.open({sourceBytes:encoder.encode(JSON.stringify(root)),codec:codec(),sourcePlatform:PlatformFamily.Switch});}
function classify(root=profile(),override={}){return classifyOrdinaryFurnitureAdd({
  source:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:'52BD625D9B4E0053'},
  profile:root,
  target:{gridId:7,itemId:40000048,x:10,y:12,orientation:4,relation:'ROOT',parentAddress:null,portableState:null,dependencyIds:[],...(override.target??{})},
  scopeRecord:{...scope,...(override.scopeRecord??{})},
  placementEvidence:override.placementEvidence??placement
});}
async function planFor(root=profile()){
  const session=await sessionFor(root),ctx=session.getPreflightContext(),admissibility=classify(root);
  const plan=buildOrdinaryFurnitureAddTransactionPlan({
    admissibility,
    transactionInput:{platform:PlatformFamily.Switch,gameVersion:'1.25.0',profileGameInfoVersion:624,originalFileLength:session.source.length,originalSha256:ctx.saveIdentity.sourceRawSha256,codecContract:ctx.codecContract,targetBuild:{...TARGET}},
    planId:'test-furniture-add'
  });
  return {session,admissibility,plan};
}

test('ordinary Furniture ADD classifier freezes one six-field ROOT object at source NextGridObjectID',()=>{
  const a=classify();
  assert.equal(a.schema,ADMISSIBILITY_SCHEMA);
  assert.equal(a.contract,FURNITURE_ADD_CONTRACT);
  assert.equal(a.status,'ADMISSIBLE');
  assert.equal(a.createdGridObjectId,100);
  assert.equal(a.objectMapKey,'100');
  assert.equal(a.nextGridObjectIDBefore,100);
  assert.equal(a.nextGridObjectIDAfter,101);
  assert.deepEqual(a.preservedGridObjectIds,[42,77]);
  assert.deepEqual(a.serializedObject,{ID:100,ItemID:40000048,X:10,Y:12,Orientation:'GridOrientation_Right',State:null});
  assert.deepEqual(Object.keys(a.serializedObject).sort(),['ID','ItemID','Orientation','State','X','Y'].sort());
  assert.equal(Object.hasOwn(a.serializedObject,'From'),false);
  assert.equal(a.ownershipMutation,'NONE');
  assert.equal(a.persistentWriteAuthorized,false);
});

test('ordinary Furniture ADD classifier fails closed outside frozen stateless ROOT placement subset',()=>{
  assert.equal(classify(profile(),{target:{orientation:2}}).status,'REJECTED');
  assert.ok(classify(profile(),{target:{orientation:2}}).reasonCodes.includes('CARDINAL_ORIENTATION_REQUIRED'));
  assert.ok(classify(profile(),{target:{portableState:{codec:'x'}}}).reasonCodes.includes('ROOT_STATELESS_CREATION_INTENT_REQUIRED'));
  assert.ok(classify(profile(),{scopeRecord:{isMissionItem:true}}).reasonCodes.includes('CORE_STATELESS_FURNITURE_SCOPE_REQUIRED'));
  assert.ok(classify(profile(),{placementEvidence:{...placement,result:{status:'INVALID',valid:false,verdict:'OCCUPIED'}}}).reasonCodes.includes('V125_NATIVE_PLACEMENT_VALID_REQUIRED'));
  const collision=profile();collision.World.GridCollection.Grids['7'].Objects['100']={ID:100,ItemID:40000049,X:1,Y:1,Orientation:'GridOrientation_Down',State:null};
  const c=classify(collision);assert.equal(c.status,'REJECTED');assert.ok(c.reasonCodes.includes('NEXT_GRID_OBJECT_ID_COLLISION'));
});

test('transaction binding is pure GRID_OBJECT_SET ADD and needs no new 01A capability',async()=>{
  const {plan}=await planFor();
  assert.equal(plan.capabilityRequired,'STRUCTURAL_WRITE_CANDIDATE');
  assert.equal(plan.target.kind,'GRID_OBJECT_SET');
  assert.deepEqual(plan.target.createdGridObjectIds,[100]);
  assert.deepEqual(plan.target.deletedGridObjectIds,[]);
  assert.deepEqual(plan.target.replacementIdentityPairs,[]);
  assert.equal(plan.target.nextGridObjectIDBefore,100);
  assert.equal(plan.target.nextGridObjectIDAfter,101);
  assert.equal(plan.mutationAdapter.id,MUTATION_ADAPTER_ID);
  assert.deepEqual(plan.allowedChanges.map(x=>x.path).sort(),[
    '/World/GridCollection/Grids/7/NextGridObjectID',
    '/World/GridCollection/Grids/7/Objects/100'
  ]);
  assert.equal(plan.intent.ownershipMutation,'NONE');
});

test('01A structural engine generates and independently verifies ordinary Furniture ADD candidate',async()=>{
  const before=profile(),{session,plan}=await planFor(before);
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:ordinaryFurnitureAddAdapter});
  assert.equal(candidate.manifest.capability.required,'STRUCTURAL_WRITE_CANDIDATE');
  assert.equal(candidate.manifest.capability.persistentWrite,false);
  assert.equal(candidate.manifest.semanticDiff.accepted,true);
  assert.deepEqual(candidate.manifest.semanticDiff.allChangedPaths,[
    '/World/GridCollection/Grids/7/NextGridObjectID',
    '/World/GridCollection/Grids/7/Objects/100'
  ]);
  assert.deepEqual(candidate.manifest.semanticDiff.identityDelta.added.map(x=>x.id),[100]);
  assert.deepEqual(candidate.manifest.semanticDiff.identityDelta.removed,[]);
  const verification=await verifyWriteCandidate({candidate,codec:codec()});
  assert.equal(verification.status,'PASS');
  const reopened=await SafeProfileEditSession.open({sourceBytes:candidate.candidateBytes,codec:codec(),sourcePlatform:PlatformFamily.Switch});
  const after=reopened.getSnapshot(),grid=after.World.GridCollection.Grids['7'];
  assert.equal(grid.NextGridObjectID,101);
  assert.deepEqual(grid.Objects['100'],{ID:100,ItemID:40000048,X:10,Y:12,Orientation:'GridOrientation_Right',State:null});
  assert.deepEqual(grid.Objects['42'],before.World.GridCollection.Grids['7'].Objects['42']);
  assert.deepEqual(grid.Objects['77'],before.World.GridCollection.Grids['7'].Objects['77']);
  assert.deepEqual(after.Player,before.Player);
  assert.deepEqual(after.World.OpaqueWorld,before.World.OpaqueWorld);
});

test('frozen adapter rejects structural-plan attempts to bind a non-six-field created payload',async()=>{
  const {session,plan}=await planFor();
  const bad=structuredClone(plan);
  bad.intent.serializedObject.From={GridID:1};
  await assert.rejects(
    createVerifiedWriteCandidate({session,plan:bad,adapter:ordinaryFurnitureAddAdapter}),
    error=>String(error?.message??'').includes('FURNITURE_ADD_SERIALIZED_OBJECT_SHAPE_MISMATCH')
  );
});
