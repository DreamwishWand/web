// Independent PR932 Node adversarial QA. MOCK-only, no P1G crypto or Rust rerun.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createLocalAmountDevWorkflow,createExistingAmountDecrease,STEAM626_FULL_VERSION} from '../src/lib/dev/local-amount-workflow.mjs';
import {createLocalAmountDevPort,installLocalDevAmountWorker} from '../src/lib/dev/local-amount-worker-adapter.mjs';
import {DEV_AMOUNT_UI_LOCALES,localAmountCopy} from '../src/lib/dev/local-amount-copy.mjs';
const SOURCE='0a18bfb01f3c614f85d4d6c2cde223cfa6247d67',FORK='406ac11f2d9252f619b7489e61e063f19a9adba4';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const files={
 '.github/workflows/08web-local-dev-amount-ui-chrome.yml':'cf5e83719c1227c293ca4ac20055f0b49ba6c266',
 'src/lib/dev/LocalAmountEditorDev.svelte':'b16b8be855de48d132632ef26d05ddc07e52de42',
 'src/lib/dev/local-amount-codec-reopen.worker.mjs':'955d95056d4c115b24b77db2ec2f31ef90992882',
 'src/lib/dev/local-amount-copy.mjs':'64af6322420e7858d9f58acc62ab515b3aff791e',
 'src/lib/dev/local-amount-worker-adapter.mjs':'d5eb2d009c6ee3a41bb2b16eba61970a5c79a75b',
 'src/lib/dev/local-amount-workflow.mjs':'db998c9ef9fbb7d0366f37fc83363274bde29fc3',
 'tests/dev-amount-ui-chrome/chrome-smoke.mjs':'0276f786a18890233e272427e5c439c54a2fee5b',
 'tests/dev-amount-ui-chrome/ci-only-route.svelte':'228c163e8ca7613becf6ccc8f71928826b833879',
 'tests/web-local-dev-amount-worker-port.test.mjs':'525182725c0cbb4de73ed806f10b261377bc90fc',
 'tests/web-local-dev-amount-workflow.test.mjs':'e799328dc6826e6c883b94d47a2f2e6bea3b7a7b'};
