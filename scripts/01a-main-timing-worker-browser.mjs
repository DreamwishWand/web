// 01A CORE main-first, browser E2E on SYNTHETIC encrypted P1G only.
// This is NOT independent real-save QA or Rust/WASM Worker acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

if (!process.env.CHROME_BIN) throw Error('CHROME_BIN required');
const base = (process.env.WAND_TIMING_BROWSER_URL || 'http://127.0.0.1:4179').replace(/\/$/, '');
const bid = '9A239D3DB569756D';
const profile = (item, padding = 0) => ({
 GameInfo: { Version:626, InitialVersion:518,
  LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'} },
 Player: {Opaque:{unchanged:true}},
 World: {
  Villages: [],
  GridCollection: { Grids:{} },
  RecurringEvents:{
   '155': {ItemSpawning:{RecurringEventItemID:2010000021,
      NextOccurrence:'2126-08-20T00:00:00Z',
      LastOccurrence:'2026-10-01T00:00:00Z',
      Unrelated:{retain:'YES'}}},
   '156': {FlowerSpawningInVillage:{RecurringEventItemID:item,
      NextOccurrence:'2025-01-01T00:00:00Z'}}
  },
  UnknownHuge: padding ? 'x'.repeat(padding) : 'no private save'
 }
});
const p1g = Buffer.from(makeSyntheticP1gProfile(profile(2010500008)));
const hash = createHash('sha256').update(p1g).digest('hex');
const evidence = {
 schema:'wand.01a.local-timing-browser-synthetic@1',
 head: process.env.GITHUB_SHA ?? 'local', fixture:'SYNTHETIC_ONLY',
 platform:'Nintendo Switch', version:'1.25.3', externalBID:bid, profileSchema:626,
 checks:[], memory:[], error:null, result:'PENDING'
};
const pass = (name, metadata={}) => evidence.checks.push({ name, verdict:'PASS', ...metadata });
const browser = await chromium.launch({
 executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-precise-memory-info']
});
try {
 const context = await browser.newContext({viewport:{width:1280,height:850}});
 const page = await context.newPage();
 const network = [];
 const errors = [];
 context.on('request',request=>{if(request.method()!=='GET')network.push({method:request.method(),url:request.url()});});
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
 await page.goto(base+'/editor/timing/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('[data-worker-readonly="true"][data-writer="off"]').count(),1);
 await page.locator('#timing-bid').fill(bid);
 await page.locator('.attest input').check();
 const upload = async buffer => page.locator('#timing-file').setInputFiles({
  name:'synthetic-profile.p1g',mimeType:'application/octet-stream',buffer
 });
 await upload(p1g);
 await Promise.race([
  page.locator('[data-timing-loaded="true"] .event').first().waitFor({timeout:15000}),
  page.locator('.timing-page [role="alert"]').first().waitFor({timeout:15000})
   .then(async()=>{throw Error('READ_BROWSER_ALERT:'+await page.locator('.timing-page [role="alert"]').first().innerText()+':PAGE_ERRORS:'+errors.join('|'));})
 ]);
 assert.equal(await page.locator('[data-timing-loaded="true"] .event').count(),2);
 assert.ok(page.workers().length>=1,'Read must run off UI thread in a module Worker');
 assert.match(await page.locator('[data-timing-loaded="true"]').innerText(),/EventID: 2010000021/);
 pass('SYNTHETIC_P1G_BROWSER_WORKER_E2E_EVENTID');
 await page.locator('#timing-search').fill('31700014');
 await page.locator('#timing-search').dispatchEvent('input');
 await page.waitForTimeout(320);
 assert.equal(await page.locator('[data-timing-loaded="true"] .event').count(),1);
 assert.match(await page.locator('[data-timing-loaded="true"] .event').innerText(),/ItemID 31700014/);
 pass('ITEMID_SEARCH_IN_WORKER');
 assert.equal(createHash('sha256').update(p1g).digest('hex'),hash);
 assert.deepEqual(network,[]);
 pass('SOURCE_UNCHANGED_AND_NO_NETWORK_WRITE',{sourceHash:hash});

 await page.locator('#timing-bid').fill('0000000000000000');
 await upload(p1g);
 await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor({timeout:10000});
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 pass('BAD_BID_DENIED');
 await page.locator('#timing-bid').fill(bid);
 await page.locator('.attest input').uncheck();
 await upload(p1g);
 await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor({timeout:10000});
 pass('NO_EXTERNAL_ATTESTATION_DENIED');
 await page.locator('.attest input').check();
 await upload(Buffer.alloc(48));
 await page.getByText(/READ_SAVE_OR_REGISTRY_REJECTED/).waitFor({timeout:15000});
 assert.equal(await page.locator('[data-timing-loaded]').count(),0);
 pass('INVALID_P1G_DENIED');

 await page.setViewportSize({width:320,height:740});
 const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+2);
 assert.equal(overflow,false,'Timing route horizontal overflow at 320px');
 pass('RESPONSIVE_320_NO_OVERFLOW');
 await page.setViewportSize({width:1280,height:850});
 
 // User requested 100–200MiB characterization: 100MiB real Worker read is
 // measured on a PUBLIC SYNTHETIC fixture. 200MiB must fail closed while the
 // existing supported JS Codec has an explicit 128MiB expanded-profile cap.
 for (const mb of [100,200]) {
  const large = Buffer.from(makeSyntheticP1gProfile(profile(2010500008,mb*1024*1024)));
  const begin=Date.now();
  await upload(large);
  if(mb===100) {
   await page.locator('[data-timing-loaded="true"] .event').first().waitFor({timeout:120000});
   const elapsedMs=Date.now()-begin;
   const heap=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
   const workerHeap=await page.workers()[0]?.evaluate(()=>performance.memory?.usedJSHeapSize??null).catch(()=>null);
   evidence.memory.push({decodedPaddingMiB:mb,outcome:'READ_OK_SYNTHETIC',
    elapsedMs,mainPageJsHeapBytes:heap,workerJsHeapBytes:workerHeap,
    ciphertextBytes:large.length});
   pass('100MIB_EXPANDED_SYNTHETIC_WORKER_READ',{elapsedMs});
  } else {
   await page.getByText(/READ_SAVE_OR_REGISTRY_REJECTED/).waitFor({timeout:120000});
   assert.equal(await page.locator('[data-timing-loaded]').count(),0);
   evidence.memory.push({decodedPaddingMiB:mb,outcome:'DENIED_ABOVE_EXISTING_128MIB_CODEC_CAP',
    elapsedMs:Date.now()-begin,ciphertextBytes:large.length});
   pass('200MIB_EXPANDED_FAIL_CLOSED_PENDING_STREAMING_CORE');
  }
 }
 assert.deepEqual(errors,[],JSON.stringify(errors));
 assert.deepEqual(network,[]);
 pass('PAGE_CONSOLE_ERRORS_ZERO_NO_UPLOAD');
 evidence.result='PASS';
 await context.close();
} catch(error) {
 evidence.result='FAIL';
 evidence.error=String(error?.stack||error);
} finally {
 await mkdir('.artifacts/01a-main-timing-worker',{recursive:true});
 await writeFile('.artifacts/01a-main-timing-worker/report.json',JSON.stringify(evidence,null,2));
 await browser.close();
}
if(evidence.result!=='PASS') throw Error(evidence.error||'TIMING_WORKER_BROWSER_FAILED');
