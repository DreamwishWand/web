// 05 QR PR383 INDEPENDENT real Chromium Vite+static Pages /web, synthetic P1G only.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
if(!process.env.CHROME_BIN)throw Error('QA_CHROME_BIN_REQUIRED');
const root=(process.env.QR383_URL||'http://127.0.0.1:4237').replace(/\/$/,'');
const mode=process.env.QR383_MODE||'dev',heavy=process.env.QR383_HEAVY==='1';
const BID='9A239D3DB569756D',OLD='2126-08-20T00:00:00Z';
const profile=(time=OLD,pad=0,count=2)=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{UnknownOpaque:'PRIVATE_SYNTHETIC_ONLY'},
 World:{Villages:[],GridCollection:{Grids:{}},
  RecurringEvents:Object.fromEntries(Array.from({length:count},(_,i)=>[
   String(i===0?155:i===1?156:i),{
    ItemSpawning:{RecurringEventItemID:i===1?2010500008:2010000021,
     NextOccurrence:i===0?time:'2026-01-01T00:00:00Z',
     LastOccurrence:'2026-10-01T00:00:00Z'}
   }])),
  FutureUnknown:pad?'X'.repeat(pad):'not uploaded'}
});
const p1g=v=>Buffer.from(makeSyntheticP1gProfile(v));
const sha=v=>createHash('sha256').update(v).digest('hex');
const A=p1g(profile()), B=p1g(profile('2024-12-31T12:34:56Z'));
const report={schema:'05qr.pr383.independent-synthetic-actual-chromium@1',
 mode,source:'71fc785a88d85a25e691b907aeda12e20f0d8a87',
 result:'PENDING',realSave:'NOT_RUN',memory:[],checks:[],outbound:[],errors:[]};
