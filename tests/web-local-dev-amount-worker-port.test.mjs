import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLocalAmountDevPort,installLocalDevAmountWorker}
 from '../src/lib/dev/local-amount-worker-adapter.mjs';
import {createLocalAmountDevWorkflow,STEAM626_FULL_VERSION}
 from '../src/lib/dev/local-amount-workflow.mjs';
function channel(){
 const client={onmessage:null,onerror:null,postMessage:v=>queueMicrotask(()=>server.onmessage?.({data:v})),
  terminate:()=>{}};
 const server={onmessage:null,postMessage:v=>queueMicrotask(()=>client.onmessage?.({data:v}))};
 return{client,server};
}
const ok=kind=>({kind,ok:true,writerAuthorized:false,
 nativeV3Verified:false,originalOverwriteAuthorized:false});
const inventory=()=>({kind:'InventoryExistingAmountDecrease',
 targetId:4,itemId:30000001,slotIndex:0,compatibleItemType:'ItemType_Ingredient',
 oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true});
test('single Worker RPC exposes no raw Save/Session/decoded hash and never grants Writer',async()=>{
 const {client,server}=channel();const calls=[];
 const trusted={
  async open({file,build,originalSha256}){calls.push(['OPEN',file.name,build]);
   assert.equal(originalSha256,'a'.repeat(64));return ok('OPEN')},
  async backupOriginal(){calls.push(['BACKUP']);return{backupReadbackVerified:true,
   originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,
   originalName:'steam.p1g',originalSha256:'a'.repeat(64),originalSizeBytes:122,
   backupName:'backup-opfs.p1g'}},
  async listVerifiedTargets(){calls.push(['TARGETS']);return{
   targets:[inventory()],rawDocumentExposed:false}},
  async stageTyped(commands){calls.push(['STAGE',commands]);return ok('STAGED')},
  async undo(){calls.push(['UNDO']);return ok('UNDONE')},
  async redo(){calls.push(['REDO']);return ok('REDONE')},
  async exportEditedCopy(){calls.push(['EXPORT']);return{kind:'EXPORTED',
   ok:true,backupName:'backup-opfs.p1g',editedCopyName:'edited-opfs.p1g',editedSha256:'b'.repeat(64),editedSizeBytes:122,
   editedCiphertextVerified:true,freshWorkerReopenVerified:true,
   independentProcessReopenVerified:false,originalUnchanged:true,
   writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false}},
  async close(){calls.push(['CLOSE']);return ok('CLOSED')}
 };
 installLocalDevAmountWorker(server,trusted);
 const port=createLocalAmountDevPort(client);
 const wf=createLocalAmountDevWorkflow(port,{trustedLocalHarness:true});
 await wf.open({file:{name:'steam.p1g',size:122},fullVersion:STEAM626_FULL_VERSION,
  originalSha256:'a'.repeat(64),buildConfirmed:true});
 await wf.backupAndRead();await wf.stage(0,49);
 await wf.undo();await wf.redo();await wf.exportEditedCopy();
 assert.equal(wf.snapshot().phase,'exported');
 assert.equal(wf.snapshot().editedCopy.freshWorkerReopenVerified,true);
 assert.equal(wf.snapshot().editedCopy.independentProcessReopenVerified,false);
 assert.deepEqual(calls.filter(x=>x[0]!=='CLOSE').map(x=>x[0]),
  ['OPEN','BACKUP','TARGETS','STAGE','UNDO','REDO','EXPORT']);
 const c=JSON.stringify(wf.snapshot());
 for(const forbidden of ['sessionId','decodedSha256','nextCursor','rawJson','PRIVATE_SAVE'])
  assert.ok(!c.includes(forbidden));
 port.dispose();
});
test('untrusted Worker failures are generic and method/keys allowlist fail closed',async()=>{
 const {client,server}=channel();
 installLocalDevAmountWorker(server,{async close(){throw Error('PRIVATE_ABSOLUTE_PATH_OR_KEY')}});
 const p=createLocalAmountDevPort(client);
 await assert.rejects(p.close(),/DEV_WORKER_DENIED/);
 p.dispose();
});

test('QA941 regression: server consumes request ID before invocation, including concurrent replay and Close',async()=>{
 const replies=[],calls=[];const server={postMessage:r=>replies.push(r)};
 let release,entered;
 const waiting=new Promise(r=>{release=r}),started=new Promise(r=>{entered=r});
 installLocalDevAmountWorker(server,{
  async open(a){calls.push(['OPEN',a]);entered();await waiting;return ok('OPEN')},
  async close(){calls.push(['CLOSE']);return ok('CLOSED')},
  async undo(){calls.push(['UNDO']);return ok('UNDONE')}
 });
 const send=(id,method,args=[])=>server.onmessage({data:{id,method,args}});
 const old=send(7,'open',[{name:'A'}]);await started;
 await send(7,'open',[{name:'A'}]); // still pending: no second adapter call
 await send(8,'undo'); // bounded concurrency: consume the denied ID
 await send(9,'close'); // revoke current operation, not request watermark
 await send(7,'open',[{name:'A'}]);await send(8,'undo');
 release();await old;
 assert.equal(calls.filter(x=>x[0]==='OPEN').length,1);
 assert.equal(calls.filter(x=>x[0]==='UNDO').length,0);
 assert.equal(calls.filter(x=>x[0]==='CLOSE').length,1);
 assert.equal(replies.filter(x=>x.id===7).length,3);
 assert.ok(replies.filter(x=>x.id===7||x.id===8).every(x=>x.ok===false));
 await send(10,'undo');
 assert.equal(calls.filter(x=>x[0]==='UNDO').length,1);
 await send(10,'undo');assert.equal(calls.filter(x=>x[0]==='UNDO').length,1);
 assert.equal(replies.at(-1).ok,false);
});

