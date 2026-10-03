import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import {
  MUTATION_ADAPTER_CONTRACT,
  STRUCTURAL_WRITE_CANDIDATE_CAPABILITY,
  TRANSACTION_PLAN_CONTRACT,
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../src/lib/ddv/core/save/transaction-foundation.js';
import {
  BuildIdentityKind,
  PlatformFamily
} from '../src/lib/ddv/core/save/versioning.js';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const SWITCH_TARGET=Object.freeze({
  platform:PlatformFamily.Switch,
  kind:BuildIdentityKind.SwitchBid,
  value:'52BD625D9B4E0053'
});

function profile(){
  return {
    GameInfo:{
      InitialVersion:518,Version:624,
      LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},
      OpaqueMetadata:{keep:'exact'}
    },
    Player:{Level:50,OpaqueUnknown:{keep:true}},
    World:{
      GridCollection:{Grids:{
        '7':{
          ID:7,NextGridObjectID:100,
          Objects:{
            '42':{ID:42,ItemID:40100068,X:0,Y:0,Orientation:'GridOrientation_Down',State:null},
            '77':{ID:77,ItemID:40000001,X:40,Y:40,Orientation:0,State:null,Opaque:{preserve:true}}
          },
          OpaqueGrid:{keep:'exact'}
        }
      }},
      OpaqueWorld:{keep:['x','y']}
    },
    Settings:{Language:'en'}
  };
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
    parseProfileText(text){return {metadata:{version:readVersion(text)}};},
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
async function structuralPlan(session,override={}){
  const ctx=session.getPreflightContext();
  const base={
    contract:TRANSACTION_PLAN_CONTRACT,
    planId:'tx-roadfence-structural-test-001',
    semanticOwner:'01C CORE - Road / Fence',
    capabilityRequired:STRUCTURAL_WRITE_CANDIDATE_CAPABILITY,
    input:{
      platform:PlatformFamily.Switch,
      gameVersion:'1.25.0',
      profileGameInfoVersion:624,
      originalFileLength:session.source.length,
      originalSha256:ctx.saveIdentity.sourceRawSha256,
      codecContract:ctx.codecContract,
      targetBuild:{...SWITCH_TARGET}
    },
    operation:{
      id:'ROADFENCE_STRUCTURAL_OBJECT_SET_V125',
      owner:'01C CORE - Road / Fence',
      kind:'GRID_OBJECT_SET_REPLACE',
      structuralCapabilitiesSupported:true,
      planSupported:true,
      validationPassed:true,
      runtimeGate:'PENDING'
    },
    target:{
      kind:'GRID_OBJECT_SET',
      gridId:7,
      preservedGridObjectIds:[77],
      createdGridObjectIds:[100,101],
      deletedGridObjectIds:[42],
      replacementIdentityPairs:[
        {deletedGridObjectId:42,createdGridObjectId:100}
      ],
      nextGridObjectIDBefore:100,
      nextGridObjectIDAfter:102
    },
    mutationAdapter:{
      contract:MUTATION_ADAPTER_CONTRACT,
      id:'01c-roadfence-structural-test-v1',
      owner:'01C CORE - Road / Fence'
    },
    preconditions:[
      {path:'/World/GridCollection/Grids/7/NextGridObjectID',operator:'EQUALS',value:100},
      {path:'/World/GridCollection/Grids/7/Objects/42',operator:'EXISTS'},
      {path:'/World/GridCollection/Grids/7/Objects/100',operator:'NOT_EXISTS'},
      {path:'/World/GridCollection/Grids/7/Objects/101',operator:'NOT_EXISTS'}
    ],
    allowedChanges:[
      {path:'/World/GridCollection/Grids/7/NextGridObjectID',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/42',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/100',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/101',classification:'INTENTIONAL'}
    ],
    forbiddenPathPrefixes:['/Player','/Settings'],
    postconditions:[
      {path:'/World/GridCollection/Grids/7/NextGridObjectID',operator:'EQUALS',value:102},
      {path:'/World/GridCollection/Grids/7/Objects/42',operator:'NOT_EXISTS'},
      {path:'/World/GridCollection/Grids/7/Objects/100',operator:'EXISTS'},
      {path:'/World/GridCollection/Grids/7/Objects/101',operator:'EXISTS'}
    ],
    preservation:{
      gridObjectIdentityPolicy:'ALLOW_DECLARED_GRID_OBJECT_SET_DELTA',
      arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
      unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
      serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
      unknownPathPrefixes:['/World/OpaqueWorld']
    },
    sourceEvidence:[
      {id:'DDV-SAFE-STRUCTURAL-GRID-OBJECT-TRANSACTION-EXTENSION-V125-V1_0',status:'TEST_ONLY'},
      {id:'01C-PERSISTENT-ROADFENCE-COMPILER-WRITER-V125-V1',status:'TEST_ONLY'}
    ],
    intent:{
      structuralSemanticOwner:'01C CORE - Road / Fence',
      nativeObjectSetMutation:true
    }
  };
  return merge(base,override);
}
function merge(base,override){
  if(override===undefined)return structuredClone(base);
  if(override===null||typeof override!=='object'||Array.isArray(override))return structuredClone(override);
  const out=structuredClone(base);
  for(const [key,value] of Object.entries(override)){
    if(value&&typeof value==='object'&&!Array.isArray(value)&&out[key]&&typeof out[key]==='object'&&!Array.isArray(out[key])){
      out[key]=merge(out[key],value);
    }else out[key]=structuredClone(value);
  }
  return out;
}
function adapter(extra=null){
  return {
    contract:MUTATION_ADAPTER_CONTRACT,
    id:'01c-roadfence-structural-test-v1',
    owner:'01C CORE - Road / Fence',
    apply(draft){
      const grid=draft.World.GridCollection.Grids['7'];
      delete grid.Objects['42'];
      grid.Objects['100']={
        ID:100,ItemID:40700246,X:10,Y:10,
        Orientation:'GridOrientation_Down',State:null
      };
      grid.Objects['101']={
        ID:101,ItemID:40700247,X:10,Y:12,
        Orientation:'GridOrientation_Left',State:null
      };
      grid.NextGridObjectID=102;
      if(extra)extra(draft);
    }
  };
}
async function expectCode(promise,code){
  await assert.rejects(
    promise,
    (error)=>{
      assert.equal(error.code,code,error?.stack||String(error));
      return true;
    }
  );
}

test('machine contracts expose structural write-candidate without authorizing persistent write',async()=>{
  const planSchema=JSON.parse(await readFile(
    new URL('../contracts/save-transaction-plan.schema.json',import.meta.url),
    'utf8'
  ));
  const candidateSchema=JSON.parse(await readFile(
    new URL('../contracts/save-transaction-candidate.schema.json',import.meta.url),
    'utf8'
  ));
  const foundation=JSON.parse(await readFile(
    new URL('../static/ddv/core/save/v1.25/transaction-foundation-v125.json',import.meta.url),
    'utf8'
  ));
  assert.ok(planSchema.properties.capabilityRequired.enum.includes('STRUCTURAL_WRITE_CANDIDATE'));
  assert.ok(candidateSchema.properties.capability.properties.required.enum.includes('STRUCTURAL_WRITE_CANDIDATE'));
  assert.equal(foundation.capabilities.STRUCTURAL_WRITE_CANDIDATE,true);
  assert.equal(foundation.capabilities.PERSISTENT_WRITE,false);
  assert.equal(foundation.structuralGridObjectSetExtension.persistentWriteAuthorized,false);
});

test('positive declared GridObject-set delta produces and independently verifies candidate',async()=>{
  const session=await sessionFor();
  const plan=await structuralPlan(session);
  const candidate=await createVerifiedWriteCandidate({
    session,plan,adapter:adapter()
  });
  assert.equal(candidate.manifest.capability.required,'STRUCTURAL_WRITE_CANDIDATE');
  assert.equal(candidate.manifest.capability.persistentWrite,false);
  assert.equal(candidate.manifest.verification.gridObjectIdentityPreservation,'DECLARED_DELTA_PASS');
  assert.equal(candidate.manifest.semanticDiff.identityDelta.changed,true);
  assert.equal(candidate.manifest.semanticDiff.identityDelta.policy,'ALLOW_DECLARED_GRID_OBJECT_SET_DELTA');
  assert.equal(candidate.manifest.semanticDiff.accepted,true);
  assert.deepEqual(
    candidate.manifest.semanticDiff.identityDelta.removed.map(x=>x.id),
    [42]
  );
  assert.deepEqual(
    candidate.manifest.semanticDiff.identityDelta.added.map(x=>x.id),
    [100,101]
  );

  const verified=await verifyWriteCandidate({
    candidate,codec:codec()
  });
  assert.equal(verified.status,'PASS');

  const reopened=await SafeProfileEditSession.open({
    sourceBytes:candidate.candidateBytes,
    codec:codec(),
    sourcePlatform:PlatformFamily.Switch
  });
  const snap=reopened.getSnapshot();
  assert.equal(snap.World.GridCollection.Grids['7'].NextGridObjectID,102);
  assert.equal(snap.World.GridCollection.Grids['7'].Objects['42'],undefined);
  assert.equal(snap.World.GridCollection.Grids['7'].Objects['100'].ID,100);
  assert.equal(snap.World.GridCollection.Grids['7'].Objects['101'].ID,101);
  assert.deepEqual(
    snap.World.GridCollection.Grids['7'].Objects['77'].Opaque,
    {preserve:true}
  );
  assert.deepEqual(snap.World.OpaqueWorld,{keep:['x','y']});
});

test('structural plan rejects non-contiguous fresh IDs',async()=>{
  const session=await sessionFor();
  const plan=await structuralPlan(session,{
    target:{
      createdGridObjectIds:[100,102],
      nextGridObjectIDAfter:102
    },
    allowedChanges:[
      {path:'/World/GridCollection/Grids/7/NextGridObjectID',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/42',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/100',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/102',classification:'INTENTIONAL'}
    ]
  });
  await expectCode(
    createVerifiedWriteCandidate({session,plan,adapter:adapter()}),
    'TX_CREATED_GRID_OBJECT_IDS_NOT_FRESH_CONTIGUOUS'
  );
});

test('structural plan rejects wrong NextGridObjectID transition',async()=>{
  const session=await sessionFor();
  const plan=await structuralPlan(session,{
    target:{nextGridObjectIDAfter:103}
  });
  await expectCode(
    createVerifiedWriteCandidate({session,plan,adapter:adapter()}),
    'TX_NEXT_GRID_OBJECT_ID_TRANSITION_INVALID'
  );
});

test('structural plan rejects extra or missing allowed structural paths',async()=>{
  const session=await sessionFor();
  const plan=await structuralPlan(session,{
    allowedChanges:[
      {path:'/World/GridCollection/Grids/7/NextGridObjectID',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/42',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/100',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/101',classification:'INTENTIONAL'},
      {path:'/Settings/Language',classification:'INTENTIONAL'}
    ]
  });
  await expectCode(
    createVerifiedWriteCandidate({session,plan,adapter:adapter()}),
    'TX_STRUCTURAL_ALLOWED_PATHS_MISMATCH'
  );
});

test('structural candidate rejects undeclared extra GridObject creation',async()=>{
  const session=await sessionFor();
  const plan=await structuralPlan(session);
  await expectCode(
    createVerifiedWriteCandidate({
      session,plan,
      adapter:adapter((draft)=>{
        draft.World.GridCollection.Grids['7'].Objects['102']={
          ID:102,ItemID:40000002,X:1,Y:1,Orientation:0,State:null
        };
      })
    }),
    'TX_MUTATION_OR_SERIALIZATION_FAILED'
  );
});

test('structural plan cannot overlap preserved, created and deleted identity sets',async()=>{
  const session=await sessionFor();
  const plan=await structuralPlan(session,{
    target:{
      preservedGridObjectIds:[42,77]
    }
  });
  await expectCode(
    createVerifiedWriteCandidate({session,plan,adapter:adapter()}),
    'TX_STRUCTURAL_IDENTITY_SET_OVERLAP'
  );
});

test('ordinary GRID_OBJECT target still rejects unexpected identity mutation',async()=>{
  const session=await sessionFor();
  const ctx=session.getPreflightContext();
  const plan={
    contract:TRANSACTION_PLAN_CONTRACT,
    planId:'tx-ordinary-negative',
    semanticOwner:'01B CORE',
    capabilityRequired:'WRITE_CANDIDATE',
    input:{
      platform:PlatformFamily.Switch,gameVersion:'1.25.0',profileGameInfoVersion:624,
      originalFileLength:session.source.length,originalSha256:ctx.saveIdentity.sourceRawSha256,
      codecContract:ctx.codecContract,targetBuild:{...SWITCH_TARGET}
    },
    operation:{
      id:'TEST_MOVE',owner:'01B CORE',kind:'MOVE',
      structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true,runtimeGate:'PENDING'
    },
    target:{kind:'GRID_OBJECT',gridId:7,gridObjectId:42,itemId:40100068},
    mutationAdapter:{contract:MUTATION_ADAPTER_CONTRACT,id:'ordinary-negative',owner:'01B CORE'},
    preconditions:[],
    allowedChanges:[
      {path:'/World/GridCollection/Grids/7/Objects/100',classification:'INTENTIONAL'}
    ],
    forbiddenPathPrefixes:[],
    postconditions:[],
    preservation:{
      gridObjectIdentityPolicy:'PRESERVE_ALL_GRID_OBJECT_IDENTITIES',
      arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
      unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
      serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
      unknownPathPrefixes:[]
    },
    sourceEvidence:[{id:'TEST',status:'TEST_ONLY'}],
    intent:{}
  };
  const ordinaryAdapter={
    contract:MUTATION_ADAPTER_CONTRACT,id:'ordinary-negative',owner:'01B CORE',
    apply(draft){
      draft.World.GridCollection.Grids['7'].Objects['100']={
        ID:100,ItemID:40000002,X:1,Y:1,Orientation:0,State:null
      };
    }
  };
  await expectCode(
    createVerifiedWriteCandidate({
      session,plan,adapter:ordinaryAdapter
    }),
    'TX_GRID_OBJECT_IDENTITY_CHANGED'
  );
});
