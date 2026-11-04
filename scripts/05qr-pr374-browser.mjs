// 05 QR PR374 independent REAL Chromium: new UI W1 Preview and untouched
// original backup; PUBLIC SYNTHETIC encrypted P1G only, never user original.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
if(!process.env.CHROME_BIN) throw Error('QA_CHROME_BIN_REQUIRED');
const base=(process.env.QR374_URL||'http://127.0.0.1:4217').replace(/\/$/,'');
const mode=process.env.QR374_MODE||'dev';
const BID='9A239D3DB569756D', OLD='2126-08-20T00:00:00Z';
const sha=b=>createHash('sha256').update(b).digest('hex');
const profile=when=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{Opaque:{important:'\u00e9',keep:[1,2,3]}},
 World:{Villages:[],GridCollection:{Grids:{}},
  RecurringEvents:{'155':{ItemSpawning:{
   RecurringEventItemID:2010000021,NextOccurrence:when,
   LastOccurrence:'2026-10-01T00:00:00Z',Unknown:{preserve:true}
  }}},
  Unrelated:{before:OLD,immutable:'UNKNOWN_ROOT'}}});
const a=Buffer.from(makeSyntheticP1gProfile(profile(OLD)));
const b=Buffer.from(makeSyntheticP1gProfile(profile('2024-12-31T23:59:59Z')));
const report={schema:'05qr-pr374-actual-chromium-synthetic@1',mode,
  sourceHead:'711c6bec2650f8cd864d14b63ec1fccbb061167f',
  checks:[],errors:[],requests:[],result:'PENDING',realP1g:'NOT_RUN'};
const mark=name=>report.checks.push({name,result:'PASS'});
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:850}});
 ctx.on('request',r=>{
  const u=new URL(r.url()),expect=new URL(base);
  if(r.method()!=='GET'||u.origin!==expect.origin)
   report.requests.push({method:r.method(),hostname:u.hostname,type:r.resourceType()});
 });
 const page=await ctx.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(base+'/editor/timing/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('[data-w1-ui-ready="true"]').waitFor({timeout:25000});
 assert.equal(await page.locator('[data-writer="off"]').count(),1);
 assert.ok(page.workers().length>0,'real Worker, not mocked transport');
 await page.locator('#timing-bid').fill(BID);
 await page.locator('.attest input').check();
 const upload=async bytes=>page.locator('#timing-file').setInputFiles({
  name:'independent-qa374.p1g',mimeType:'application/octet-stream',buffer:bytes
 });
 const readSource=()=>page.locator('[data-w1-source-sha] code').innerText();
 await upload(a);
 await page.locator('[data-w1-preview-select]').waitFor({timeout:25000});
 assert.equal(await readSource(),sha(a));
 mark('BROWSER_LOCAL_PACKAGED_P1G_SOURCE_SHA_WORKER_REGISTRY');

 await page.locator('[data-w1-preview-select]').click();
 await page.locator('#w1-new-utc').fill('2028-02-29T23:59:59Z');
 await page.locator('[data-w1-preview-build]').click();
 const diff=await page.locator('[data-w1-diff]').innerText();
 assert.match(diff,/\/World\/RecurringEvents\/155\/ItemSpawning\/NextOccurrence/);
 assert.match(diff,/2126-08-20T00:00:00Z/);
 assert.match(diff,/2028-02-29T23:59:59Z/);
 assert.match(diff,new RegExp(sha(a)));
 assert.equal(await page.locator('[data-w1-export-off]').isDisabled(),true);
 assert.equal(await page.locator('[data-w1-original-backup]').isEnabled(),true);
 mark('EXACT_ONE_FIELD_UI_PREVIEW_WRITER_DISABLED');

 let event=page.waitForEvent('download',{timeout:20000});
 await page.locator('[data-w1-original-backup]').click();
 let download=await event;
 assert.match(download.suggestedFilename(),/\.original-backup\.p1g$/);
 const back=await readFile(await download.path());
 assert.equal(sha(back),sha(a));
 assert.equal(back.compare(a),0);
 mark('GENUINE_BROWSER_DOWNLOAD_UNTOUCHED_BACKUP_SHA_BYTES_MATCH_SYNTHETIC');
 assert.match(await page.locator('.w1-backup').innerText(),/ダウンロードを要求|download requested/i);

 await page.locator('#w1-new-utc').fill('2026-02-29T00:00:00Z');
 await page.locator('[data-w1-preview-build]').click();
 await page.locator('[data-w1-preview] [role="alert"] code').waitFor({timeout:7000});
 assert.equal(await page.locator('[data-w1-diff]').count(),0);
 mark('CALENDAR_INVALID_NO_FALSE_DIFF');

 // A→B must reset prior selected intent, old backup readiness and source SHA.
 await upload(b);
 await page.waitForFunction(expected=>document.querySelector('[data-w1-source-sha] code')?.textContent===expected,
  sha(b),{timeout:30000});
 assert.equal(await page.locator('[data-w1-preview]').count(),0);
 assert.ok(!(await page.locator('[data-timing-loaded="true"]').innerText()).includes(OLD));
 assert.match(await page.locator('.w1-backup').innerText(),/原本バックアップが必要|original backup is required/i);
 assert.equal(await readSource(),sha(b));
 event=page.waitForEvent('download',{timeout:20000});
 await page.locator('[data-w1-original-backup]').click();
 download=await event;
 const backB=await readFile(await download.path());
 assert.equal(sha(backB),sha(b));
 assert.notEqual(sha(backB),sha(a));
 assert.equal(sha(a),sha(Buffer.from(makeSyntheticP1gProfile(profile(OLD)))));
 mark('A_TO_B_REVOKES_PRIOR_UI_PREVIEW_AND_BACKUP_SELECTS_B');

 await page.locator('#timing-bid').fill('0000000000000000');
 await upload(a);
 await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor({timeout:20000});
 assert.equal(await page.locator('[data-w1-original-backup]').count(),0);
 assert.equal(await page.locator('[data-w1-preview]').count(),0);
 mark('WRONG_BID_FAILCLOSED_NO_BACKUP_AND_PREVIEW');

 await page.locator('#timing-bid').fill(BID);
 await upload(Buffer.alloc(64));
 await page.locator('.timing-page [role="alert"] code').waitFor({timeout:30000});
 assert.equal(await page.locator('[data-w1-original-backup]').count(),0);
 assert.equal(await page.locator('[data-w1-preview]').count(),0);
 mark('CORRUPTED_SOURCE_NO_BACKUP_OR_PREVIEW');

 await page.setViewportSize({width:320,height:780});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2),false);
 mark('SMALL_VIEWPORT_NO_OVERFLOW');

 assert.deepEqual(report.requests,[],'no non-GET or cross-origin request');
 assert.deepEqual(report.errors,[],'no JS runtime errors');
 mark('NO_SAVE_UPLOAD_OR_UNTRUSTED_NETWORK_AND_NO_BROWSER_ERRORS');
 report.result='PASS';
 await ctx.close();
}catch(err){
 report.result='FAIL';report.error=String(err?.stack||err);
}finally{
 await mkdir('.artifacts/05qr-pr374',{recursive:true});
 await writeFile('.artifacts/05qr-pr374/'+mode+'.json',JSON.stringify(report,null,2));
 await browser.close();
}
console.log(JSON.stringify({mode,result:report.result,checks:report.checks.map(x=>x.name),
 error:report.error??null}));
if(report.result!=='PASS') process.exitCode=1;
