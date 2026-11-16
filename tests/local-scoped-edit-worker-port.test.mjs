import test from 'node:test';
import assert from 'node:assert/strict';
import {installLocalDevAmountWorker,createLocalAmountDevPort} from '../src/lib/dev/local-amount-worker-adapter.mjs';
import {installLocalCollectionDevWorker,createLocalCollectionDevPort} from '../src/lib/dev/local-scoped-edit-worker-port.mjs';
const ack=()=>({kind:'CLOSED',ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
function pair(install,create,adapter){
 let terminated=0;const server={},worker={terminate(){terminated++}};
 server.postMessage=data=>{const copy=structuredClone(data);queueMicrotask(()=>worker.onmessage({data:copy}))};
 worker.postMessage=data=>queueMicrotask(()=>server.onmessage({data}));
 install(server,adapter);
 return {server,worker,port:create(worker),terminated:()=>terminated};
}
test('shared fixed mode port preserves Amount calls and rejects Collection methods',async()=>{
 let calls=0;const a={open:async a=>a,stageTyped:async rows=>{calls++;return rows},downloadVerifiedCopy:async which=>({which}),close:async()=>ack()};
 const {port,terminated}=pair(installLocalDevAmountWorker,createLocalAmountDevPort,a);
 assert.equal(port.inspectCollectionTargets,undefined);assert.equal(port.previewCollectionTarget,undefined);
 assert.deepEqual(await port.open({file:'synthetic'}),{file:'synthetic'});assert.deepEqual(await port.stageTyped([{x:1}]),[{x:1}]);
 await assert.rejects(port.stageTyped());await assert.rejects(port.downloadVerifiedCopy('raw'));assert.equal(calls,1);
 assert.deepEqual(await port.close(),ack());port.dispose();await assert.rejects(port.open({}));assert.equal(terminated(),1);
});
test('Collection port enforces fixed selection and exact Close retry, never dispatches after bad acknowledgement',async()=>{
 let opens=0,closes=0,stages=0;
 const {port}=pair(installLocalCollectionDevWorker,createLocalCollectionDevPort,{
  open:async()=>{opens++;return {kind:'OPEN'}},inspectCollectionTargets:async()=>({targets:[]}),
  stageCollectionTarget:async(s,c)=>{stages++;return {selection:s,choice:c}},
  close:async()=>++closes===1?{...ack(),writerAuthorized:true}:ack()
 });
 assert.equal(port.stageTyped,undefined);await port.open({});
 for(const args of [[0,0],[1,1],[1,0,0],['1',0]])await assert.rejects(port.stageCollectionTarget(...args));
 assert.equal(stages,0);assert.deepEqual(await port.stageCollectionTarget(1,0),{selection:1,choice:0});
 await assert.rejects(port.close());await assert.rejects(port.open({}));await assert.rejects(port.inspectCollectionTargets());
 assert.equal(opens,1);assert.deepEqual(await port.close(),ack());await port.open({});assert.equal(opens,2);
 port.dispose();
});
test('Close revokes pending response and blocks new OPEN until stale request settles',async()=>{
 let enter,release,opens=0;const entered=new Promise(r=>enter=r),hold=new Promise(r=>release=r),bytes=new Uint8Array([3,4]);
 const {port}=pair(installLocalCollectionDevWorker,createLocalCollectionDevPort,{
  downloadVerifiedCopy:async()=>{enter();await hold;return {encryptedBytes:bytes}},
  close:async()=>ack(),open:async()=>{opens++;return {kind:'OPEN'}}
 });
 const pending=assert.rejects(port.downloadVerifiedCopy(1,'backup'));await entered;
 assert.deepEqual(await port.close(),ack());await assert.rejects(port.open({}));assert.equal(opens,0);
 release();await pending;assert.deepEqual(bytes,new Uint8Array([0,0]));await port.open({});assert.equal(opens,1);port.dispose();
});
test('successful download clones encrypted bytes before worker buffer wipe and transport faults terminate',async()=>{
 const bytes=new Uint8Array([1,2,3]);const {worker,port,terminated}=pair(installLocalCollectionDevWorker,createLocalCollectionDevPort,{downloadVerifiedCopy:async()=>({encryptedBytes:bytes})});
 const r=await port.downloadVerifiedCopy(1,'edited');assert.deepEqual(r.encryptedBytes,new Uint8Array([1,2,3]));assert.deepEqual(bytes,new Uint8Array(3));
 worker.onerror();await assert.rejects(port.open({}));port.dispose();assert.equal(terminated(),1);
});
test('raw Worker rejects replay, extra fields, cross-domain and invalid selection; valid IDs remain monotonic',async()=>{
 let staged=0;const replies=[],p={postMessage:r=>replies.push(r)};
 installLocalCollectionDevWorker(p,{stageCollectionTarget:async()=>{staged++;return {ok:true}},close:async()=>ack()});
 const send=(id,method,args,extra={})=>p.onmessage({data:{id,method,args,...extra}});
 await send(1,'stageCollectionTarget',[1,0]);await send(1,'stageCollectionTarget',[1,0]);
 await send(2,'stageTyped',[[{}]]);await send(3,'stageCollectionTarget',[1,0],{mode:'collection'});await send(4,'stageCollectionTarget',[0,0]);await send(5,'stageCollectionTarget',[1,0]);
 assert.equal(staged,2);assert.deepEqual(replies.map(r=>r.ok),[true,false,false,false,false,true]);
});
