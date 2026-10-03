import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import {
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../src/lib/ddv/core/save/transaction-foundation.js';
import { BuildIdentityKind, PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';
import {
  MIN_TRANSFORM_CONTRACT,
  MUTATION_ADAPTER_ID,
  classifyMinimumPersistentTransform,
  buildMinimumTransformTransactionPlan,
  minimumPersistentTransformAdapter
} from '../src/lib/ddv/core/world/min-transform-write-v125.js';

const require=createRequire(import.meta.url);
const placement=require('../static/ddv/core/world/v1.25/placement-v125.cjs');
const encoder=new TextEncoder(),decoder=new TextDecoder();
const targetBuild={platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'52BD625D9B4E0053'};

function profile(){
  return {
    GameInfo:{InitialVersion:518,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},OpaqueMetadata:{keep:'exact'}},
    Player:{Level:50,OpaquePlayer:{keep:[1,2,3]}},
    World:{
      GridCollection:{Grids:{
        '7':{
          ID:7,GridDataPath:'GridData/Test/Test-GridData.json',GridDefaultLayoutPath:'',TessellationFactor:2,NextGridObjectID:100,
          Objects:{
            '42':{ID:42,ItemID:40000048,X:10,Y:20,Orientation:'GridOrientation_Up',State:null},
            '99':{ID:99,ItemID:49999999,X:30,Y:30,Orientation:'GridOrientation_Up',State:{OpaqueState:{keep:true}}}
          }
        }
      }},
      OpaqueWorldState:{keep:{nested:['a','b']}},
      ConditionalEventHistoryData:{Opaque:{keep:true}}
    },
    Settings:{Language:'en'}
  };
}
function scopeRecord(overrides={}){
  return {
    itemID:40000048,
    internalName:'Test!OrdinaryFurniture',
    concreteType:'FurnitureItemData',
    scopeTier:'CORE_STATELESS_FURNITURE',
    interaction:'None',
    forPuzzleOnly:false,
    explicitGridEditRestriction:null,
    isSyncOnlineItem:false,
    isUnavailableForGenerator:false,
    isMissionItem:false,
    acceptedFloorTypesFlag:1,
    nativePresetKnownRejectReasons:[],
    rawPayloadSha256:'0'.repeat(64),
    ...overrides
  };
}
function coreClassification(overrides={}){
  return {itemId:40000048,concreteType:'FurnitureItemData',stateKind:'NONE',layer:'furniture',editability:'editable',reasons:[],...overrides};
}
function rootEvidence(overrides={}){
  return {relation:'ROOT',gridId:7,gridObjectId:42,objectMapKey:'42',...overrides};
}
function progressionRecord(overrides={}){
  return {
    schema:'ddv.progression-destination-veto-record@1',
    gridObjectAddress:{gridId:7,gridObjectId:42},itemID:40000048,
    ownershipClass:'UNCLASSIFIED_NO_POSITIVE_INFERENCE',phaseClass:'UNKNOWN',
    activeReferenceDisposition:'NONE_OBSERVED',
    references:{active:[],unknown:[],historical:[]},
    operationVetoes:{MOVE:[],ROTATE:[],REMOVE:[],DUPLICATE:[],REPLACE:[],STATE_EDIT:[],PRESET_CAPTURE:[],DESTINATION_OVERWRITE:[]},
    evidenceStatus:'UNKNOWN',reasonCodes:[],destinationProtected:false,negativeVetoFound:false,positivePermission:false,
    ...overrides
  };
}
function placementEvidence({x=11,y=21,orientation=0,resultOverride=null,...overrides}={}){
  const geometryIndex={
    40000048:{itemID:40000048,sizeX:1,sizeY:1,layers:[4],acceptedFloorTypesFlag:1,strideOverride:null,areaTessellationFactor:1}
  };
  const gridData={sizeX:64,sizeY:64,floorTypes:Array(64*64).fill(1),compactedFloorTypeIndex:[],compactedFloorTypes:[]};
  const actual=placement.validateOrdinaryCardinalPlacement({
    gridData,geometryIndex,objects:[],
    candidate:{editorId:'g7:o42',itemId:40000048,x,y,orientation},
    gridTessellationFactor:1,excludeEditorId:'g7:o42',
    clearArea:false,automaticSpawning:false
  });
  return {
    revision:placement.revision,
    sameRootGrid:true,
    clearArea:false,
    automaticSpawning:false,
    result:resultOverride??actual,
    ...overrides
  };
}
function classify(root,{operation='MOVE',finalTransform={x:11,y:21,orientation:0},scope=scopeRecord(),core=coreClassification(),rootEv=rootEvidence(),progression=progressionRecord(),placementEvidenceOverride=null}={}){
  const pe=placementEvidenceOverride??placementEvidence({x:finalTransform.x,y:finalTransform.y,orientation:finalTransform.orientation});
  return classifyMinimumPersistentTransform({
    source:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,buildIdentity:'52BD625D9B4E0053'},
    profile:root,target:{gridId:7,gridObjectId:42,itemId:40000048,objectMapKey:'42'},
    scopeRecord:scope,coreClassification:core,rootEvidence:rootEv,
    progressionRecord:progression,placementEvidence:pe,operation,finalTransform
  });
}
function readVersion(text){try{return JSON.parse(text)?.GameInfo?.Version??624;}catch{return 624;}}
function codec(){
  return {
    contract:'p1g-v0',
    async loadProfile(input){const text=decoder.decode(input);return {inputType:'plain',jsonText:text,metadata:{version:readVersion(text)}};},
    parseProfileText(text){return {metadata:{version:readVersion(text)}};},
    async createEncodedProfile(text){return encoder.encode(JSON.stringify(JSON.parse(text)));},
    getProfileVersion(metadata){return metadata.version;}
  };
}
async function sessionFor(root=profile()){
  return SafeProfileEditSession.open({sourceBytes:encoder.encode(JSON.stringify(root)),codec:codec(),sourcePlatform:PlatformFamily.Switch});
}
async function txInput(session){
  const ctx=session.getPreflightContext();
  return {
    platform:PlatformFamily.Switch,gameVersion:'1.25.0',profileGameInfoVersion:624,
    originalFileLength:session.source.length,originalSha256:ctx.saveIdentity.sourceRawSha256,
    codecContract:ctx.codecContract,targetBuild:{...targetBuild}
  };
}

