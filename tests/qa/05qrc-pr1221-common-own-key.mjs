import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { SafeProfileEditSession } from '../../src/lib/ddv/core/save/safe-edit-session.js';
import { p1gPackagedProfileCodec } from '../../src/lib/ddv/core/save/p1g-packaged-profile-codec.js';
import {
  MUTATION_ADAPTER_CONTRACT,
  TRANSACTION_PLAN_CONTRACT,
  WRITE_CANDIDATE_CAPABILITY,
  buildSemanticDiff,
  createVerifiedWriteCandidate,
  verifyWriteCandidate
} from '../../src/lib/ddv/core/save/transaction-foundation.js';
import { BuildIdentityKind, PlatformFamily } from '../../src/lib/ddv/core/save/versioning.js';
import { makeSyntheticP1gProfile } from '../helpers/p1g-fixture.mjs';

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

import { createVerifiedWriteCandidate as oldCreate, verifyWriteCandidate as oldVerify } from '../../src/lib/ddv/core/save/.qa1221-parent.mjs';
import { createHash } from 'node:crypto';
const P='/World/GridCollection/Grids/7/Objects/42/OpaqueObjectField';
const own=(o,k,v)=>Object.defineProperty(o,k,{value:v,enumerable:true,writable:true,configurable:true});
const value=r=>r.World.GridCollection.Grids['7'].Objects['42'].OpaqueObjectField;
const cond=v=>[{path:P,operator:'EQUALS',value:v}];
// Independent canonical serialization directly from JSON tokens; no object assignment.
function canon(v){
 if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
 if(v&&typeof v==='object'){
  // ECMAScript JSON enumeration has integer-index keys first. No integer
  // keys occur in normalized plan objects used here except arrays.
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
 }
 return JSON.stringify(v);
}
const h=v=>createHash('sha256').update(canon(v)).digest('hex');
let oldAccepted=0,denied=0,positive=0,hashNegative=0;
for(const special of [null,7,'data',[1,{a:true}],{Future:[true,null]}]){
 const r=profile(),o=value(r);o.Keep=1;o.nested=[{Z:3,A:4}];own(o,'__proto__',special);own(o.nested[0],'__proto__',special);
 const session=await openSession({root:r});const before=session.getSnapshot();const v=value(before);
 const missing=structuredClone(v);delete missing.__proto__;
 const nested=structuredClone(v);delete nested.nested[0].__proto__;
 const changed=structuredClone(v);own(changed,'__proto__',{different:true});
 for(const bad of [missing,nested,changed]){
  const plan=await planFor(session,{preconditions:cond(bad)});
  const old=await oldCreate({session,plan,adapter:adapter()});assert.equal((await oldVerify({candidate:old,codec:plainCodec()})).status,'PASS');oldAccepted++;
  let called=0;await expectCode(createVerifiedWriteCandidate({session,plan,adapter:adapter(()=>called++)}),'TX_PRECONDITION_FAILED');assert.equal(called,0);denied++;
 }
 const reordered=Object.fromEntries(Object.entries(v).reverse());
 const plan=await planFor(session,{preconditions:cond(reordered),postconditions:cond(v)});
 const c=await createVerifiedWriteCandidate({session,plan,adapter:adapter()});
 assert.equal(c.manifest.planSha256,h(c.plan));assert.equal((await verifyWriteCandidate({candidate:c,codec:plainCodec()})).status,'PASS');
 const reopened=await SafeProfileEditSession.open({sourceBytes:c.candidateBytes,codec:plainCodec(),sourcePlatform:PlatformFamily.Switch});assert.deepEqual(value(reopened.getSnapshot()),v);assert.deepEqual(session.getSnapshot(),before);positive++;
 for(const bad of [missing,nested,changed]){
  const f=structuredClone(c.plan);f.preconditions[0].value=bad;
  await expectCode(verifyWriteCandidate({candidate:{...c,plan:f},codec:plainCodec()}),'TX_PLAN_HASH_MISMATCH');hashNegative++;
 }
 const manifest=structuredClone(c.manifest);own(manifest,'__proto__',special);
 await expectCode(verifyWriteCandidate({candidate:{...c,manifest},codec:plainCodec()}),'TX_CANDIDATE_MANIFEST_HASH_MISMATCH');hashNegative++;
 const badPost=await planFor(session,{postconditions:cond(nested)});
 await expectCode(createVerifiedWriteCandidate({session,plan:badPost,adapter:adapter()}),'TX_POSTCONDITION_FAILED');denied++;
}
assert.deepEqual([oldAccepted,denied,positive,hashNegative],[15,20,5,20]);
console.log('QA1221_OLD_ACCEPTED',oldAccepted,'FIXED_CAS_DENIED',denied,'REOPEN_HASH_POS',positive,'HASH_DENIED',hashNegative,'NO_WRITER');
