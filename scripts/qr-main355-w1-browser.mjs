import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

// Independent 04 QR: only PR355/main UI delta. No private save or native Writer.
const base=(process.env.QR_W1_BASE_URL||'http://127.0.0.1:4197').replace(/\/$/,'')+'/editor/timing/';
const BID='9A239D3DB569756D';
const fixture=(events,version=626)=>({
  GameInfo:{Version:version,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{Level:1},
  World:{Villages:[],GridCollection:{Grids:{}},RecurringEvents:events},
  OpaqueQA:{untouched:true}
});
const A=Buffer.from(makeSyntheticP1gProfile(fixture({
  '155':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2126-08-20T00:00:00Z',LastOccurrence:'2026-08-20T00:00:00Z'}},
  '8':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:'2026-11-03T08:00:00Z'}}
})));
const B=Buffer.from(makeSyntheticP1gProfile(fixture({
  '12':{ItemSpawning:{RecurringEventItemID:2010000003,NextOccurrence:'2026-12-04T01:00:00Z'}}
})));
const wrongSchema=Buffer.from(makeSyntheticP1gProfile(fixture({
  '155':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:'2026-12-05T00:00:00Z'}}
},624)));
const originalHash=createHash('sha256').update(A).digest('hex');
const evidence={schema:'wand.qr.main355.browser@1',source:'866c5c558776e84631df5b7872e9e9e322bd2400',
  fixture:'SYNTHETIC_ONLY',checks:[],pageErrors:[],consoleErrors:[],privateSaveRequests:[],result:'PENDING'};
const ok=(name)=>evidence.checks.push({name,status:'PASS'});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
async function upload(page,buffer,name='synthetic.save'){
  await page.locator('#timing-file').setInputFiles({name,mimeType:'application/octet-stream',buffer});
}
let ctx;
try {
  ctx=await browser.newContext({viewport:{width:1280,height:900},locale:'en-US',acceptDownloads:true});
  const page=await ctx.newPage();
  page.on('pageerror',e=>evidence.pageErrors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')evidence.consoleErrors.push(m.text());});
  page.on('request',r=>{
    if(!['GET','HEAD','OPTIONS'].includes(r.method()))evidence.privateSaveRequests.push({method:r.method(),path:new URL(r.url()).pathname});
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('[data-timing-readonly="true"][data-writer="off"]').waitFor();
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  assert.equal(await page.getByText(/edited-copy export are disabled/i).count(),1);
  assert.equal(await page.locator('button:has-text("Export"),button:has-text("Save"),button:has-text("Apply")').count(),0);
  ok('READONLY_UI_NO_WRITER_OR_EXPORT');

  await upload(page,A,'without-attestation.save');
  await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor();
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  ok('NO_EXTERNAL_BID_ATTESTATION_REJECTS');
  await page.locator('#timing-bid').fill('0000000000000000');
  await page.locator('.attest input[type=checkbox]').check();
  await upload(page,A,'wrong-bid.save');
  await page.getByText('SOURCE_BUILD_ATTESTATION_REQUIRED').waitFor();
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  ok('WRONG_SWITCH_BID_REJECTS');

  await page.locator('#timing-bid').fill(BID);
  await upload(page,A,'synthetic-A.save');
  await page.locator('[data-timing-loaded]').waitFor({timeout:20000});
  assert.equal(await page.locator('article.event').count(),2);
  const rowA=page.locator('article[data-event-id="2010000021"]');
  assert.equal(await rowA.count(),1);
  const rendered=await rowA.innerText();
  assert.match(rendered,/Save key:\s*155/);
  assert.match(rendered,/EventID:\s*2010000021/);
  assert.match(rendered,/ItemID 31700014/);
  assert.match(rendered,/2126-08-20T00:00:00Z/);
  assert.equal(await page.locator('article[data-event-id="2010000003"] li').count(),4);
  ok('SYNTHETIC_P1G_LOCAL_READ_MAPKEY_EVENTID_ITEMID_MULTI_2126');

  await page.locator('#timing-search').fill('31700014');
  assert.equal(await page.locator('article.event').count(),1);
  assert.equal(await rowA.count(),1);
  await page.locator('#timing-search').fill('31300006');
  assert.equal(await page.locator('article.event').count(),1);
  assert.equal(await page.locator('article[data-event-id="2010000003"]').count(),1);
  await page.locator('#timing-search').fill('2010000021');
  assert.equal(await rowA.count(),1);
  ok('ITEMID_EVENTID_SEARCH');

  // Choose a second complete P1G without navigating; old rows must disappear.
  await upload(page,B,'synthetic-B.save');
  await page.getByRole('heading',{name:'synthetic-B.save'}).waitFor({timeout:20000});
  assert.equal(await page.locator('article.event').count(),1);
  assert.equal(await rowA.count(),0);
  assert.match(await page.locator('article.event').innerText(),/2026-12-04T01:00:00Z/);
  ok('A_TO_B_STALE_RESULT_CLEARED');

  await upload(page,wrongSchema,'wrong-schema.save');
  await page.getByText('SAVE_READ_OR_REGISTRY_REJECTED').waitFor({timeout:20000});
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  ok('SCHEMA624_FAIL_CLOSED');
  await upload(page,Buffer.from('not a p1g zip or json'), 'corrupt.save');
  await page.getByText('SAVE_READ_OR_REGISTRY_REJECTED').waitFor({timeout:20000});
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  ok('CORRUPT_SAVE_FAIL_CLOSED');

  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.locator('[data-timing-readonly="true"]').isVisible(),true);
  assert.deepEqual(evidence.privateSaveRequests,[]);
  assert.deepEqual(evidence.pageErrors,[]);
  assert.deepEqual(evidence.consoleErrors,[]);
  assert.equal(createHash('sha256').update(A).digest('hex'),originalHash);
  ok('NO_SAVE_UPLOAD_OR_SOURCE_MUTATION_BROWSER_ERROR');
  evidence.result='PASS';
} catch(e) {evidence.result='FAIL';evidence.error=String(e?.stack||e);}
finally{
  await mkdir('.artifacts/qr-main355-w1',{recursive:true});
  await writeFile('.artifacts/qr-main355-w1/report.json',JSON.stringify(evidence,null,2));
  if(ctx)await ctx.close();
  await browser.close();
}
if(evidence.result!=='PASS')throw Error(evidence.error||'W1_QR_BROWSER_FAIL');
console.log('QR_MAIN355_W1_ACTUAL_CHROMIUM_SYNTHETIC_NEW_ONLY_PASS');
