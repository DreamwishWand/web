// 08 WEB independent Owner browser evidence: real Chromium + SYNTHETIC encrypted P1G ONLY.
// No private files, keys, user profile or real-save bytes are imported into CI.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

const executablePath=process.env.CHROME_BIN;
if(!executablePath)throw Error('CHROME_BIN_REQUIRED');
const origin=(process.env.WEB_TIMING_PREVIEW_URL || 'http://127.0.0.1:4187').replace(/\/$/,'');
const BID='9A239D3DB569756D';
const profile=(date='2126-08-20T00:00:00Z',version=626)=>({
  GameInfo:{Version:version,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
  Player:{Opaque:{unchanged:true}},World:{
    Villages:[],GridCollection:{Grids:{}},
    RecurringEvents:{
      '155':{ItemSpawning:{RecurringEventItemID:2010000021,NextOccurrence:date,LastOccurrence:'2026-10-01T00:00:00Z',Unknown:{preserve:true}}},
      '156':{FlowerSpawningInVillage:{RecurringEventItemID:2010500008,NextOccurrence:'2025-01-01T00:00:00Z'}}
    }
  }
});
const a=Buffer.from(makeSyntheticP1gProfile(profile()));
const b=Buffer.from(makeSyntheticP1gProfile(profile('2024-01-01T00:00:00Z')));
const badSchema=Buffer.from(makeSyntheticP1gProfile(profile('2024-01-01T00:00:00Z',624)));
const originalHash=createHash('sha256').update(a).digest('hex');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const checks=[],requests=[],errors=[];
let page,context;
const pass=name=>{checks.push(name);console.log('WEB_W1_'+name+'_PASS');};
const fit=async(label)=>{const w=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(w.scroll<=w.client+2,label+': '+JSON.stringify(w));};
const upload=async buffer=>page.locator('#timing-file').setInputFiles({name:'synthetic-not-private.p1g',mimeType:'application/octet-stream',buffer});
const openExpected=async buffer=>{await upload(buffer);await page.locator('[data-timing-loaded="true"] .event').first().waitFor({timeout:20000});};
try {
  context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
  page=await context.newPage();
  context.on('request',r=>{
    const url=new URL(r.url());
    if(r.method()!=='GET'||url.origin!==origin)requests.push({method:r.method(),host:url.hostname,path:url.pathname});
  });
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin+'/editor/timing/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('[data-timing-readonly="true"][data-writer="off"]').count(),1);
  assert.match(await page.locator('[data-timing-expanded-limit]').innerText(),/128.*200|200.*128/);
  assert.match(await page.locator('[data-timing-2126]').innerText(),/2126/);
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  await upload(a);
  await page.locator('[data-timing-error="SOURCE_BUILD_ATTESTATION_REQUIRED"]').waitFor({timeout:10000});
  pass('EXTERNAL_BID_REQUIRED_BEFORE_FILE_OPEN');

  await page.locator('#timing-bid').fill(BID);
  await page.locator('.attest input').check();
  await openExpected(a);
  assert.equal(await page.locator('.event').count(),2);
  assert.match(await page.locator('.results').innerText(),/EventID: 2010000021/);
  pass('SYNTHETIC_P1G_FILE_CHOOSE_BID_LOAD_AND_EVENTID');

  await page.locator('#timing-search').fill('31700014');
  assert.equal(await page.locator('.event').count(),1);
  assert.match(await page.locator('.event').innerText(),/ItemID 31700014/);
  await page.locator('[data-timing-inspect="155"]').click();
  assert.equal(await page.locator('[data-w1-preview="unaccepted"][data-writer="off"]').count(),1);
  assert.match(await page.locator('[data-timing-old]').innerText(),/2126-08-20T00:00:00Z/);
  await page.locator('#timing-proposed').fill('2126-10-02T00:00:00Z');
  await page.locator('#timing-reason').fill('Synthetic test only, not approved for editing');
  assert.match(await page.locator('[data-timing-new]').innerText(),/2126-10-02T00:00:00Z/);
  for(const attr of ['data-timing-apply-off','data-timing-export-off','data-timing-backup-off'])
    assert.equal(await page.locator('['+attr+']:disabled').count(),1);
  pass('ITEMID_EVENT_DETAIL_OLD_NEW_REASON_ALL_WRITERS_OFF');

  await openExpected(b);
  assert.equal(await page.locator('[data-w1-preview]').count(),0);
  assert.ok(!(await page.locator('[data-timing-loaded]').innerText()).includes('2126-08-20T00:00:00Z'));
  assert.match(await page.locator('[data-timing-loaded]').innerText(),/2024-01-01T00:00:00Z/);
  pass('A_TO_B_DISCARDS_OLD_DETAIL_AND_DRAFT');

  await page.locator('[data-timing-inspect="155"]').click();
  await page.locator('#timing-bid').fill('0000000000000000');
  assert.equal(await page.locator('[data-w1-preview]').count(),0);
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  await upload(b);
  await page.locator('[data-timing-error="SOURCE_BUILD_ATTESTATION_REQUIRED"]').waitFor();
  await page.locator('#timing-bid').fill(BID);
  await openExpected(b);
  await page.locator('.attest input').uncheck();
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  assert.equal(await page.locator('[data-w1-preview]').count(),0);
  pass('BID_ATTESTATION_CHANGE_REVOKES_SOURCE');

  await page.locator('.attest input').check();
  await upload(Buffer.alloc(48));
  await page.locator('[data-timing-error="SAVE_READ_OR_REGISTRY_REJECTED"]').waitFor({timeout:10000});
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  await upload(badSchema);
  await page.locator('[data-timing-error="SAVE_READ_OR_REGISTRY_REJECTED"]').waitFor({timeout:10000});
  assert.equal(await page.locator('[data-timing-loaded]').count(),0);
  pass('CORRUPT_AND_SCHEMA624_FAIL_CLOSED');

  await openExpected(a);
  await page.locator('#timing-search').fill('no-such-event-xyz');
  await page.locator('[data-timing-no-results="true"]').waitFor();
  assert.equal(await page.locator('[data-w1-preview]').count(),0);
  pass('SEARCH_NO_MATCH_SAFE_EMPTY_STATE');

  const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
  for (const locale of locales){
    await page.locator('#site-locale').selectOption(locale);
    await page.waitForFunction(code=>document.documentElement.dataset.locale===code,locale);
    assert.match(await page.locator('[data-timing-expanded-limit]').innerText(),/128/);
    assert.match(await page.locator('[data-timing-2126]').innerText(),/2126/);
    assert.match(await page.locator('[data-w1-writer-off]').innerText(),/OFF/);
  }
  pass('EIGHT_LOCALES_128MIB_2126_WRITER_OFF');

  await page.setViewportSize({width:320,height:820});
  await fit('320px');
  await page.setViewportSize({width:640,height:900});
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  await fit('zoom200');
  pass('320PX_AND_ZOOM200_NO_OVERFLOW');
  assert.equal(createHash('sha256').update(a).digest('hex'),originalHash);
  assert.deepEqual(requests,[]);
  assert.deepEqual(errors,[]);
  pass('ORIGINAL_SHA_UNCHANGED_ZERO_UPLOAD_ZERO_JS_EXCEPTIONS');
} finally {
  await mkdir('.artifacts/web-w1-timing-preview',{recursive:true});
  await writeFile('.artifacts/web-w1-timing-preview/result.json',JSON.stringify({
    kind:'SYNTHETIC_ONLY',sourceSha256:originalHash,checks,requests,errors,
    realPrivateSave:'NOT_RUN',writer:'OFF'
  },null,2));
  await browser.close();
}
console.log('WEB_W1_TIMING_PREVIEW_ACTUAL_CHROMIUM_PASS');
