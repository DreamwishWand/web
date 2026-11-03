// 05 QR independent PR361 real Chromium E2E, synthetic encrypted P1G ONLY.
// Same script tests Vite dev and adapter-static Pages /web; no real save or key in CI.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

const base=(process.env.QR361_BASE_URL||'http://127.0.0.1:4207').replace(/\/$/,'');
const mode=process.env.QR361_MODE||'dev';
const heavy=process.env.QR361_LARGE==='1';
const bid='9A239D3DB569756D';
const sum=b=>createHash('sha256').update(b).digest('hex');
const make=(future='2126-08-20T00:00:00Z',schema=626,padding=0,count=2)=>{
 const row=i=>({ItemSpawning:{
  RecurringEventItemID:i===0?2010000021:2010500008,
  NextOccurrence:i===0?future:'2025-01-01T00:00:00Z',
  LastOccurrence:'2026-10-01T00:00:00Z',
  ExtraUnmapped:{unchanged:true}
 }});
 return {
  GameInfo:{Version:schema,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
  Player:{Opaque:{preserve:'exact'}},
  World:{Villages:[],GridCollection:{Grids:{}},
   RecurringEvents:Object.fromEntries(Array.from({length:count},(_,i)=>[String(i===0?155:i===1?156:i),row(i)])),
   UnknownHuge:padding?'Z'.repeat(padding):'synthetic fixture'
  }
 };
};
const p1g=p=>Buffer.from(makeSyntheticP1gProfile(p));
const report={schema:'05qr-pr361-browser-independent@1',mode,sourceSha:'90c69118863cf7bab7ba6abb98d392b2bcac14d0',
 realSave:'NOT_RUN',checks:[],memory:[],networkWrites:[],outbound:[],browserErrors:[],result:'PENDING'};
const ok=(name,extra={})=>report.checks.push({name,result:'PASS',...extra});
const errors=report.browserErrors;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-precise-memory-info']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:850}});
 context.on('request',req=>{
  const u=new URL(req.url());
  if(req.method()!=='GET')report.networkWrites.push({method:req.method(),resourceType:req.resourceType(),host:u.host});
  if(u.origin!==new URL(base).origin && !['ws:','wss:'].includes(u.protocol))
   report.outbound.push({kind:req.resourceType(),host:u.host});
 });
 const page=await context.newPage();
 await page.addInitScript(()=>{
  const NativeWorker=globalThis.Worker;
  globalThis.__qr361Workers=[];
  globalThis.Worker=class extends NativeWorker{
   constructor(...args){super(...args);globalThis.__qr361Workers.push(this);}
  };
 });
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'/editor/timing/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('[data-worker-ready="true"]').waitFor({timeout:25000});
 assert.equal(await page.locator('[data-worker-readonly="true"][data-writer="off"]').count(),1);
 assert.ok((await page.workers()).length>0,'real browser Worker created');
 const count=await page.evaluate(()=>globalThis.__qr361Workers?.length||0);
 assert.ok(count>0,'browser Worker must be capturable for independent protocol probes');
 ok('ACTUAL_CHROME_MODULE_WORKER_READY');
 await page.locator('#timing-bid').fill(bid);
 await page.locator('.attest input').check();
 const upload=async b=>page.locator('#timing-file').setInputFiles({
  name:'qr361-synthetic.p1g',mimeType:'application/octet-stream',buffer:b
 });
 const waitRows=async n=>page.waitForFunction(n=>document.querySelectorAll('[data-timing-loaded="true"] article.event').length===n,n,{timeout:90000});
 const original=p1g(make());
 const originalHash=sum(original);
 await upload(original);
 await waitRows(2);
 assert.match(await page.locator('[data-timing-loaded="true"]').innerText(),/EventID: 2010000021/);
 assert.ok(await page.locator('[data-timing-loaded="true"]').innerText().then(t=>t.includes('2126-08-20T00:00:00Z')));
 ok('SYNTHETIC_ENCRYPTED_P1G_FILE_INPUT_CODEC_WORKER_SCHEMA626');
 await page.locator('#timing-search').fill('31700014');
 await page.locator('#timing-search').dispatchEvent('input');
 await waitRows(1);
 assert.match(await page.locator('[data-timing-loaded="true"]').innerText(),/ItemID 31700014/);
 ok('WORKER_FIXED_REGISTRY_508_ITEMID_SEARCH');
 await page.locator('#timing-search').fill('2010500008');
 await page.locator('#timing-search').dispatchEvent('input');
 await page.waitForFunction(() => {
  const rows=document.querySelectorAll('[data-timing-loaded="true"] .event');
  return rows.length===1 && rows[0].textContent.includes('EventID: 2010500008');
 },null,{timeout:20000});
 assert.match(await page.locator('[data-timing-loaded="true"]').innerText(),/EventID: 2010500008/);
 ok('EVENTID_SEARCH');
 // Probe Worker message boundary itself, not just input controls.
 // The Worker object is captured via browser init script; this is a REAL
 // module Worker receiving structuredClone messages, not a JS mock.
 let id=80000;
 const request=async msg=>page.evaluate(async msg=>{
  const w=globalThis.__qr361Workers[0];
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{w.removeEventListener('message',handler);reject(Error('worker probe timeout'));},20000);
   const handler=ev=>{
    if(ev.data?.id!==msg.id)return;
    clearTimeout(timer);w.removeEventListener('message',handler);resolve(ev.data);
   };
   w.addEventListener('message',handler);w.postMessage(msg);
  });
 },msg);
 const forged=await request({id:++id,type:'QUERY',search:'',cursor:'w1r1.1.'+'a'.repeat(64),limit:1});
 assert.equal(forged.ok,false);
 assert.match(forged.error,/^READ_/);
 const off=await request({id:++id,type:'EXPORT_P1G'});
 assert.equal(off.ok,false);assert.equal(off.error,'READ_WRITER_OPERATION_DISABLED');
 const claimed=await request({id:++id,type:'QUERY',search:'',cursor:null,limit:1,complete:true,sessionId:'UI-FORGED'});
 assert.equal(claimed.ok,false);assert.equal(claimed.error,'READ_FORGED_QUERY_REQUEST');
 // A query with cursor=null starts a fresh, explicitly scoped search;
 // obtain a genuine cursor, then attempt one-use replay.
 const first=await request({id:++id,type:'QUERY',search:'',cursor:null,limit:1});
 assert.equal(first.ok,true);
 assert.equal(first.result.rows.length,1);
 assert.equal(first.result.complete,false);
 assert.match(first.result.nextCursor,/^w1r1\.1\.[0-9a-f]{64}$/);
 assert.equal(Object.hasOwn(first.result,'profile'),false);
 const oldCursor=first.result.nextCursor;
 const second=await request({id:++id,type:'QUERY',search:'',cursor:oldCursor,limit:1});
 assert.equal(second.ok,true);assert.equal(second.result.complete,true);
 const replay=await request({id:++id,type:'QUERY',search:'',cursor:oldCursor,limit:1});
 assert.equal(replay.ok,false);
 assert.match(replay.error,/^READ_CURSOR_/);
 ok('ACTUAL_WORKER_CURSOR_TAMPER_FORGED_UI_AND_SINGLE_USE_REPLAY_DENIED');

 // A→B source change proves new Session and old A cursor no longer valid.
 const b=p1g(make('2024-01-01T00:00:00Z'));
 await upload(b);
 await page.waitForFunction(()=>document.querySelector('[data-timing-loaded="true"]')?.textContent?.includes('2024-01-01T00:00:00Z'),null,{timeout:30000});
 assert.ok(!(await page.locator('[data-timing-loaded="true"]').innerText()).includes('2126-08-20T00:00:00Z'));
 const oldAcross=await request({id:++id,type:'QUERY',search:'',cursor:oldCursor,limit:1});
 assert.equal(oldAcross.ok,false);
 assert.match(oldAcross.error,/^READ_CURSOR_/);
 assert.equal(sum(original),originalHash);
 ok('A_TO_B_OLD_ROWS_AND_CURSOR_REVOKED_ORIGINAL_SHA_INVARIANT');

 const many=p1g(make('2026-11-03T00:00:00Z',626,0,73));
 await upload(many);
 await waitRows(64);
 assert.equal(await page.locator('[data-timing-more]').count(),1);
 await page.locator('[data-timing-more]').click();
 await waitRows(73);
 assert.equal(await page.locator('[data-timing-more]').count(),0);
 ok('73_SOURCE_ROWS_IN_REAL_WORKER_PAGE_64_PLUS_9');

 await page.locator('#timing-bid').fill('0000000000000000');
 await upload(original);
 await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor({timeout:25000});
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 await page.locator('#timing-bid').fill(bid);
 await page.locator('.attest input').uncheck();
 await upload(original);
 await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor({timeout:25000});
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 await page.locator('.attest input').check();
 await upload(p1g(make('2026-01-01T00:00:00Z',624)));
 await page.locator('.timing-page [role="alert"] code').waitFor({timeout:35000});
 const schemaError=await page.locator('.timing-page [role="alert"] code').innerText();
 assert.match(schemaError,/^READ_[A-Z0-9_]+$/,'schema624 must be explicitly refused by worker');
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 await upload(Buffer.alloc(64,0));
 await page.getByText(/READ_SAVE_OR_REGISTRY_REJECTED/).waitFor({timeout:35000});
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 ok('BID_ATTESTATION_SCHEMA624_AND_CORRUPT_P1G_FAIL_CLOSED');

 if(heavy){
  for(const size of [100,200]){
   const expandedBytes=size*1024*1024;
   const fixture=p1g(make('2025-01-01T00:00:00Z',626,expandedBytes));
   const start=performance.now();
   await upload(fixture);
   if(size===100){
    await page.locator('[data-timing-loaded="true"] article.event').first().waitFor({timeout:150000});
    assert.ok((await page.locator('[data-timing-loaded="true"]').innerText()).includes('ItemID 31700014'));
    const heap=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
    const workerHeap=await page.workers()[0]?.evaluate(()=>performance.memory?.usedJSHeapSize??null).catch(()=>null);
    report.memory.push({expandedMiB:100,result:'SYNTHETIC_READ_PASS',elapsedMs:Math.round(performance.now()-start),
     encryptedBytes:fixture.length,mainPageJsHeapSampleBytes:heap,workerJsHeapSampleBytes:workerHeap,
     exactPeakProved:false});
    ok('EXPANDED_100MIB_SYNTHETIC_WORKER_READ');
   }else{
    await page.getByText(/READ_SAVE_OR_REGISTRY_REJECTED/).waitFor({timeout:150000});
    assert.equal(await page.locator('[data-timing-loaded]').count(),0);
    report.memory.push({expandedMiB:200,result:'DENIED_ABOVE_JS_CODEC_128MIB_LIMIT',
      elapsedMs:Math.round(performance.now()-start),encryptedBytes:fixture.length,
      browserPeakNotMeasured:true});
    ok('EXPANDED_200MIB_SYNTHETIC_FAIL_CLOSED_NOT_PASS');
   }
  }
 }
 await page.setViewportSize({width:320,height:760});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),false);
 ok('320PX_NO_HORIZONTAL_OVERFLOW');
 assert.equal(sum(original),originalHash);
 assert.deepEqual(report.networkWrites,[],'no POST/PUT/remote upload');
 assert.deepEqual(report.outbound,[],'no cross-origin request');
 assert.deepEqual(errors,[],'no page errors or browser console errors');
 ok('NETWORK_READ_ONLY_NO_EXFILTRATION_OBSERVED');
 await context.close();
 report.result='PASS';
}catch(error){
 report.result='FAIL';report.error=String(error?.stack||error);
}finally{
 await mkdir('.artifacts/05qr-pr361',{recursive:true});
 await writeFile('.artifacts/05qr-pr361/'+mode+'.json',JSON.stringify(report,null,2));
 await browser.close();
}
console.log(JSON.stringify({mode,result:report.result,checks:report.checks.map(x=>x.name),
 memory:report.memory,error:report.error??null}));
if(report.result!=='PASS')process.exitCode=1;
