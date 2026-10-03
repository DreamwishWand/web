import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { SafeProfileEditSession } from '../src/lib/ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {
  MUTATION_ADAPTER_CONTRACT,
  TRANSACTION_PLAN_CONTRACT,
  WRITE_CANDIDATE_CAPABILITY,
  buildSemanticDiff,
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../src/lib/ddv/core/save/transaction-foundation.js';
import { BuildIdentityKind, PlatformFamily } from '../src/lib/ddv/core/save/versioning.js';
import { makeSyntheticP1gProfile } from './helpers/p1g-fixture.mjs';

const encoder=new TextEncoder(),decoder=new TextDecoder();
const SWITCH_TARGET=Object.freeze({platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'52BD625D9B4E0053'});

function profile(){
  return {
    GameInfo:{InitialVersion:518,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'},OpaqueMetadata:{keep:'exact'}},
    Player:{Level:50,OpaqueUnknown:{nested:[1,2,{keep:true}]}},
    World:{
      GridCollection:{Grids:{'7':{ID:7,NextGridObjectID:100,Objects:{'42':{ID:42,ItemID:40000001,X:10,Y:20,Orientation:0,State:null,OpaqueObjectField:{keep:'opaque'}}}}}},
      ExperimentalOpaque:{untouched:{value:123}},OpaqueWorldState:{keep:['a','b','c']}
    },
    Settings:{Language:'en'}
  };
}
function readVersion(text){try{return JSON.parse(text)?.GameInfo?.Version??624;}catch{return 624;}}
function plainCodec({transformOnEncode=null,invalidOnEncode=false}={}){
  return {
    contract:'p1g-v0',
    async loadProfile(input){const text=decoder.decode(input);return {inputType:'plain',jsonText:text,metadata:{version:readVersion(text)}};},
    parseProfileText(text){return {metadata:{version:readVersion(text)}};},
    async createEncodedProfile(text){if(invalidOnEncode)return encoder.encode('{ invalid json');let root=JSON.parse(text);if(transformOnEncode)root=transformOnEncode(root);return encoder.encode(JSON.stringify(root));},
    getProfileVersion(metadata){return metadata.version;}
  };
}
async function openSession({root=profile(),sourcePlatform=PlatformFamily.Switch,codec=plainCodec()}={}){
  return SafeProfileEditSession.open({sourceBytes:encoder.encode(JSON.stringify(root)),codec,sourcePlatform});
}
async function planFor(session,override={}){
  const ctx=session.getPreflightContext();
  const base={
    contract:TRANSACTION_PLAN_CONTRACT,
    planId:'tx-test-grid-object-move-001',
    semanticOwner:'01B CORE',
    capabilityRequired:WRITE_CANDIDATE_CAPABILITY,
    input:{
      platform:PlatformFamily.Switch,gameVersion:'1.25.0',profileGameInfoVersion:624,
      originalFileLength:session.source.length,originalSha256:ctx.saveIdentity.sourceRawSha256,
      codecContract:ctx.codecContract,targetBuild:{...SWITCH_TARGET}
    },
    operation:{
      id:'WORLD_EXISTING_GRID_OBJECT_TRANSFORM_V125',owner:'01B CORE',kind:'MOVE',
      structuralCapabilitiesSupported:true,planSupported:true,validationPassed:true,runtimeGate:'PENDING'
    },
    target:{kind:'GRID_OBJECT',gridId:7,gridObjectId:42,itemId:40000001},
    mutationAdapter:{contract:MUTATION_ADAPTER_CONTRACT,id:'01b-existing-grid-object-transform-v1',owner:'01B CORE'},
    preconditions:[
      {path:'/World/GridCollection/Grids/7/Objects/42/ID',operator:'EQUALS',value:42},
      {path:'/World/GridCollection/Grids/7/Objects/42/ItemID',operator:'EQUALS',value:40000001},
      {path:'/World/GridCollection/Grids/7/Objects/42/X',operator:'EQUALS',value:10},
      {path:'/World/GridCollection/Grids/7/Objects/42/Y',operator:'EQUALS',value:20}
    ],
    allowedChanges:[
      {path:'/World/GridCollection/Grids/7/Objects/42/X',classification:'INTENTIONAL'},
      {path:'/World/GridCollection/Grids/7/Objects/42/Y',classification:'INTENTIONAL'}
    ],
    forbiddenPathPrefixes:['/Player'],
    postconditions:[
      {path:'/World/GridCollection/Grids/7/Objects/42/X',operator:'EQUALS',value:11},
      {path:'/World/GridCollection/Grids/7/Objects/42/Y',operator:'EQUALS',value:21}
    ],
    preservation:{
      gridObjectIdentityPolicy:'PRESERVE_ALL_GRID_OBJECT_IDENTITIES',
      arrayPolicy:'PRESERVE_ORDER_AND_LENGTH_OUTSIDE_INTENTIONAL',
      unknownStatePolicy:'OPAQUE_UNCHANGED_REQUIRED',
      serializerNormalizationPolicy:'REJECT_SEMANTIC_NORMALIZATION',
      unknownPathPrefixes:['/World/ExperimentalOpaque']
    },
    sourceEvidence:[{id:'TEST-01B-SEMANTIC-OWNER',status:'TEST_ONLY'}],
    intent:{finalTransform:{x:11,y:21}}
  };
  return merge(base,override);
}
function merge(base,override){
  if(override===undefined)return structuredClone(base);
  if(override===null||typeof override!=='object'||Array.isArray(override))return structuredClone(override);
  const out=structuredClone(base);
  for(const [k,v] of Object.entries(override)){
    if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k]))out[k]=merge(out[k],v);
    else out[k]=structuredClone(v);
  }
  return out;
}
function adapter(extra=null){
  return {contract:MUTATION_ADAPTER_CONTRACT,id:'01b-existing-grid-object-transform-v1',owner:'01B CORE',apply(draft,intent){
    const o=draft.World.GridCollection.Grids['7'].Objects['42'];o.X=intent.finalTransform.x;o.Y=intent.finalTransform.y;if(extra)extra(draft,intent);
  }};
}
async function expectCode(promise,code){
  await assert.rejects(promise,error=>{assert.equal(error.code,code,error?.stack||String(error));return true;});
}

