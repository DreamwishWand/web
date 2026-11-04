// 05 QR independent PR451 composed actual JS Worker, SYNTHETIC encrypted P1G only.
// Tests NEW Worker W1 source 8 + same PR394 session and deny unused Consumer domains,
// not repeating PR394 full 100/200MiB/Backup/Preview test.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
if(!process.env.CHROME_BIN)throw Error('QA_CHROME_BIN_REQUIRED');
const root=(process.env.QR451_URL||'http://127.0.0.1:4287').replace(/\/$/,'');
const mode=process.env.QR451_MODE||'dev',BID='9A239D3DB569756D';
const OLD='2126-08-20T00:00:00Z';
const doc=(date=OLD,all=true)=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{Opaque:'QA-SYNTHETIC-NO-CLOUD'},
 World:{Villages:[],
  GridCollection:{Grids:{},...(all?{DiffGrids:{}}:{})},
  RecurringEvents:{'155':{ItemSpawning:{
   RecurringEventItemID:2010000021,NextOccurrence:date,
   LastOccurrence:'2026-10-01T00:00:00Z',
   ...(all?{EndDate:'2030-12-31T00:00:00Z'}:{})
  }}},
  FutureUnknown:'preserve'}
});
const p1g=obj=>Buffer.from(makeSyntheticP1gProfile(obj));
const sha=b=>createHash('sha256').update(b).digest('hex');
const a=p1g(doc()),b=p1g(doc('2026-11-04T00:00:00Z',false));
const r={schema:'05qr.pr451.actual-worker-composed@1',source:'2b9fbe702c66a0da46ed5b621fc4fec8df296bad',
 mode,fixture:'SYNTHETIC_ONLY',checks:[],network:[],errors:[],result:'PENDING',
 privateRealP1g:'NOT_RUN',nativeV3:'NOT_ACCEPTED',writer:'OFF'};
