import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {describeNativeOperation as describe,previewNativeInventoryAmount as preview,inspectNativeStaticTraceDraft as trace,NATIVE_SOURCE_TARGETS as targets} from '../src/lib/ddv/native/operation-native-static-gate.mjs';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'});
const path='src/lib/ddv/native/operation-native-static-gate.mjs';
const old='1cda27549550929ee83df34a01be86059456e796';
const qa='611ac8062beb0aa9cd87d7baf96b3718be8c9df7';
assert.equal(git('rev-parse',old+':'+path).trim(),'088ea3c94a9bfdbf227694636c6df2cbc6754da0');
assert.equal(git('rev-parse',qa+':tests/qa05qrc-pr943-native-witness.test.mjs').trim(),'82202e2e88752adff3823b1234dcd197eccdae8e');
const oldModule=await import('data:text/javascript;base64,'+Buffer.from(git('show',old+':'+path)).toString('base64'));
const {steam1253:steam,switch1253:sw}=targets;
const ops=['INV_AMOUNT','CHEST_AMOUNT','GRID_MOVE'];
const keys=Object.keys(steam);
const sha='66644cf655e158086f83ffd654222ecfb5744c08423a644d3c0edc3244d66e4c';
const off=x=>{for(const k of ['nativeV3Accepted','productWriterAuthorized','productEditedCopyAuthorized','operationEnabled'])assert.equal(x[k],false,k);};
const deny=x=>{assert.equal(x.status,'REJECTED');assert.equal(x.reason,'EXACT_PLATFORM_BUILD_VERSION_SCHEMA_REQUIRED');off(x);assert.equal(x.archivedSteam626NativeWitness,undefined)};
const check=(d,op,b)=>{
 assert.notEqual(d.status,'REJECTED');assert.deepEqual(d.target,b);assert.ok(Object.isFrozen(d.target));off(d);
 for(const k of ['nativeConsumerVerified','nativeProducerVerified','nativeRecomputeVerified','coreIssuedReadsetVerified','externalBuildIsAuthentication','writerAuthorized','editedCopyAuthorized','productEnabled'])assert.equal(d[k],false,k);
 if(b===steam){const w=d.archivedSteam626NativeWitness;assert.equal(w.operationId,op);assert.equal(w.binarySha256,sha);assert.equal(w.kind,'ARCHIVED_STEAM626_NATIVE_STATIC_PARTIAL');assert.ok(Object.isFrozen(w));for(const k of ['fullReferenceClosureVerified','nativeV3Accepted','nativeEventReplayAuthorized','productWriterAuthorized'])assert.equal(w[k],false,k);}
 else assert.equal(d.archivedSteam626NativeWitness,undefined);
};
function switching(){
 let n=0;
 return {b:{get platform(){return ++n<=2?sw.platform:steam.platform},get buildKind(){return n<=2?sw.buildKind:steam.buildKind},get buildId(){return n<=2?sw.buildId:steam.buildId},gameVersion:'1.25.3',schema:626},calls:()=>n};
}
test('QAC943 repair reproduces exact old QA958 switching getter on all three operations and new denies without invoking',()=>{
 for(const op of ops){
  const a=switching();const x=oldModule.describeNativeOperation(op,a.b);
  assert.equal(x.target.platform,'switch');assert.equal(x.archivedSteam626NativeWitness.binarySha256,sha);assert.equal(a.calls(),3);off(x);
  const b=switching();deny(describe(op,b.b));assert.equal(b.calls(),0);
 }
});
test('QAC943 repair stable canonical Steam/Switch and all five field mismatch negatives',()=>{
 for(const op of ops){
  for(const b of [steam,sw]){
   const input={...b,nativeV3Accepted:true,writerAuthorized:true,productWriterAuthorized:true,archivedSteam626NativeWitness:{fake:true}};
   const d=describe(op,input);check(d,op,b);input.platform='invalid';check(d,op,b);
   for(const k of keys){
    const wrong=k==='schema'?624:k==='gameVersion'?'1.25.0':(b===steam?sw:steam)[k];
    deny(describe(op,{...b,[k]:wrong}));
   }
  }
 }
});
test('QAC943 repair each accessor, missing or inherited field, malformed input denied',()=>{
 for(const op of ops){
  for(const k of keys){
   let n=0;const a={...steam};Object.defineProperty(a,k,{get(){n++;throw Error('must not execute')},configurable:true});
   deny(describe(op,a));assert.equal(n,0);
   const missing={...steam};delete missing[k];deny(describe(op,missing));
   const inherited=Object.assign(Object.create({[k]:steam[k]}),missing);deny(describe(op,inherited));
   for(const v of [null,undefined,true,{},[],Symbol('x')])deny(describe(op,{...steam,[k]:v}));
  }
  for(const b of [null,undefined,[],42,'steam',()=>steam,Object.create(steam)])deny(describe(op,b));
 }
});
test('QAC943 repair mutable descriptor Proxy reads each required field exactly once, no ordinary get',()=>{
 for(const op of ops)for(const b of [steam,sw]){
  const calls=new Map();let gets=0;
  const proxy=new Proxy({},{
   get(){gets++;throw Error('ordinary property read')},
   getOwnPropertyDescriptor(_,k){
    const n=(calls.get(k)||0)+1;calls.set(k,n);
    return {value:n===1?b[k]:(b===steam?sw:steam)[k],configurable:true,enumerable:true,writable:true};
   }
  });
  check(describe(op,proxy),op,b);
  assert.equal(gets,0);assert.deepEqual([...calls.keys()].sort(),[...keys].sort());assert.ok([...calls.values()].every(n=>n===1));
 }
});
test('QAC943 repair incoherent/throw/revoked Proxy fails closed with no evidence attachment',()=>{
 for(const op of ops){
  const mixed=new Proxy({}, {getOwnPropertyDescriptor(_,k){return {value:k==='platform'?sw[k]:steam[k],configurable:true}}});
  deny(describe(op,mixed));
  const throws=new Proxy({}, {getOwnPropertyDescriptor(){throw Error('trap')}});
  deny(describe(op,throws));
  const revoked=Proxy.revocable({},{});revoked.revoke();deny(describe(op,revoked.proxy));
  const accessor=new Proxy({}, {getOwnPropertyDescriptor(_,k){return {get(){throw Error('accessor')},configurable:true}}});
  deny(describe(op,accessor));
 }
});
const ptr='/Player/ListInventories/12/Inventory/31100001/Amount';
const amount=b=>({declaredBuild:b,inventoryId:12,canonicalItemId:31100001,compatibleItemType:'ItemType_ActivityItem',existingRow:true,oldAmount:50,nextAmount:49,sourceHash:'a'.repeat(64),changedPaths:[ptr],nativeV3Accepted:true,productWriterAuthorized:true});
const draft=(op,b)=>({operationId:op,declaredBuild:b,nativeBinarySha256:sha,producerCalls:[{symbol:'x',binarySha256:sha}],consumerCalls:[{symbol:'y',binarySha256:sha}],saveReadPointers:[ptr],saveWritePointers:[ptr],derivedWritePointers:[],claim:{nativeV3Accepted:true,productWriterAuthorized:true}});
test('QAC943 repair Preview and Trace propagate Build denial, stable input still no authority',()=>{
 const a=switching();deny(preview(amount(a.b)));assert.equal(a.calls(),0);
 for(const op of ops){const x=switching();deny(trace(draft(op,x.b)));assert.equal(x.calls(),0);}
 for(const b of [steam,sw]){
  const p=preview(amount(b));assert.equal(p.status,'TIER_A_01D_TO_01A_CAS_PREVIEW_ONLY');off(p);assert.equal(p.originalShaValidatedByCore,false);
  for(const op of ops){const d=trace(draft(op,b));assert.equal(d.status,'UNTRUSTED_STATIC_TRACE_SHAPE_ONLY');off(d);for(const k of ['declaredBuildIsAuthentic','nativeBinaryAuthenticated','noDerivedWritesProven','sourceDigestValidated','fullReferenceClosureVerified'])assert.equal(d[k],false);}
 }
});