const pass=name=>report.checks.push({name,result:'PASS'});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-precise-memory-info']});
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:850}});
 const page=await ctx.newPage();
 await page.addInitScript(()=>{
  const Original=globalThis.Worker;
  globalThis.__qa383Workers=[];
  globalThis.Worker=class extends Original{
   constructor(...a){super(...a);globalThis.__qa383Workers.push(this);}
  };
 });
 ctx.on('request',req=>{
  const u=new URL(req.url());
  if(req.method()!=='GET' || u.origin!==new URL(root).origin)
   report.outbound.push({kind:req.resourceType(),method:req.method(),host:u.host});
 });
 page.on('pageerror',err=>report.errors.push(String(err)));
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
 await page.goto(root+'/editor/timing/',{waitUntil:'domcontentloaded',timeout:40000});
 await page.locator('[data-worker-ready="true"]').waitFor({timeout:22000});
 assert.equal(await page.locator('[data-writer="off"]').count(),1);
 assert.equal(await page.evaluate(()=>globalThis.__qa383Workers.length),1);
 const worker=page.workers()[0];assert.ok(worker);
 await page.locator('#timing-bid').fill(BID);
 await page.locator('.attest input').check();
 const upload=async buffer=>page.locator('#timing-file').setInputFiles({
  name:'qr383-synthetic.p1g',mimeType:'application/octet-stream',buffer
 });
 const waitText=async value=>page.waitForFunction(value=>
  document.querySelector('[data-timing-loaded="true"]')?.textContent?.includes(value),
  value,{timeout:95000});
 await upload(A);await waitText(OLD);
 assert.equal(await page.locator('.event').count(),2);
 pass('LOCAL_FILE_WORKER_PACKAGED_SCHEMA626_READ');
 const probe=msg=>page.evaluate(msg=>new Promise((resolve,reject)=>{
  const w=globalThis.__qa383Workers[0];
  const timer=setTimeout(()=>{w.removeEventListener('message',onMessage);reject(Error('WORKER_RESPONSE_TIMEOUT'));},25000);
  const onMessage=e=>{if(e.data?.id!==msg.id)return;
   clearTimeout(timer);w.removeEventListener('message',onMessage);resolve(e.data);};
  w.addEventListener('message',onMessage);w.postMessage(msg);
 }),msg);
 let id=800000;
 const row1=await probe({id:++id,type:'QUERY',search:'',cursor:null,limit:1});
 assert.equal(row1.ok,true);
 assert.equal(row1.result.rows.length,1);
 assert.ok(row1.result.nextCursor?.startsWith('w1r1.'));
 const spoof=await probe({id:++id,type:'QUERY',search:'',cursor:'w1r1.1.'+'a'.repeat(64),limit:1});
 assert.equal(spoof.ok,false);assert.match(spoof.error,/^READ_CURSOR_/);
 const row2=await probe({id:++id,type:'QUERY',search:'',cursor:row1.result.nextCursor,limit:1});
 assert.equal(row2.ok,true);
 assert.equal(row2.result.complete,true);
 const replay=await probe({id:++id,type:'QUERY',search:'',cursor:row1.result.nextCursor,limit:1});
 assert.equal(replay.ok,false);assert.match(replay.error,/^READ_CURSOR_/);
 const falseComplete=await probe({id:++id,type:'QUERY',search:'',cursor:null,limit:1,
  complete:true,sessionId:'UI-FORGED',revision:999});
 assert.equal(falseComplete.ok,false);assert.equal(falseComplete.error,'READ_FORGED_QUERY_REQUEST');
 const denied=await probe({id:++id,type:'EXPORT_EDITED_COPY'});
 assert.equal(denied.ok,false);assert.equal(denied.error,'READ_WRITER_OPERATION_DISABLED');
 pass('REAL_WORKER_CURSOR_HMAC_SPOOF_REPLAY_AND_EDIT_COMMAND_FAILCLOSED');

 // SPA route navigates without destroying one underlying Worker.
 const nav=page.locator('.timing-page > a[href$="/editor/"]');
 await nav.click();await page.waitForURL('**/editor/',{timeout:18000});
 await page.goBack({waitUntil:'domcontentloaded'});
 await page.locator('[data-worker-ready="true"]').waitFor({timeout:18000});
 await waitText(OLD);
 assert.equal(page.workers()[0],worker);
 assert.equal(await page.evaluate(()=>globalThis.__qa383Workers.length),1);
 pass('SPA_ROUTES_RETAIN_SINGLE_WORKER_AND_SESSION_READ');

 // Reattestation of B is required; revoke A and old cursor.
 await page.locator('#timing-bid').fill(BID);
 await page.locator('.attest input').check();
 await upload(B);await waitText('2024-12-31T12:34:56Z');
 assert.ok(!(await page.locator('[data-timing-loaded="true"]').innerText()).includes(OLD));
 const old=await probe({id:++id,type:'QUERY',search:'',cursor:row1.result.nextCursor,limit:1});
 assert.equal(old.ok,false);assert.match(old.error,/^READ_CURSOR_/);
 assert.notEqual(sha(B),sha(A));
 pass('A_TO_B_OLD_CURSOR_INVALID_AND_ORIGINAL_SHA_STABLE');

 const many=p1g(profile(OLD,0,73));
 await upload(many);
 await page.waitForFunction(()=>document.querySelectorAll('[data-timing-loaded="true"] article.event').length===64,null,{timeout:30000});
 await page.locator('[data-timing-more]').click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-timing-loaded="true"] article.event').length===73,null,{timeout:30000});
 pass('SESSION_73_EVENTS_64_PLUS_9');

 await page.locator('#timing-bid').fill('0000000000000000');await upload(A);
 await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor({timeout:20000});
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 await page.locator('#timing-bid').fill(BID);
 await page.locator('.attest input').uncheck();await upload(A);
 await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor({timeout:20000});
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 await page.locator('.attest input').check();
 await upload(Buffer.alloc(80));
 await page.locator('.timing-page [role="alert"] code').waitFor({timeout:30000});
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 pass('BID_ATTESTATION_AND_CORRUPT_P1G_FAIL_CLOSED');

 if(heavy)for(const size of [100,200]){
  const cipher=p1g(profile(OLD,size*1024*1024));
  const start=Date.now();
  await upload(cipher);
  if(size===100){
   await page.locator('[data-timing-loaded="true"] .event').first().waitFor({timeout:150000});
   assert.ok((await page.locator('[data-timing-loaded="true"]').innerText()).includes(OLD));
   report.memory.push({expandedMiB:100,result:'SYNTHETIC_READ_PASS',
    elapsedMs:Date.now()-start,cipherBytes:cipher.length,
    mainJsHeapSpotBytes:await page.evaluate(()=>performance.memory?.usedJSHeapSize??null),
    workerPeakNotMeasured:true});
   pass('100MIB_SYNTHETIC_EXPANDED_READ_ONLY');
  }else{
   await page.locator('.timing-page [role="alert"] code').waitFor({timeout:150000});
   assert.equal(await page.locator('[data-timing-loaded]').count(),0);
   report.memory.push({expandedMiB:200,result:'DENIED_JS_CODEC_128MIB_EXPANDED_CAP',
    elapsedMs:Date.now()-start,cipherBytes:cipher.length,workerPeakNotMeasured:true});
   pass('200MIB_SYNTHETIC_EXPANDED_DENIED_NOT_SUPPORTED');
  }
 }
 assert.equal(sha(A),sha(Buffer.from(makeSyntheticP1gProfile(profile()))));
 assert.deepEqual(report.outbound,[],'no nonGET or off-origin transfer');
 assert.deepEqual(report.errors,[],'no browser runtime errors');
 pass('NO_SAVE_UPLOAD_OBSERVED_WRITER_OFF');
 report.result='PASS';
 await ctx.close();
}catch(e){report.result='FAIL';report.error=String(e?.stack||e);}
finally{
 await mkdir('.artifacts/05qr-pr383',{recursive:true});
 await writeFile('.artifacts/05qr-pr383/'+mode+'.json',JSON.stringify(report,null,2));
 await browser.close();
}
console.log(JSON.stringify({mode,result:report.result,checks:report.checks.map(x=>x.name),
 memory:report.memory,error:report.error||null}));
if(report.result!=='PASS')process.exitCode=1;