test('strict minimum MOVE classifier consumes canonical flat scope + promoted placement result',()=>{
  const a=classify(profile());
  assert.equal(a.schema,'ddv.minimum-persistent-transform-admissibility@1');
  assert.equal(a.contract,MIN_TRANSFORM_CONTRACT);
  assert.equal(a.status,'ADMISSIBLE');
  assert.deepEqual(a.allowedSerializedFields,['X','Y']);
  assert.deepEqual(a.beforeTransform,{x:10,y:20,orientation:0});
  assert.deepEqual(a.serializedBeforeTransform,{x:10,y:20,orientation:'GridOrientation_Up'});
  assert.deepEqual(a.serializedFinalTransform,{x:11,y:21,orientation:'GridOrientation_Up'});
  assert.equal(a.persistentWriteAuthorized,false);
  assert.equal(a.WORLD_PERSISTENT_WRITE_V125,false);
});

test('strict minimum ROTATE is anchor-preserving and mutates Orientation only',()=>{
  const a=classify(profile(),{operation:'ROTATE',finalTransform:{x:10,y:20,orientation:4}});
  assert.equal(a.status,'ADMISSIBLE');
  assert.deepEqual(a.allowedSerializedFields,['Orientation']);
  assert.deepEqual(a.finalTransform,{x:10,y:20,orientation:4});
  assert.deepEqual(a.serializedFinalTransform,{x:10,y:20,orientation:'GridOrientation_Right'});
});

