import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {describeNativeOperation as describe,previewNativeInventoryAmount as preview,inspectNativeStaticTraceDraft as trace,NATIVE_SOURCE_TARGETS as targets} from '../src/lib/ddv/native/operation-native-static-gate.mjs';
const oldHead='1cda27549550929ee83df34a01be86059456e796';
const path='src/lib/ddv/native/operation-native-static-gate.mjs';
const old=await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show',oldHead+':'+path])).toString('base64'));
const steam=targets.steam1253,sw=targets.switch1253,ops=['INV_AMOUNT','CHEST_AMOUNT','GRID_MOVE'],keys=Object.keys(steam);
const sha='66644cf655e158086f83ffd654222ecfb5744c08423a644d3c0edc3244d66e4c';
const fail=x=>{assert.equal(x.status,'REJECTED');assert.equal(x.archivedSteam626NativeWitness,undefined);for(const k of ['nativeV3Accepted','productWriterAuthorized','productEditedCopyAuthorized','operationEnabled','coreSessionAuthenticated'])assert.equal(x[k],false,k);};
const accepted=(x,target,op)=>{assert.notEqual(x.status,'REJECTED');assert.deepEqual(x.target,target);assert.ok(Object.isFrozen(x.target));assert.equal(x.externalBuildIsAuthentication,false);assert.equal(x.coreIssuedReadsetVerified,false);assert.equal(x.nativeV3Accepted,false);assert.equal(x.productWriterAuthorized,false);assert.equal(x.operationEnabled,false);if(target===steam&&ops.includes(op)){assert.equal(x.archivedSteam626NativeWitness.operationId,op);assert.equal(x.archivedSteam626NativeWitness.binarySha256,sha);assert.equal(x.archivedSteam626NativeWitness.nativeV3Accepted,false);assert.equal(x.archivedSteam626NativeWitness.fullReferenceClosureVerified,false);assert.ok(Object.isFrozen(x.archivedSteam626NativeWitness));}else assert.equal(x.archivedSteam626NativeWitness,undefined);};
function switching(){let n=0;return {get platform(){return ++n<=2?sw.platform:steam.platform},get buildKind(){return n<=2?sw.buildKind:steam.buildKind},get buildId(){return n<=2?sw.buildId:steam.buildId},gameVersion:'1.25.3',schema:626};}
test('historical QA958 actual counterexample reproduced on old blob only, repaired deny all 3',()=>{
 for(const op of ops){const v=old.describeNativeOperation(op,switching());assert.equal(v.target.platform,sw.platform);assert.equal(v.archivedSteam626NativeWitness.operationId,op);fail(describe(op,switching()));}
});
test('every required field accessor rejected without executing, getter and setter variations',()=>{
 for(const op of ops)for(const k of keys)for(const target of [steam,sw]){
  let called=0;const b={...target};Object.defineProperty(b,k,{configurable:true,get(){called++;throw Error('unexpected');}});fail(describe(op,b));assert.equal(called,0);
  const setter={...target};Object.defineProperty(setter,k,{configurable:true,set(){called++;}});fail(describe(op,setter));assert.equal(called,0);
 }
});
test('all own-field omissions and inherited-only fields, mixed canonical combinations reject',()=>{
 for(const op of ops)for(const target of [steam,sw]){
  for(const k of keys){const b={...target};delete b[k];fail(describe(op,b));const inherited=Object.assign(Object.create({[k]:target[k]}),b);fail(describe(op,inherited));}
  for(const mask of [1,2,3,4,5,6]){const b={...steam};for(let i=0;i<3;i++)if(mask&(1<<i))b[keys[i]]=sw[keys[i]];fail(describe(op,b));}
  for(const bad of [null,undefined,[],42,'steam', {...target,schema:'626'},{...target,gameVersion:'1.25.0'},{...target,buildId:new String(target.buildId)}])fail(describe(op,bad));
 }
});
test('coherent descriptor snapshot exactly once, ordinary get/ownKeys forbidden, stable archive after caller mutation',()=>{
 for(const op of ops)for(const target of [steam,sw]){
  const seen=new Map();const backing={...target};const proxy=new Proxy(backing,{get(){throw Error('get trap')},ownKeys(){throw Error('ownKeys trap')},getOwnPropertyDescriptor(o,k){seen.set(k,(seen.get(k)||0)+1);if(seen.get(k)>1)throw Error('re-read');return Reflect.getOwnPropertyDescriptor(o,k);}});
  const x=describe(op,proxy);accepted(x,target,op);assert.deepEqual([...seen],keys.map(k=>[k,1]));
  Object.assign(backing,target===steam?sw:steam);accepted(x,target,op);
  const nul=Object.assign(Object.create(null),target);accepted(describe(op,nul),target,op);
  const fixed=Object.freeze({...target});accepted(describe(op,fixed),target,op);
 }
});
test('proxy descriptor faults, invalid invariants, revocation during snapshot and incoherent values fail closed',()=>{
 for(const op of ops)for(const k of keys){
  const throwing=new Proxy({...steam},{getOwnPropertyDescriptor(o,p){if(p===k)throw Error('descriptor failure');return Reflect.getOwnPropertyDescriptor(o,p);}});fail(describe(op,throwing));
  const missing=new Proxy({...steam},{getOwnPropertyDescriptor(o,p){return p===k?undefined:Reflect.getOwnPropertyDescriptor(o,p)}});fail(describe(op,missing));
  const inv=new Proxy(Object.freeze({...steam}),{getOwnPropertyDescriptor(o,p){return p===k?{value:'wrong',configurable:true,writable:true,enumerable:true}:Reflect.getOwnPropertyDescriptor(o,p)}});fail(describe(op,inv));
  const rev=Proxy.revocable({...steam},{getOwnPropertyDescriptor(o,p){if(p===k){rev.revoke();throw Error('revoked mid-snapshot')}return Reflect.getOwnPropertyDescriptor(o,p)}});fail(describe(op,rev.proxy));
 }
 for(const op of ops){const x=new Proxy({...steam},{getOwnPropertyDescriptor(o,k){return {...Reflect.getOwnPropertyDescriptor(o,k),value:k==='buildId'?sw.buildId:steam[k]}}});fail(describe(op,x));}
});
test('coherent synthetic proxy remains declaration only and archive scoped by operation',()=>{
 for(const op of [...ops,'TIME_EVENT','ROAD_FENCE','APPEARANCE'])for(const target of [steam,sw]){
  const x=new Proxy({},{getOwnPropertyDescriptor(_o,k){return {value:target[k],configurable:true,enumerable:true,writable:true};}});
  accepted(describe(op,x),target,op);
 }
 fail(describe('ENTITLEMENT_REMOTE',steam));fail(describe('SKIN_UNLOCK',steam));fail(describe('UNKNOWN',steam));
});
test('affected preview and trace entrypoints share fail-closed Build selector',()=>{
 const a={inventoryId:12,canonicalItemId:31100001,compatibleItemType:'ItemType_ActivityItem',existingRow:true,oldAmount:50,nextAmount:49,sourceHash:'a'.repeat(64),changedPaths:['/Player/ListInventories/12/Inventory/31100001/Amount']};
 const t={operationId:'INV_AMOUNT',nativeBinarySha256:sha,producerCalls:[{symbol:'ListInventory.RemoveItem',binarySha256:sha}],consumerCalls:[{symbol:'ListInventory.GetItemAmount',binarySha256:sha}],saveReadPointers:a.changedPaths,saveWritePointers:a.changedPaths,derivedWritePointers:[],claim:{nativeV3Accepted:true}};
 for(const build of [switching(),Object.create(steam),{...steam,get schema(){throw Error('getter')}}]){fail(preview({...a,declaredBuild:build}));fail(trace({...t,declaredBuild:build}));}
 for(const target of [steam,sw]){const p=preview({...a,declaredBuild:target});assert.equal(p.status,'TIER_A_01D_TO_01A_CAS_PREVIEW_ONLY');assert.equal(p.productWriterAuthorized,false);const q=trace({...t,declaredBuild:target});assert.equal(q.status,'UNTRUSTED_STATIC_TRACE_SHAPE_ONLY');assert.equal(q.nativeBinaryAuthenticated,false);assert.equal(q.nativeV3Accepted,false);assert.equal(q.productWriterAuthorized,false);}
});