const audits=['scripts/04qr-w-pr932-local-amount-node-20261112.mjs','scripts/04qr-w-pr932-local-amount-chrome-20261112.mjs','.github/workflows/04qr-w-pr932-local-amount-independent-20261112.yml'];
const ok=kind=>({kind,ok:true,writerAuthorized:false,nativeV3Verified:false,originalOverwriteAuthorized:false});
const inv=()=>({kind:'InventoryExistingAmountDecrease',targetId:4,itemId:30000001,slotIndex:0,compatibleItemType:'ItemType_Ingredient',oldAmount:50,registryVerified:true,sourceVerified:true,rightsAllowed:true});
const chest=()=>({kind:'ChestExistingSlotAmountDecrease',targetId:12,itemId:30000002,slotIndex:1,compatibleItemType:null,oldAmount:12,registryVerified:true,sourceVerified:true,rightsAllowed:true});
const args=(name='A.p1g')=>({file:{name,size:64},fullVersion:STEAM626_FULL_VERSION,originalSha256:'a'.repeat(64),buildConfirmed:true});
const backup=()=>({backupReadbackVerified:true,originalUnchanged:true,shaMatched:true,sizeMatched:true,separateName:true});
const exported=()=>({...ok('EXPORTED'),editedCopyName:'edited-B.p1g',backupName:'backup-A.p1g',editedCiphertextVerified:true,freshWorkerReopenVerified:true,independentProcessReopenVerified:false,originalUnchanged:true});
function harness(overrides={}){
 const calls=[];
 const adapter={async open(v){calls.push(['open',v.file.name]);return ok('OPEN')},async backupOriginal(){calls.push(['backup']);return backup()},
 async listVerifiedTargets(){calls.push(['targets']);return{targets:[inv(),chest()],rawDocumentExposed:false}},
 async stageTyped(v){calls.push(['stage',v]);return ok('STAGED')},async undo(){calls.push(['undo']);return ok('UNDONE')},async redo(){calls.push(['redo']);return ok('REDONE')},
 async exportEditedCopy(){calls.push(['export']);return exported()},async close(){calls.push(['close']);return ok('CLOSED')},...overrides};
 return {adapter,calls,w:createLocalAmountDevWorkflow(adapter,{trustedLocalHarness:true})};
}
async function ready(w){await w.open(args());await w.backupAndRead()}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
test('exact original 10 ADD, independent QA-only paths, no committed DEV route',()=>{
 assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
 assert.deepEqual(git('diff','--name-status',FORK,SOURCE).split('\n').sort(),Object.keys(files).map(p=>'A\t'+p).sort());
 for(const [p,h]of Object.entries(files))assert.equal(git('rev-parse',SOURCE+':'+p),h);
 assert.deepEqual(git('diff','--name-status',SOURCE,'HEAD').split('\n').sort(),audits.map(p=>'A\t'+p).sort());
 assert.equal(git('ls-files','src/routes/test-dev-amount-ui','src/routes/test-04qrw-pr932'), '');
 assert.throws(()=>createLocalAmountDevWorkflow(harness().adapter));
 console.log('QRW932_SOURCE10_QA3_OFF_ROUTE_PIN_PASS');
});
test('all 8 locales safety text and command shape both domains, no authority',()=>{
 assert.deepEqual([...DEV_AMOUNT_UI_LOCALES].sort(),['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'].sort());
 for(const l of DEV_AMOUNT_UI_LOCALES){const w=localAmountCopy(l);for(const k of ['title','intro','file','sha','confirm','backup','stage','undo','redo','export','done','failed','note'])assert.ok(w[k],l+':'+k)}
 assert.deepEqual(createExistingAmountDecrease(inv(),49),{kind:inv().kind,inventoryId:4,canonicalItemId:30000001,compatibleItemType:'ItemType_Ingredient',expectedOldAmount:50,newAmount:49});
 assert.deepEqual(createExistingAmountDecrease(chest(),11),{kind:chest().kind,containerId:12,slotIndex:1,expectedItemId:30000002,expectedOldAmount:12,newAmount:11});
});
test('manual flow both Inventory and Chest, only one stage, undo/redo and export',async()=>{
 for(const [i,next,old]of [[0,49,50],[1,11,12]]){
  const {w,calls}=harness();await assert.rejects(w.stage(i,next));await w.open(args());await assert.rejects(w.stage(i,next));await w.backupAndRead();
  await w.stage(i,next);assert.equal(w.snapshot().preview.oldAmount,old);assert.equal(w.snapshot().preview.newAmount,next);
  await assert.rejects(w.stage(i,next));await w.undo();await assert.rejects(w.exportEditedCopy());await w.redo();await w.exportEditedCopy();
  assert.equal(w.snapshot().editedCopy.independentProcessReopenVerified,false);
  await assert.rejects(w.exportEditedCopy());await w.close();assert.equal(w.snapshot().phase,'closed');
  assert.deepEqual(calls.filter(c=>c[0]!=='close').map(c=>c[0]),['open','backup','targets','stage','undo','redo','export']);
 }
});
test('wrong build, SHA, fake ID, rights, numeric enum, invalid quantities, forged receipt shapes deny',async()=>{
 for(const a of [{...args(),fullVersion:'Switch-1.25.3'},{...args(),originalSha256:'0'},{...args(),buildConfirmed:false},{...args(),file:{name:'x.json',size:64}}])await assert.rejects(harness().w.open(a));
 for(const patch of [{itemId:0},{registryVerified:false},{sourceVerified:false},{rightsAllowed:false},{compatibleItemType:4}])assert.throws(()=>createExistingAmountDecrease({...inv(),...patch},49));
 for(const v of [0,50,51,-1,1.5,4294967296])assert.throws(()=>createExistingAmountDecrease(inv(),v));
 for(const patch of [{writerAuthorized:true},{nativeV3Verified:true},{originalOverwriteAuthorized:true},{sessionId:'FORGED'}]){
  const {w}=harness({open:async()=>({...ok('OPEN'),...patch})});await assert.rejects(w.open(args()));assert.equal(w.snapshot().phase,'closed');
 }
 const a=harness({backupOriginal:async()=>({...backup(),shaMatched:false})}).w;await a.open(args());await assert.rejects(a.backupAndRead());assert.equal(a.snapshot().phase,'closed');
 const b=harness({stageTyped:async()=>({...ok('STAGED'),kind:'OPEN'})}).w;await ready(b);await assert.rejects(b.stage(0,49));assert.equal(b.snapshot().phase,'closed');
 for(const patch of [{editedCopyName:'A.p1g'},{editedCopyName:'backup-A.p1g'},{editedCopyName:'../bad.p1g'},{independentProcessReopenVerified:true},{freshWorkerReopenVerified:false},{originalUnchanged:false}]){
  const {w}=harness({exportEditedCopy:async()=>({...exported(),...patch})});await ready(w);await w.stage(0,49);await assert.rejects(w.exportEditedCopy());assert.equal(w.snapshot().phase,'closed');
 }
 console.log('QRW932_ORDINARY_RECEIPT_AND_RIGHTS_NEGATIVES_PASS');
});
// Crucial independent concurrency test: wait until the Worker actually receives
// OPEN before Close, unlike closing before the pre-open await has settled.
test('RED guard: late in-flight OPEN after Close cannot restore opened state',async()=>{
 const entered=deferred(),finish=deferred();
 const {w}=harness({open:async()=>{entered.resolve();await finish.promise;return ok('OPEN')}});
 const a=w.open(args());const denied=assert.rejects(a,/STALE_FILE_OR_CLOSE/);
 await entered.promise;await w.close();assert.equal(w.snapshot().phase,'closed');finish.resolve();await denied;
 const s=w.snapshot();console.log('QRW932_LATE_OPEN_AFTER_CLOSE',JSON.stringify(s));
 assert.equal(s.phase,'closed','late receipt must not commit state before epoch check');
});
test('RED guard: late A OPEN after rejected B selection never resurrects A',async()=>{
 const entered=deferred(),finish=deferred();
 const {w}=harness({open:async()=>{entered.resolve();await finish.promise;return ok('OPEN')}});
 const a=w.open(args());const denied=assert.rejects(a,/STALE_FILE_OR_CLOSE/);await entered.promise;
 await assert.rejects(w.open(args('B.p1g')),/PENDING_OPERATION/);
 finish.resolve();await denied;const s=w.snapshot();
 console.log('QRW932_STALE_A_AFTER_B',JSON.stringify(s));assert.equal(s.phase,'closed');assert.equal(s.fileName,'');
});
test('RED guard: late Backup/read completion after Close must not expose A targets',async()=>{
 const entered=deferred(),finish=deferred();
 const {w}=harness({listVerifiedTargets:async()=>{entered.resolve();await finish.promise;return{targets:[inv()],rawDocumentExposed:false}}});
 await w.open(args());const a=w.backupAndRead(),denied=assert.rejects(a,/STALE_FILE_OR_CLOSE/);
 await entered.promise;await w.close();finish.resolve();await denied;
 const s=w.snapshot();console.log('QRW932_LATE_TARGETS_AFTER_CLOSE',JSON.stringify(s));assert.equal(s.phase,'closed');assert.equal(s.targets.length,0);assert.equal(s.backupVerified,false);
});
test('RED guard: late Stage receipt after Close must not restore preview',async()=>{
 const entered=deferred(),finish=deferred();
 const {w}=harness({stageTyped:async()=>{entered.resolve();await finish.promise;return ok('STAGED')}});
 await ready(w);const a=w.stage(0,49),denied=assert.rejects(a,/STALE_FILE_OR_CLOSE/);
 await entered.promise;await w.close();finish.resolve();await denied;
 const s=w.snapshot();console.log('QRW932_LATE_STAGE_AFTER_CLOSE',JSON.stringify(s));assert.equal(s.phase,'closed');assert.equal(s.preview,null);
});
test('RED guard: late Export receipt after Close must not restore exported UI',async()=>{
 const entered=deferred(),finish=deferred();
 const {w}=harness({exportEditedCopy:async()=>{entered.resolve();await finish.promise;return exported()}});
 await ready(w);await w.stage(0,49);const a=w.exportEditedCopy(),denied=assert.rejects(a,/STALE_FILE_OR_CLOSE/);
 await entered.promise;await w.close();finish.resolve();await denied;
 const s=w.snapshot();console.log('QRW932_LATE_EXPORT_AFTER_CLOSE',JSON.stringify(s));assert.equal(s.phase,'closed');assert.equal(s.editedCopy,null);
});
test('RED guard: forged export receipt must reject backup name equal to original',async()=>{
 const {w}=harness({exportEditedCopy:async()=>({...exported(),backupName:'A.p1g'})});
 await ready(w);await w.stage(0,49);
 let denied=false;try{await w.exportEditedCopy()}catch{denied=true}
 console.log('QRW932_ORIGINAL_BACKUP_NAME_ALIAS',JSON.stringify({denied,state:w.snapshot()}));
 assert.equal(denied,true,'backup and original must have separate names');
});
test('RED guard: duplicate request id must not execute Worker RPC twice',async()=>{
 const replies=[],calls=[];const p={postMessage:r=>replies.push(r)};
 installLocalDevAmountWorker(p,{async open(a){calls.push(a);return ok('OPEN')}});
 const request={id:7,method:'open',args:[args()]};await p.onmessage({data:request});await p.onmessage({data:request});
 console.log('QRW932_REPLAY_REQUEST_ID',JSON.stringify({calls:calls.length,replies}));
 assert.equal(calls.length,1,'duplicate request ID must not run open twice');
 assert.equal(replies[1].ok,false);
});
test('duplicate response ID ignored and malformed reply rejected by client port',async()=>{
 const sent=[];const worker={postMessage:v=>sent.push(v),terminate(){}};
 const p=createLocalAmountDevPort(worker);const a=p.open(args());const id=sent[0].id;
 worker.onmessage({data:{id,ok:true,data:ok('OPEN')}});assert.equal((await a).kind,'OPEN');
 worker.onmessage({data:{id,ok:true,data:ok('OPEN')}});
 const b=p.backupOriginal();worker.onmessage({data:{id:sent[1].id,ok:true,data:backup(),rawJson:'FORGED'}});
 await assert.rejects(b,/DEV_WORKER_DENIED/);p.dispose();
});
test('RED guard: native protected enum and DEV amount bound cannot produce UI command',()=>{
 const cases=[{...inv(),compatibleItemType:'ItemType_Premium'},{...inv(),compatibleItemType:'ItemType_Currency'},{...inv(),oldAmount:10000}];
 const accepted=[];for(const t of cases){try{accepted.push(createExistingAmountDecrease(t,49))}catch{}}
 console.log('QRW932_PREFLIGHT_CORE_CONTRACT_MISMATCH',JSON.stringify(accepted));
 assert.deepEqual(accepted,[],'PR914/929 DEV protected enum and conservative oldAmount bound <=9999');
});