test('positive authority is not inferred from missing restriction or v1.15 no-veto alone',()=>{
  const noTier=classify(profile(),{scope:scopeRecord({scopeTier:undefined})});
  assert.equal(noTier.status,'REJECTED');
  assert.ok(noTier.reasonCodes.includes('CORE_STATELESS_FURNITURE_SCOPE_REQUIRED'));
  const readonly=classify(profile(),{core:coreClassification({editability:'readonly',reasons:['GRID_EDIT_RESTRICTION_PRESENT']})});
  assert.equal(readonly.status,'REJECTED');
  assert.ok(readonly.reasonCodes.includes('CORE_OBJECT_CLASSIFICATION_NOT_EDITABLE_STATELESS_FURNITURE'));
});

test('Building/SubGrid/state/source-field/special interaction are fail-closed',()=>{
  const building=classify(profile(),{scope:scopeRecord({concreteType:'BuildingItemData'}),core:coreClassification({concreteType:'BuildingItemData',layer:'building',editability:'readonly',reasons:['BUILDING_READ_ONLY']})});
  assert.equal(building.status,'REJECTED');

  const sub=profile();sub.World.GridCollection.Grids['7'].Objects['42'].State={SubGrid:{GridID:88,DesignID:null}};
  const subResult=classify(sub,{core:coreClassification({stateKind:'SubGrid'})});
  assert.ok(subResult.reasonCodes.includes('GRIDOBJECT_STATE_MUST_BE_NULL'));

  const sourced=profile();sourced.World.GridCollection.Grids['7'].Objects['42'].From='Mission';
  assert.ok(classify(sourced).reasonCodes.includes('GRIDOBJECT_EXTRA_OR_SOURCE_FIELD_UNSUPPORTED'));

  const interactive=classify(profile(),{scope:scopeRecord({scopeTier:'STATEFUL_INTERACTION',interaction:'Toggle'})});
  assert.equal(interactive.status,'REJECTED');
});

test('non-root/cross-root evidence and progression references are fail-closed',()=>{
  const nested=classify(profile(),{rootEv:rootEvidence({relation:'SUBGRID_CHILD',parentAddress:{gridId:5,gridObjectId:1}})});
  assert.ok(nested.reasonCodes.includes('EXACT_ROOT_RELATION_REQUIRED'));

  const active=classify(profile(),{progression:progressionRecord({
    activeReferenceDisposition:'ACTIVE_EXACT_ADDRESS',
    references:{active:['r1'],unknown:[],historical:[]},
    negativeVetoFound:true,destinationProtected:true,
    operationVetoes:{MOVE:['PROTECTED'],ROTATE:[]}
  })});
  assert.ok(active.reasonCodes.includes('PROGRESSION_CLEAR_REQUIRED'));

  const historical=classify(profile(),{progression:progressionRecord({
    activeReferenceDisposition:'HISTORICAL_ONLY',references:{active:[],unknown:[],historical:['h1']}
  })});
  assert.equal(historical.status,'ADMISSIBLE');
  assert.deepEqual(historical.reasonCodes,[]);
});

test('canonical scope rejects sync, mission, puzzle, restriction, reject-reason and stateful families',()=>{
  for(const scope of [
    scopeRecord({isSyncOnlineItem:true}),
    scopeRecord({isMissionItem:true}),
    scopeRecord({forPuzzleOnly:true}),
    scopeRecord({explicitGridEditRestriction:{present:true}}),
    scopeRecord({nativePresetKnownRejectReasons:['MISSION_ITEM']}),
    scopeRecord({scopeTier:'STATEFUL_INTERACTION',interaction:'SubGrid'})
  ]){
    const r=classify(profile(),{scope});
    assert.equal(r.status,'REJECTED');
    assert.ok(r.reasonCodes.includes('CORE_STATELESS_FURNITURE_SCOPE_REQUIRED'));
  }
});

test('placement gate consumes exact promoted validator revision and VALID result only',()=>{
  const valid=placementEvidence();
  assert.equal(valid.revision,'V125_NATIVE_ORDINARY_CARDINAL_NONWALL_GROUPSET_2');
  assert.equal(valid.result.status,'VALID');
  assert.equal(classify(profile(),{placementEvidenceOverride:valid}).status,'ADMISSIBLE');

  for(const pe of [
    {...valid,revision:'UNKNOWN_REVISION'},
    {...valid,sameRootGrid:false},
    {...valid,clearArea:true},
    {...valid,automaticSpawning:true},
    {...valid,result:{...valid.result,status:'INVALID',valid:false,verdict:'OCCUPIED'}}
  ]){
    const r=classify(profile(),{placementEvidenceOverride:pe});
    assert.equal(r.status,'REJECTED');
    assert.ok(r.reasonCodes.includes('V125_NATIVE_PLACEMENT_VALID_REQUIRED'));
  }
});

