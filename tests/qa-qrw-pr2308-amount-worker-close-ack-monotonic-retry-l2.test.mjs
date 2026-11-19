// 04 QR-W independent changed-only L2: actual shared Worker Amount CLOSE
// needs exact closed receipt, rejected-close poison + monotonic retry, and
// in-flight encrypted reply wipe. Inert mock only, no real Owner P1G.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 installLocalDevAmountWorker,createLocalAmountDevPort,
 installLocalCollectionDevWorker,createLocalCollectionDevPort
} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
const closed=()=>({kind:'CLOSED',ok:true,writerAuthorized:false,
 nativeV3Verified:false,originalOverwriteAuthorized:false});
function paired(install,create,adapter){
 let terminated=0;const server={},worker={terminate(){terminated++}};
 server.postMessage=data=>{
  const cloned=structuredClone(data);
  queueMicrotask(()=>worker.onmessage({data:cloned}));
 };
 worker.postMessage=data=>queueMicrotask(()=>server.onmessage({data}));
 install(server,adapter);
 return {port:create(worker),worker,server,terminated:()=>terminated};
}
test('actual Amount Worker rejects all non-exact CLOSE acknowledgement variants and poisons OPEN/STAGE until safe retry',async t=>{
 const invalid=[
  ['missing object',undefined],
  ['wrong kind',{...closed(),kind:'OPEN'}],
  ['false ok',{...closed(),ok:false}],
  ['truthy ok string',{...closed(),ok:'true'}],
  ['forged writer authorized',{...closed(),writerAuthorized:true}],
  ['forged Native V3',{...closed(),nativeV3Verified:true}],
  ['original overwrite grant',{...closed(),originalOverwriteAuthorized:true}],
  ['missing required flag',(()=>{const o=closed();delete o.writerAuthorized;return o})()],
  ['extra hidden rights field',{...closed(),rightsAllowed:true}],
  ['Array close receipt',[closed()]],
  ['numeric false flag',{...closed(),originalOverwriteAuthorized:0}],
  ['null close receipt',null]
 ];
 for(const [name,reply] of invalid){
  await t.test(name,async()=>{
   let closes=0,opens=0,stages=0;
   const {port}=paired(installLocalDevAmountWorker,createLocalAmountDevPort,{
    open:async()=>{opens++;return {kind:'OPEN'}},
    stageTyped:async()=>{stages++;return {kind:'STAGED'}},
    close:async()=>++closes===1?reply:closed()
   });
   try{
    await port.open({});
    await assert.rejects(port.close(),/DEV_WORKER_DENIED/);
    for(const op of [()=>port.open({}),()=>port.stageTyped([{}]),
                     ()=>port.backupOriginal(),()=>port.listVerifiedTargets()])
      await assert.rejects(op(),/DEV_WORKER_DENIED/);
    assert.equal(opens,1);
    assert.equal(stages,0);
    assert.deepEqual(await port.close(),closed());
    await port.open({});
    assert.equal(opens,2);
    assert.equal(closes,2);
   }finally{port.dispose()}
  });
 }
});
test('CLOSE throws during outstanding encrypted download: stale ciphertext erased and exact safe retry is only release',async()=>{
 let entered,release,closes=0,opens=0;
 const wasEntered=new Promise(resolve=>entered=resolve);
 const held=new Promise(resolve=>release=resolve);
 const privateBytes=new Uint8Array([6,19,42,101]);
 const {port}=paired(installLocalDevAmountWorker,createLocalAmountDevPort,{
  open:async()=>{opens++;return {kind:'OPEN'}},
  downloadVerifiedCopy:async()=>{entered();await held;return {encryptedBytes:privateBytes}},
  close:async()=>{closes++;if(closes===1)throw Error('RUST_CLOSE_PRIVATE_ERROR');return closed()}
 });
 try{
  await port.open({});
  const downloading=assert.rejects(port.downloadVerifiedCopy('backup'),/DEV_WORKER_DENIED/);
  await wasEntered;
  await assert.rejects(port.close(),/DEV_WORKER_DENIED/);
  await assert.rejects(port.open({}),/DEV_WORKER_DENIED/);
  await assert.rejects(port.stageTyped([]),/DEV_WORKER_DENIED/);
  release();
  await downloading;
  assert.deepEqual(privateBytes,new Uint8Array(privateBytes.length));
  assert.equal(opens,1);
  assert.deepEqual(await port.close(),closed());
  await port.open({});
  assert.equal(opens,2);
 }finally{release?.();port.dispose()}
});
test('async CLOSE pending denies concurrent OPEN and another CLOSE; poisoned result requires a new exact retry',async()=>{
 let release,closes=0,opens=0;
 const wait=new Promise(resolve=>release=resolve);
 const {port}=paired(installLocalDevAmountWorker,createLocalAmountDevPort,{
  open:async()=>{opens++;return {kind:'OPEN'}},
  close:async()=>{closes++;if(closes===1){await wait;return {...closed(),writerAuthorized:true}}return closed()}
 });
 try{
  await port.open({});
  const pending=assert.rejects(port.close(),/DEV_WORKER_DENIED/);
  await Promise.resolve();await Promise.resolve();
  await assert.rejects(port.open({}),/DEV_WORKER_DENIED/);
  await assert.rejects(port.close(),/DEV_WORKER_DENIED/);
  release();
  await pending;
  await assert.rejects(port.open({}),/DEV_WORKER_DENIED/);
  assert.deepEqual(await port.close(),closed());
  await port.open({});
  assert.equal(opens,2);
  assert.equal(closes,2);
 }finally{release?.();port.dispose()}
});
test('a successful exact Amount CLOSE permits new OPEN, but Collection Close policy is not relaxed',async()=>{
 let c1=0,c2=0;
 const a=paired(installLocalDevAmountWorker,createLocalAmountDevPort,{
  open:async()=>({kind:'OPEN'}),close:async()=>{c1++;return closed()}
 });
 const b=paired(installLocalCollectionDevWorker,createLocalCollectionDevPort,{
  open:async()=>({kind:'OPEN'}),close:async()=>{c2++;return closed()}
 });
 try{
  await a.port.open({});assert.deepEqual(await a.port.close(),closed());await a.port.open({});
  await b.port.open({});assert.deepEqual(await b.port.close(),closed());await b.port.open({});
  assert.equal(c1,1);assert.equal(c2,1);
 }finally{a.port.dispose();b.port.dispose()}
});
test('raw replay/fabricated CLOSE with data writer grant cannot bypass actual serialized Amount monotonic ID',async()=>{
 let closes=0,opens=0;const replies=[];
 const srv={postMessage:r=>replies.push(structuredClone(r))};
 installLocalDevAmountWorker(srv,{
  open:async()=>{opens++;return {kind:'OPEN'}},
  close:async()=>{closes++;return closes===1?{...closed(),writerAuthorized:true}:closed()}
 });
 const send=async(id,method,args=[],extra={})=>srv.onmessage({data:{id,method,args,...extra}});
 await send(1,'open',[{}]);
 await send(2,'close',[]);
 await send(2,'close',[]); // replay forbidden, cannot reset poison
 await send(3,'open',[{}]);
 await send(4,'close',[],{mode:'amount'}); // injected mode forbidden
 await send(5,'close',[]); // only this exact safe retry clears poison
 await send(6,'open',[{}]);
 assert.deepEqual(replies.map(x=>x.ok),[true,false,false,false,false,true,true]);
 assert.equal(opens,2);assert.equal(closes,2);
 assert.equal(replies.some(x=>x.data?.writerAuthorized===true),false);
});