function canonicalJson(value){return JSON.stringify(canonicalize(value));}
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);return out;}
  return value;
}
async function manifestSha(manifest){
  const copy=structuredClone(manifest);delete copy.candidateManifestSha256;
  const digest=await globalThis.crypto.subtle.digest('SHA-256',encoder.encode(canonicalJson(copy)));
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function withRehashedManifest(candidate,mutate){
  const manifest=structuredClone(candidate.manifest);mutate(manifest);
  manifest.candidateManifestSha256=await manifestSha(manifest);
  return {...candidate,manifest};
}

test('machine contracts keep WRITE_CANDIDATE separate from PERSISTENT_WRITE',async()=>{
  const planSchema=JSON.parse(await readFile(new URL('../contracts/save-transaction-plan.schema.json',import.meta.url),'utf8'));
  const candidateSchema=JSON.parse(await readFile(new URL('../contracts/save-transaction-candidate.schema.json',import.meta.url),'utf8'));
  const foundation=JSON.parse(await readFile(new URL('../static/ddv/core/save/v1.25/transaction-foundation-v125.json',import.meta.url),'utf8'));
  assert.equal(planSchema.$id,'dreamwish.ddv.save-transaction-plan@1');
  assert.equal(candidateSchema.$id,'dreamwish.ddv.save-transaction-candidate@1');
  assert.equal(foundation.capabilities.WRITE_CANDIDATE,true);
  assert.equal(foundation.capabilities.PERSISTENT_WRITE,false);
  assert.equal(foundation.writerBoundary.persistentWriteAuthorized,false);
  assert.equal(foundation.writerBoundary.WORLD_PERSISTENT_WRITE_V125,false);
  assert.equal(foundation.atomicReplacementDesign.status,'DESIGN_FROZEN_NOT_IMPLEMENTED_NOT_AUTHORIZED');
  assert.equal(foundation.minimumMutationSubsetProposal.positiveAuthorization,false);
});

test('positive plain candidate: exact bounded delta, independent verification, unrelated opaque state preserved',async()=>{
  const session=await openSession(),plan=await planFor(session);
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:adapter()});
  assert.equal(candidate.manifest.capability.writeCandidate,true);
  assert.equal(candidate.manifest.capability.persistentWrite,false);
  assert.equal(candidate.manifest.persistentWriteAuthorized,false);
  assert.equal(candidate.manifest.WORLD_PERSISTENT_WRITE_V125,false);
  assert.deepEqual(candidate.manifest.semanticDiff.intentionalChangedPaths,[
    '/World/GridCollection/Grids/7/Objects/42/X',
    '/World/GridCollection/Grids/7/Objects/42/Y'
  ]);
  assert.deepEqual(candidate.manifest.semanticDiff.unrelatedChangedPaths,[]);
  assert.deepEqual(candidate.manifest.semanticDiff.unknownChangedPaths,[]);
  assert.equal(candidate.manifest.semanticDiff.identityDelta.changed,false);
  const verified=await verifyWriteCandidate({candidate,codec:plainCodec()});
  assert.equal(verified.status,'PASS');
  const reopened=await SafeProfileEditSession.open({sourceBytes:candidate.candidateBytes,codec:plainCodec(),sourcePlatform:PlatformFamily.Switch});
  const snap=reopened.getSnapshot();
  assert.equal(snap.World.GridCollection.Grids['7'].Objects['42'].X,11);
  assert.equal(snap.World.GridCollection.Grids['7'].Objects['42'].Y,21);
  assert.deepEqual(snap.World.GridCollection.Grids['7'].Objects['42'].OpaqueObjectField,{keep:'opaque'});
  assert.deepEqual(snap.World.ExperimentalOpaque,{untouched:{value:123}});
  assert.deepEqual(snap.Player.OpaqueUnknown,{nested:[1,2,{keep:true}]});
});