test('QA955 regression: pending asynchronous Close owns the port and consumes denied IDs',async()=>{
 const replies=[],calls=[];const server={postMessage:r=>replies.push(r)};
 let release,entered;
 const waiting=new Promise(r=>{release=r}),started=new Promise(r=>{entered=r});
 installLocalDevAmountWorker(server,{
  async close(){calls.push('CLOSE');entered();await waiting;return ok('CLOSED')},
  async open(){calls.push('OPEN');return ok('OPEN')},
  async undo(){calls.push('UNDO');return ok('UNDONE')},
  async redo(){calls.push('REDO');return ok('REDONE')},
  async exportEditedCopy(){calls.push('EXPORT');return ok('EXPORTED')}
 });
 const send=(id,method,args=[])=>server.onmessage({data:{id,method,args}});
 const close=send(1,'close');await started;
 await send(2,'open',[{name:'B'}]);
 await send(3,'undo');await send(4,'redo');await send(5,'exportEditedCopy');
 await send(6,'close'); // distinct ID, but no overlapping close cleanup
 assert.deepEqual(calls,['CLOSE']);
 assert.deepEqual(replies.map(r=>[r.id,r.ok]),[[2,false],[3,false],[4,false],[5,false],[6,false]]);
 release();await close;
 assert.deepEqual(replies.at(-1),{id:1,ok:true,data:ok('CLOSED')});
 await send(2,'open',[{name:'B'}]);await send(6,'close');
 assert.deepEqual(calls,['CLOSE']); // watermark survives Close settlement
 await send(7,'open',[{name:'B'}]);await send(8,'undo');
 assert.deepEqual(calls,['CLOSE','OPEN','UNDO']);
 assert.ok(replies.slice(-2).every(r=>r.ok===true));
});

test('QA955 regression: Close preempts active work, settles failure, and never unlocks that active operation',async()=>{
 const replies=[],calls=[];const server={postMessage:r=>replies.push(r)};
 let finishOpen,openEntered,finishClose,closeEntered;
 const openWait=new Promise(r=>{finishOpen=r}),openStarted=new Promise(r=>{openEntered=r});
 const closeWait=new Promise((_,reject)=>{finishClose=reject}),closeStarted=new Promise(r=>{closeEntered=r});
 installLocalDevAmountWorker(server,{
  async open(){calls.push('OPEN');openEntered();await openWait;return ok('OPEN')},
  async close(){calls.push('CLOSE');closeEntered();await closeWait;return ok('CLOSED')},
  async undo(){calls.push('UNDO');return ok('UNDONE')}
 });
 const send=(id,method,args=[])=>server.onmessage({data:{id,method,args}});
 const old=send(1,'open',[{name:'A'}]);await openStarted;
 const close=send(2,'close');await closeStarted;
 await send(3,'undo');await send(4,'close');
 assert.deepEqual(calls,['OPEN','CLOSE']);
 finishClose(Error('PRIVATE_CLOSE_FAILURE'));await close;
 assert.deepEqual(replies.at(-1),{id:2,ok:false,error:'DENIED'});
 await send(5,'undo'); // old active operation still draining
 assert.deepEqual(calls,['OPEN','CLOSE']);
 finishOpen();await old;
 assert.deepEqual(replies.at(-1),{id:1,ok:false,error:'DENIED'});
 await send(6,'undo');assert.deepEqual(calls,['OPEN','CLOSE','UNDO']);
 assert.equal(replies.at(-1).ok,true);
 await send(5,'undo');assert.equal(replies.at(-1).ok,false);
});

test('download RPC only accepts exact enum, consumes denied IDs, and revokes in-flight result on Close',async()=>{
 const replies=[],calls=[];let release,entered;
 const hold=new Promise(r=>{release=r}),started=new Promise(r=>{entered=r});
 const server={postMessage:r=>replies.push(r)};
 installLocalDevAmountWorker(server,{
  async downloadVerifiedCopy(which){calls.push(which);entered();await hold;return{kind:'VERIFIED_DOWNLOAD'}},
  async close(){calls.push('CLOSE');return ok('CLOSED')}
 });
 const send=(id,method,args=[])=>server.onmessage({data:{id,method,args}});
 await send(1,'downloadVerifiedCopy',['../private.p1g']);
 await send(2,'downloadVerifiedCopy',['backup','other']);
 const pending=send(3,'downloadVerifiedCopy',['backup']);await started;
 await send(4,'close');release();await pending;
 assert.deepEqual(calls,['backup','CLOSE']);
 assert.equal(replies.find(r=>r.id===1).ok,false);assert.equal(replies.find(r=>r.id===2).ok,false);
 assert.equal(replies.find(r=>r.id===3).ok,false);assert.equal(replies.find(r=>r.id===4).ok,true);
 await send(3,'downloadVerifiedCopy',['edited']);assert.equal(replies.at(-1).ok,false);
});