const pass=name=>r.checks.push(name);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:850}});
 const page=await ctx.newPage();
 await page.addInitScript(()=>{
  const Original=globalThis.Worker;globalThis.__qr451workers=[];
  globalThis.Worker=class extends Original {
   constructor(...args){super(...args);globalThis.__qr451workers.push(this);}
  };
 });
 ctx.on('request',req=>{
  const u=new URL(req.url());
  if(req.method()!=='GET'||u.origin!==new URL(root).origin)
   r.network.push({method:req.method(),origin:u.origin});
 });
 page.on('pageerror',e=>r.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text());});
 await page.goto(root+'/editor/timing/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('[data-worker-ready="true"]').waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>globalThis.__qr451workers.length),1);
 const worker=page.workers()[0];assert.ok(worker);
 await page.locator('#timing-bid').fill(BID);
 await page.locator('.attest input').check();
 const upload=buf=>page.locator('#timing-file').setInputFiles({
  name:'qa451-synthetic-encrypted.p1g',mimeType:'application/octet-stream',buffer:buf});
 const loaded=txt=>page.waitForFunction(text=>
  document.querySelector('[data-timing-loaded="true"]')?.textContent?.includes(text),
  txt,{timeout:90000});
 await upload(a);await loaded(OLD);
 assert.equal(await page.locator('[data-w1-source-sha] code').innerText(),sha(a));
 pass('REAL_ENCRYPTED_SYNTHETIC_P1G_WORKER_READ_AND_SOURCE_SHA');
 let id=810000;
 const probe=(type,extra={})=>page.evaluate(({type,id,extra})=>new Promise((resolve,reject)=>{
  const w=globalThis.__qr451workers[0];
  const timer=setTimeout(()=>{w.removeEventListener('message',on);reject(Error('WORKER_TIMEOUT'));},23000);
  const on=e=>{if(e.data?.id!==id)return;clearTimeout(timer);w.removeEventListener('message',on);resolve(e.data)};
  w.addEventListener('message',on);w.postMessage({id,type,...extra});
 }),{type,id:++id,extra});
 const diagA=await probe('DIAGNOSE_W1');
 assert.equal(diagA.ok,true);
 const d=diagA.result;
 assert.equal(d.referenceCount,8);assert.equal(d.presentCount,8);
 assert.equal(d.allSourceReferencesPresent,true);
 assert.deepEqual(d.missingReferences,[]);
 assert.equal(d.sourceSha256,sha(a));
 assert.equal(d.registrySha256,undefined,'DIAGNOSE exposes only bounded source references; Worker-issued RegistrySHA belongs to OPEN receipt');
 assert.equal(d.revision,0);assert.ok(d.indexGeneration>=1);
 assert.equal(d.writerAuthorized,false);
 assert.equal(d.productRustWorkerAccepted,false);
 assert.equal(d.operationWriterAuthorized,false);
 assert.equal(d.completeNativeDependencyClosureVerified,false);
 assert.equal(JSON.stringify(d).includes(OLD),false);
 assert.equal(JSON.stringify(d).includes('Opaque'),false);
 pass('WORKER_EIGHT_CORE_DERIVED_REF_SOURCE_AND_REGISTRY_SHA_NO_RAW_DATA');
 const stale=await probe('DIAGNOSE_W1',{
  sessionId:'FORGED',sourceSha256:'0'.repeat(64),
  nativeAccepted:true,sourceReadSet:[]});
 assert.equal(stale.ok,false);
 assert.equal(stale.error,'READ_FORGED_DIAGNOSTIC_REQUEST');
 pass('FORGED_DIAGNOSE_W1_CALLER_REF_AND_SOURCE_DENIED');
 for(const type of ['READ_INVENTORY','READ_OWNERSHIP','READ_GRID','EXPORT_EDITED_COPY','STAGE_COMMAND']){
  const x=await probe(type);
  assert.equal(x.ok,false);
  assert.equal(x.error,'READ_WRITER_OPERATION_DISABLED');
 }
 assert.equal(await page.locator('[data-writer="off"]').count(),1,'W1 Editor must retain writer OFF even without any active Preview');
 pass('UNACCEPTED_COLLECTION_WORLD_AND_WRITER_WORKER_TYPES_FAILCLOSED');
 await upload(b);await loaded('2026-11-04T00:00:00Z');
 assert.equal(page.workers()[0],worker);
 assert.equal(await page.evaluate(()=>globalThis.__qr451workers.length),1);
 const diagB=await probe('DIAGNOSE_W1');
 assert.equal(diagB.ok,true);
 assert.equal(diagB.result.presentCount,6);
 assert.equal(diagB.result.allSourceReferencesPresent,false);
 assert.ok(diagB.result.missingReferences.includes('World.GridCollection.DiffGrids'));
 assert.ok(diagB.result.missingReferences.some(s=>s.endsWith('EndDate')));
 assert.equal(diagB.result.operationWriterAuthorized,false);
 assert.equal(diagB.result.sourceSha256,sha(b));
 assert.notEqual(diagB.result.sourceSha256,d.sourceSha256);
 assert.notEqual(diagB.result.sessionId,d.sessionId);
 assert.ok(!(await page.locator('[data-timing-loaded=true]').innerText()).includes(OLD));
 pass('A_TO_B_REVOKES_W1_DIAGNOSIS_AND_MISSING_NATIVE_REFS_DO_NOT_HALT_READ');
 assert.deepEqual(r.network,[],'No external upload request observed on local file workflow');
 assert.deepEqual(r.errors,[],'No JS errors');
 r.result='PASS';
 await ctx.close();
} catch(e){r.result='FAIL';r.error=String(e?.stack||e);}
finally{
 await mkdir('.artifacts/05qr-pr451',{recursive:true});
 await writeFile('.artifacts/05qr-pr451/'+mode+'.json',JSON.stringify(r,null,2));
 await browser.close();
}
console.log(JSON.stringify({mode,result:r.result,checks:r.checks,error:r.error||null}));
if(r.result!=='PASS')process.exitCode=1;