test('positive packaged P1G candidate serializes, reopens, verifies, and stays non-persistent',async()=>{
  const source=makeSyntheticP1gProfile(profile());
  const session=await SafeProfileEditSession.open({sourceBytes:source,codec:p1gPackagedProfileCodec,sourcePlatform:PlatformFamily.Switch});
  const plan=await planFor(session);
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:adapter()});
  assert.equal(candidate.manifest.output.format,'packaged');
  assert.equal(candidate.manifest.persistentWriteAuthorized,false);
  const verified=await verifyWriteCandidate({candidate,codec:p1gPackagedProfileCodec});
  assert.equal(verified.status,'PASS');
});

test('negative unsupported exact build fails closed',async()=>{
  const session=await openSession();
  const plan=await planFor(session,{input:{targetBuild:{platform:PlatformFamily.Switch,kind:BuildIdentityKind.SwitchBid,value:'0000000000000000'}}});
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter()}),'TX_UNSUPPORTED_TARGET_BUILD');
});

test('negative wrong target ItemID fails before mutation',async()=>{
  const session=await openSession(),plan=await planFor(session,{target:{itemId:40009999}});
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter()}),'TX_TARGET_ITEM_IDENTITY_MISMATCH');
});

test('negative failed precondition fails closed',async()=>{
  const session=await openSession(),plan=await planFor(session,{preconditions:[{path:'/World/GridCollection/Grids/7/Objects/42/X',operator:'EQUALS',value:999}]});
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter()}),'TX_PRECONDITION_FAILED');
});

test('negative mutation outside exact allowlist issues no candidate',async()=>{
  const session=await openSession(),plan=await planFor(session);
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter(d=>{d.Settings.Language='ja';})}),'TX_MUTATION_OR_SERIALIZATION_FAILED');
});

test('semantic diff separates unrelated and unknown changes',async()=>{
  const session=await openSession(),plan=await planFor(session),before=session.getSnapshot(),after=structuredClone(before);
  after.Settings.Language='ja';after.World.ExperimentalOpaque.untouched.value=456;
  const diff=buildSemanticDiff(before,after,plan);
  assert.deepEqual(diff.unrelatedChangedPaths,['/Settings/Language']);
  assert.deepEqual(diff.unknownChangedPaths,['/World/ExperimentalOpaque/untouched/value']);
  assert.equal(diff.accepted,false);
});

test('negative opaque unknown-field loss during encode is rejected',async()=>{
  const codec=plainCodec({transformOnEncode(root){delete root.World.OpaqueWorldState;return root;}});
  const session=await openSession({codec}),plan=await planFor(session);
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter()}),'TX_MUTATION_OR_SERIALIZATION_FAILED');
});

test('negative unexpected GridObject creation is rejected even if caller allowlists path',async()=>{
  const session=await openSession();
  const plan=await planFor(session,{allowedChanges:[
    {path:'/World/GridCollection/Grids/7/Objects/42/X',classification:'INTENTIONAL'},
    {path:'/World/GridCollection/Grids/7/Objects/42/Y',classification:'INTENTIONAL'},
    {path:'/World/GridCollection/Grids/7/Objects/43',classification:'INTENTIONAL'}
  ]});
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter(d=>{d.World.GridCollection.Grids['7'].Objects['43']={ID:43,ItemID:40000002,X:1,Y:1,Orientation:0,State:null};})}),'TX_GRID_OBJECT_IDENTITY_CHANGED');
});

