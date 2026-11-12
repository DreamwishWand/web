import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createLocalAmountDevWorkflow,createExistingAmountDecrease,STEAM626_FULL_VERSION} from '../src/lib/dev/local-amount-workflow.mjs';
import {installLocalDevAmountWorker,createLocalAmountDevPort} from '../src/lib/dev/local-amount-worker-adapter.mjs';
const S='71fcdd7ef34c1e9adc091991cb5f691a9aff0de6',O='0a18bfb01f3c614f85d4d6c2cde223cfa6247d67',F='406ac11f2d9252f619b7489e61e063f19a9adba4';
const files={
 'src/lib/dev/local-amount-worker-adapter.mjs':'4110c2e2cfb5c1eebeb5f36b66dbb053c004a8a8',
 'src/lib/dev/local-amount-workflow.mjs':'08cfd111c6605f495a4a3acff4f4cd955ae0f4e7',
 'tests/dev-amount-ui-chrome/ci-only-route.svelte':'cabb9062673edbe232a4690c23da0c97b81a7b08',
 'tests/web-local-dev-amount-worker-port.test.mjs':'a4b7310d084b2c487f9f91a4e1d0567948f50e48',
 'tests/web-local-dev-amount-workflow.test.mjs':'5ac6ffeb376ba4fa943bf203055a8b3d57b85cfa'};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const ok=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