test('non-cardinal transforms and operation semantic violations fail closed',()=>{
  const nonCard=classify(profile(),{operation:'ROTATE',finalTransform:{x:10,y:20,orientation:2}});
  assert.ok(nonCard.reasonCodes.includes('CARDINAL_ORIENTATION_REQUIRED'));
  const moveRotate=classify(profile(),{operation:'MOVE',finalTransform:{x:11,y:20,orientation:4}});
  assert.ok(moveRotate.reasonCodes.includes('MOVE_ORIENTATION_MUST_BE_PRESERVED'));
  const rotateNoOp=classify(profile(),{operation:'ROTATE',finalTransform:{x:10,y:20,orientation:0}});
  assert.ok(rotateNoOp.reasonCodes.includes('ROTATE_ORIENTATION_MUST_CHANGE'));
  const rotateMoved=classify(profile(),{operation:'ROTATE',finalTransform:{x:9,y:21,orientation:4}});
  assert.ok(rotateMoved.reasonCodes.includes('ROTATE_ANCHOR_MOVE_UNSUPPORTED'));
});

test('MOVE adapter binds to 01A transaction engine with exact X/Y semantic diff and preservation',async()=>{
  const root=profile(),a=classify(root);
  assert.equal(a.status,'ADMISSIBLE');
  const session=await sessionFor(root);
  const plan=buildMinimumTransformTransactionPlan({
    admissibility:a,transactionInput:await txInput(session),
    nextGridObjectId:100,planId:'min-move-1'
  });
  assert.equal(plan.mutationAdapter.id,MUTATION_ADAPTER_ID);
  assert.equal(plan.operation.kind,'MOVE');
  assert.deepEqual(plan.allowedChanges.map(x=>x.path),[
    '/World/GridCollection/Grids/7/Objects/42/X',
    '/World/GridCollection/Grids/7/Objects/42/Y'
  ]);
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:minimumPersistentTransformAdapter});
  assert.deepEqual(new Set(candidate.manifest.semanticDiff.intentionalChangedPaths),new Set(plan.allowedChanges.map(x=>x.path)));
  assert.deepEqual(candidate.manifest.semanticDiff.unrelatedChangedPaths,[]);
  assert.deepEqual(candidate.manifest.semanticDiff.unknownChangedPaths,[]);
  assert.equal(candidate.manifest.semanticDiff.identityDelta.changed,false);
  assert.equal(candidate.manifest.capability.writeCandidate,true);
  assert.equal(candidate.manifest.capability.persistentWrite,false);
  assert.equal(candidate.manifest.persistentWriteAuthorized,false);
  assert.equal(candidate.manifest.WORLD_PERSISTENT_WRITE_V125,false);
  const verified=await verifyWriteCandidate({candidate,codec:codec()});
  assert.equal(verified.status,'PASS');

  const reopened=await SafeProfileEditSession.open({sourceBytes:candidate.candidateBytes,codec:codec(),sourcePlatform:PlatformFamily.Switch});
  const snap=reopened.getSnapshot(),o=snap.World.GridCollection.Grids['7'].Objects['42'];
  assert.equal(o.X,11);assert.equal(o.Y,21);assert.equal(o.Orientation,'GridOrientation_Up');
  assert.equal(o.ID,42);assert.equal(o.ItemID,40000048);assert.equal(o.State,null);
  assert.equal(snap.World.GridCollection.Grids['7'].NextGridObjectID,100);
  assert.deepEqual(snap.World.GridCollection.Grids['7'].Objects['99'].State,{OpaqueState:{keep:true}});
  assert.deepEqual(snap.World.OpaqueWorldState,{keep:{nested:['a','b']}});
  assert.deepEqual(snap.Player.OpaquePlayer,{keep:[1,2,3]});
});

