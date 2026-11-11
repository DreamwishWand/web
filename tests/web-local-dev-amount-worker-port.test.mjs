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
   originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true}},
  async listVerifiedTargets(){calls.push(['TARGETS']);return{
   targets:[inventory()],rawDocumentExposed:false}},
  async stageTyped(commands){calls.push(['STAGE',commands]);return ok('STAGED')},
  async undo(){calls.push(['UNDO']);return ok('UNDONE')},
  async redo(){calls.push(['REDO']);return ok('REDONE')},
  async exportEditedCopy(){calls.push(['EXPORT']);return{kind:'EXPORTED',
   ok:true,backupName:'backup-opfs.p1g',editedCopyName:'edited-opfs.p1g',
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