const inv=()=>({kind:'InventoryExistingAmountDecrease',targetId:4,itemId:30000001,slotIndex:0,compatibleItemType:'ItemType_Ingredient',oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true});
const chest=()=>({...inv(),kind:'ChestExistingSlotAmountDecrease',targetId:12,itemId:30000002,slotIndex:1,compatibleItemType:null,oldAmount:12});
const args=(name='A.p1g',sha='a',size=64)=>({file:{name,size},fullVersion:STEAM626_FULL_VERSION,originalSha256:sha.repeat(64),buildConfirmed:true});
const backup=(a=args(),name='Backup.p1g')=>({backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true,originalName:a.file.name,originalSha256:a.originalSha256,originalSizeBytes:a.file.size,backupName:name});
const exported=()=>({...ok('EXPORTED'),editedCopyName:'Edited.p1g',backupName:'Backup.p1g',editedCiphertextVerified:true,freshWorkerReopenVerified:true,independentProcessReopenVerified:false,originalUnchanged:true});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
function harness(overrides={}){
 let selected;const calls=[];
 const methods={async open(a){selected=a;return ok('OPEN')},async backupOriginal(){return backup(selected)},async listVerifiedTargets(){return{targets:[inv(),chest()],rawDocumentExposed:false}},async stageTyped(){return ok('STAGED')},async undo(){return ok('UNDONE')},async redo(){return ok('REDONE')},async exportEditedCopy(){return exported()},async close(){return ok('CLOSED')},...overrides};
 const adapter=Object.fromEntries(Object.entries(methods).map(([k,f])=>[k,async(...v)=>{calls.push(k);return f(...v)}]));
 return{w:createLocalAmountDevWorkflow(adapter,{trustedLocalHarness:true}),calls,adapter};
}
const closed=w=>{const s=w.snapshot();assert.equal(s.phase,'closed');assert.equal(s.fileName,'');assert.equal(s.backupVerified,false);assert.equal(s.targets.length,0);assert.equal(s.preview,null);assert.equal(s.editedCopy,null)};
async function prepare(w,m){if(m==='open')return;await w.open(args());if(m==='backupOriginal'||m==='listVerifiedTargets')return;await w.backupAndRead();if(m==='stageTyped')return;await w.stage(0,49);if(m==='redo')await w.undo()}
const op=(w,m)=>m==='open'?w.open(args()):['backupOriginal','listVerifiedTargets'].includes(m)?w.backupAndRead():m==='stageTyped'?w.stage(0,49):w[m]();
test('fixed Source original10 and repair5, QA-only, no route',()=>{
 assert.equal(git('merge-base',S,'HEAD'),S);
 assert.equal(git('diff','--name-status',F,S).split('\n').filter(x=>x.startsWith('A\t')).length,10);
 assert.deepEqual(git('diff','--name-status',O,S).split('\n').sort(),Object.keys(files).map(p=>'M\t'+p).sort());
 for(const [p,h] of Object.entries(files))assert.equal(git('rev-parse',S+':'+p),h);
 assert.ok(git('diff','--name-status',S,'HEAD').split('\n').every(x=>x.startsWith('A\t')&&/04qr-w-pr932-repair/.test(x)));
 assert.equal(git('ls-files','src/routes/test-04qrw-pr932-repair','src/routes/test-dev-amount-ui'),'');
});
for(const m of ['open','backupOriginal','listVerifiedTargets','stageTyped','undo','redo','exportEditedCopy']){
 test('stale '+m+' after dispatched operation / Close and A/B',async()=>{
  for(const replace of [false,true]){
   const entered=defer(),end=defer(),base=harness().adapter;let count=0;
   const value=m==='backupOriginal'?backup():m==='listVerifiedTargets'?{targets:[inv()],rawDocumentExposed:false}:m==='exportEditedCopy'?exported():ok({open:'OPEN',stageTyped:'STAGED',undo:'UNDONE',redo:'REDONE'}[m]);
   const {w,calls}=harness({[m]:async()=>{if(++count===1){entered.resolve();await end.promise;return value}return m==='open'?ok('OPEN'):m==='backupOriginal'?backup(args('B.p1g','b',65)):value}});
   await prepare(w,m);const p=op(w,m),denied=assert.rejects(p,/STALE_FILE_OR_CLOSE/);await entered.promise;
   if(replace)await assert.rejects(w.open(args('B.p1g','b',65)),/PENDING_OPERATION/);else await w.close();
   closed(w);const before=calls.length;end.resolve();await denied;closed(w);
   assert.equal(calls.length,before,'stale result must not trigger later adapter operation');
   await w.open(args('B.p1g','b',65));assert.equal(w.snapshot().fileName,'B.p1g');await w.close();
  }
  console.log('QRW932_REPAIR_STALE_PASS',m);
 });
}
test('source/backup identity rejects boolean-only and malformed receipt before list',async()=>{
 const a=args('A.p1g','a',64);
 for(const patch of [{originalName:'B.p1g'},{originalSha256:'b'.repeat(64)},{originalSizeBytes:65},{backupName:'A.p1g'},{backupName:'a.p1g'},{backupName:'../B.p1g'},{backupReadbackVerified:false},{sizeMatched:false},{rawDocument:'fake'}]){
  const {w,calls}=harness({backupOriginal:async()=>({...backup(a),...patch})});await w.open(a);await assert.rejects(w.backupAndRead());closed(w);assert.ok(!calls.includes('listVerifiedTargets'));
 }
 const {w,calls}=harness({backupOriginal:async()=>({backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true})});await w.open(a);await assert.rejects(w.backupAndRead());closed(w);assert.ok(!calls.includes('listVerifiedTargets'));
});
test('NFC Kelvin canonical alias and three filenames; backup binding cannot change',async()=>{
 for(const [name,bname] of [['K.p1g','K.p1g'],['Café.p1g','Cafe\u0301.p1g'],['A.p1g','a.p1g']]){
  const a=args(name),{w,calls}=harness({backupOriginal:async()=>backup(a,bname)});await w.open(a);await assert.rejects(w.backupAndRead());assert.ok(!calls.includes('listVerifiedTargets'));closed(w);
 }
 for(const patch of [{backupName:'Other.p1g'},{backupName:'backup.p1g'},{editedCopyName:'BACKUP.p1g'},{editedCopyName:'a.p1g'},{editedCopyName:'../Edited.p1g'},{independentProcessReopenVerified:true}]){
  const {w}=harness({exportEditedCopy:async()=>({...exported(),...patch})});await w.open(args());await w.backupAndRead();await w.stage(0,49);await assert.rejects(w.exportEditedCopy());closed(w);
 }
 const a=args('K.p1g'),{w}=harness({backupOriginal:async()=>backup(a),exportEditedCopy:async()=>({...exported(),editedCopyName:'k.p1g'})});await w.open(a);await w.backupAndRead();await w.stage(0,49);await assert.rejects(w.exportEditedCopy());closed(w);
});
test('both typed commands, old Rust bound and all protected enum8, non-authoritative',async()=>{
 for(const t of [inv(),chest()]){
  assert.equal(createExistingAmountDecrease({...t,oldAmount:9999},9998).newAmount,9998);
  for(const p of [{oldAmount:10000},{itemId:0},{targetId:0},{registryVerified:false},{sourceVerified:false},{rightsAllowed:false},{compatibleItemType:7}])assert.throws(()=>createExistingAmountDecrease({...t,...p},1));
  for(const n of [0,-1,t.oldAmount,t.oldAmount+1,1.5])assert.throws(()=>createExistingAmountDecrease(t,n));
 }
 for(const v of ['Premium','DLC','Entitlement','Receipt','Auth','Currency','Moonstone','Quest'])assert.throws(()=>createExistingAmountDecrease({...inv(),compatibleItemType:'ItemType_'+v},49));
 for(const i of [0,1]){const {w}=harness();await w.open(args());await w.backupAndRead();await w.stage(i,i?11:49);await w.undo();await w.redo();await w.exportEditedCopy();assert.equal(w.snapshot().editedCopy.name,'Edited.p1g');await assert.rejects(w.exportEditedCopy());}
});
test('RPC replay pending/busy/close watermark and stale reply deny',async()=>{
 const entered=defer(),end=defer(),calls=[],replies=[],p={postMessage:v=>replies.push(v)};
 installLocalDevAmountWorker(p,{async open(){calls.push('open');entered.resolve();await end.promise;return ok('OPEN')},async close(){calls.push('close');return ok('CLOSED')},async undo(){calls.push('undo');return ok('UNDONE')}});
 const send=(id,method,args=[])=>p.onmessage({data:{id,method,args}});
 const a=send(7,'open',[{}]);await entered.promise;await send(7,'open',[{}]);await send(8,'undo');await send(9,'close');await send(7,'open',[{}]);await send(8,'undo');end.resolve();await a;
 assert.deepEqual(calls,['open','close']);assert.ok(replies.filter(x=>x.id===7||x.id===8).every(x=>!x.ok));await send(10,'undo');await send(10,'undo');assert.deepEqual(calls,['open','close','undo']);
});
test('RPC Close in-flight must not admit another sensitive request or publish old close over new open',async()=>{
 const entered=defer(),end=defer(),calls=[],replies=[],p={postMessage:v=>replies.push(v)};
 installLocalDevAmountWorker(p,{async close(){calls.push('close');entered.resolve();await end.promise;return ok('CLOSED')},async open(){calls.push('open');return ok('OPEN')}});
 const send=(id,method,args=[])=>p.onmessage({data:{id,method,args}});
 const c=send(1,'close');await entered.promise;await send(2,'open',[{}]);end.resolve();await c;
 console.log('QRW932_REPAIR_CLOSE_OVERLAP',JSON.stringify({calls,replies}));
 assert.deepEqual(calls,['close'],'new open invoked while asynchronous close still pending');
 assert.equal(replies.find(r=>r.id===2).ok,false);
 await send(3,'open',[{}]);assert.deepEqual(calls,['close','open']);
});
test('client duplicate response ignored and malformed receipt rejected',async()=>{
 const sent=[],worker={postMessage:v=>sent.push(v),terminate(){}};const p=createLocalAmountDevPort(worker);
 const a=p.open(args());worker.onmessage({data:{id:sent[0].id,ok:true,data:ok('OPEN')}});await a;
 const b=p.close();worker.onmessage({data:{id:sent[0].id,ok:true,data:ok('OPEN')}});
 worker.onmessage({data:{id:sent[1].id,ok:true,data:ok('CLOSED'),extra:true}});await assert.rejects(b);p.dispose();
});