test('ROTATE adapter binds to 01A engine with Orientation-only diff and enum representation',async()=>{
  const root=profile(),a=classify(root,{operation:'ROTATE',finalTransform:{x:10,y:20,orientation:4}});
  assert.equal(a.status,'ADMISSIBLE');
  const session=await sessionFor(root);
  const plan=buildMinimumTransformTransactionPlan({
    admissibility:a,transactionInput:await txInput(session),
    nextGridObjectId:100,planId:'min-rotate-1'
  });
  assert.deepEqual(plan.allowedChanges.map(x=>x.path),[
    '/World/GridCollection/Grids/7/Objects/42/Orientation'
  ]);
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:minimumPersistentTransformAdapter});
  assert.deepEqual(new Set(candidate.manifest.semanticDiff.intentionalChangedPaths),new Set(plan.allowedChanges.map(x=>x.path)));
  const verified=await verifyWriteCandidate({candidate,codec:codec()});
  assert.equal(verified.status,'PASS');
  const reopened=await SafeProfileEditSession.open({sourceBytes:candidate.candidateBytes,codec:codec(),sourcePlatform:PlatformFamily.Switch});
  const o=reopened.getSnapshot().World.GridCollection.Grids['7'].Objects['42'];
  assert.deepEqual({X:o.X,Y:o.Y,Orientation:o.Orientation},{X:10,Y:20,Orientation:'GridOrientation_Right'});
});

test('semantic adapter rejects an overbroad MOVE plan that tries to authorize Orientation',async()=>{
  const root=profile(),a=classify(root),session=await sessionFor(root);
  const plan=structuredClone(buildMinimumTransformTransactionPlan({
    admissibility:a,transactionInput:await txInput(session),nextGridObjectId:100,planId:'tampered-move'
  }));
  plan.allowedChanges.push({path:'/World/GridCollection/Grids/7/Objects/42/Orientation',classification:'INTENTIONAL'});
  await assert.rejects(
    createVerifiedWriteCandidate({session,plan,adapter:minimumPersistentTransformAdapter}),
    /MIN_TRANSFORM_ALLOWED_PATHS_MISMATCH/
  );
});

test('semantic adapter rejects tampered required preservation pre/postconditions',async()=>{
  const root=profile(),a=classify(root),session=await sessionFor(root);
  const base=buildMinimumTransformTransactionPlan({
    admissibility:a,transactionInput:await txInput(session),nextGridObjectId:100,planId:'tampered-conditions'
  });

  const missingNext=structuredClone(base);
  missingNext.preconditions=missingNext.preconditions.filter(c=>!c.path.endsWith('/NextGridObjectID'));
  await assert.rejects(
    createVerifiedWriteCandidate({session,plan:missingNext,adapter:minimumPersistentTransformAdapter}),
    /MIN_TRANSFORM_NEXT_GRID_OBJECT_ID_PRESERVATION_REQUIRED/
  );

  const loosePost=structuredClone(base);
  const postX=loosePost.postconditions.find(c=>c.path.endsWith('/Objects/42/X'));
  postX.value=999;
  await assert.rejects(
    createVerifiedWriteCandidate({session,plan:loosePost,adapter:minimumPersistentTransformAdapter}),
    /MIN_TRANSFORM_POST_X_REQUIRED/
  );

  const loosePreservation=structuredClone(base);
  loosePreservation.preservation.unknownStatePolicy='NOT_SAFE';
  await assert.rejects(
    createVerifiedWriteCandidate({session,plan:loosePreservation,adapter:minimumPersistentTransformAdapter}),
    /(?:TX_UNKNOWN_STATE_POLICY_UNSUPPORTED|MIN_TRANSFORM_PRESERVATION_POLICY_MISMATCH)/
  );
});

test('writer boundary stays false despite positive semantic closure',()=>{
  assert.equal(minimumPersistentTransformAdapter.persistentWriteAuthorized,false);
  assert.equal(minimumPersistentTransformAdapter.WORLD_PERSISTENT_WRITE_V125,false);
});