test('negative parser/reopen failure after serialization issues no candidate',async()=>{
  const codec=plainCodec({invalidOnEncode:true});
  const session=await openSession({codec}),plan=await planFor(session);
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter()}),'TX_MUTATION_OR_SERIALIZATION_FAILED');
});

test('negative candidate tamper fails independent hash verification',async()=>{
  const session=await openSession(),plan=await planFor(session);
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:adapter()});
  const tampered={...candidate,candidateBytes:candidate.candidateBytes.slice()};
  tampered.candidateBytes[tampered.candidateBytes.length-2]^=1;
  await expectCode(verifyWriteCandidate({candidate:tampered,codec:plainCodec()}),'TX_CANDIDATE_HASH_MISMATCH');
});

test('negative self-rehashed manifest target tamper is rejected by plan binding',async()=>{
  const session=await openSession(),plan=await planFor(session);
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:adapter()});
  const tampered=await withRehashedManifest(candidate,manifest=>{manifest.target.gridObjectId=999;});
  await expectCode(verifyWriteCandidate({candidate:tampered,codec:plainCodec()}),'TX_MANIFEST_TARGET_BINDING_MISMATCH');
});

test('negative self-rehashed semantic-diff relabeling is rejected by independent verification',async()=>{
  const session=await openSession(),plan=await planFor(session);
  const candidate=await createVerifiedWriteCandidate({session,plan,adapter:adapter()});
  const tampered=await withRehashedManifest(candidate,manifest=>{
    manifest.semanticDiff.intentionalChangedPaths=[];
    manifest.semanticDiff.unrelatedChangedPaths=[...manifest.semanticDiff.allChangedPaths];
    manifest.semanticDiff.accepted=false;
  });
  await expectCode(verifyWriteCandidate({candidate:tampered,codec:plainCodec()}),'TX_MANIFEST_SEMANTIC_DIFF_BINDING_MISMATCH');
});

test('negative ambiguous source platform fails closed',async()=>{
  const session=await openSession({sourcePlatform:PlatformFamily.Unknown}),plan=await planFor(session);
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter()}),'TX_SOURCE_PLATFORM_MISMATCH');
});

test('negative arbitrary JSON-patch-shaped intent is forbidden',async()=>{
  const session=await openSession(),plan=await planFor(session,{intent:{jsonPatch:[{op:'replace',path:'/Player/Level',value:1}]}});
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter()}),'TX_ARBITRARY_PATCH_INTENT_FORBIDDEN');
});

test('negative GameInfo change stays forbidden even if caller attempts allowlist',async()=>{
  const session=await openSession();
  const plan=await planFor(session,{allowedChanges:[
    {path:'/World/GridCollection/Grids/7/Objects/42/X',classification:'INTENTIONAL'},
    {path:'/World/GridCollection/Grids/7/Objects/42/Y',classification:'INTENTIONAL'},
    {path:'/GameInfo/OnlineVersion',classification:'INTENTIONAL'}
  ]});
  await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter(d=>{d.GameInfo.OnlineVersion=999;})}),'TX_MUTATION_OR_SERIALIZATION_FAILED');
});

test('idempotence: second application of same final transform is exact no-op candidate',async()=>{
  const firstSession=await openSession(),firstPlan=await planFor(firstSession);
  const first=await createVerifiedWriteCandidate({session:firstSession,plan:firstPlan,adapter:adapter()});
  const secondSession=await SafeProfileEditSession.open({sourceBytes:first.candidateBytes,codec:plainCodec(),sourcePlatform:PlatformFamily.Switch});
  const secondPlan=await planFor(secondSession,{
    planId:'tx-test-idempotent-002',
    preconditions:[
      {path:'/World/GridCollection/Grids/7/Objects/42/ID',operator:'EQUALS',value:42},
      {path:'/World/GridCollection/Grids/7/Objects/42/ItemID',operator:'EQUALS',value:40000001},
      {path:'/World/GridCollection/Grids/7/Objects/42/X',operator:'EQUALS',value:11},
      {path:'/World/GridCollection/Grids/7/Objects/42/Y',operator:'EQUALS',value:21}
    ]
  });
  const second=await createVerifiedWriteCandidate({session:secondSession,plan:secondPlan,adapter:adapter()});
  assert.equal(second.manifest.output.noOp,true);
  assert.deepEqual(second.candidateBytes,first.candidateBytes);
});
