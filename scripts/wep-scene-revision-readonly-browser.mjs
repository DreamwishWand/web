import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const url=(process.env.WEP_SCENE_BASE_URL||'http://127.0.0.1:4189').replace(/\/$/,'')+'/presets/';
if(!process.env.CHROME_BIN) throw new Error('CHROME_BIN_REQUIRED');
const ids={
  work:'11111111-1111-4111-8111-111111111111',
  workRevision:'22222222-2222-4222-8222-222222222222',
  preset:'33333333-3333-4333-8333-333333333333',
  revision:'44444444-4444-4444-8444-444444444444',
  creator:'55555555-5555-4555-8555-555555555555',
  gallery:'66666666-6666-4666-8666-666666666666',
  galleryRevision:'77777777-7777-4777-8777-777777777777',
  cover:'88888888-8888-4888-8888-888888888888'
};
const current={workId:ids.work,workRevisionId:ids.workRevision,
  presetArtifactId:ids.preset,presetRevisionId:ids.revision,presetRevisionNumber:2,
  presetType:'scene',creatorProfileId:ids.creator,title:'Example Scene',description:'',
  galleryWorkId:ids.gallery,galleryWorkRevisionId:ids.galleryRevision,
  mediaIds:[ids.cover],coverMediaId:ids.cover,checksumSha256:'f'.repeat(64),
  byteSize:3301,schemaVersion:1,publishedAt:'2026-10-24T00:00:00Z'
};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const report={contract:'ddv.wep.scene-revision-gallery-browser-synthetic@1',head:process.env.GITHUB_SHA||null,mode:'SYNTHETIC_UNSIGNED_NO_REAL_STORAGE_OR_JWT',checks:[],pageErrors:[],consoleErrors:[],result:'PENDING'};
const pass=name=>report.checks.push({name,status:'PASS'});
let mode='good';
try{
const ctx=await browser.newContext({viewport:{width:1280,height:960}});
const page=await ctx.newPage();
page.on('pageerror',e=>report.pageErrors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
await page.route('https://staging.example.invalid/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/rest/v1/rpc/community_search_public')){
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{
      work_id:ids.work,creator_profile_id:ids.creator,title:'Example Scene',text_content:'',
      tags:[],facets:{},published_at:'2026-10-24T00:00:00Z'
    }])});return;
  }
  if(path.endsWith('/functions/v1/community-public-query')){
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mode==='tampered'?{...current,coverMediaId:ids.work}:current)});return;
  }
  if(path.endsWith('/functions/v1/community-public-media')){
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,media:{signedUrl:mode==='expired'?'http://invalid.example/signed':'https://cover.example.invalid/image.png',mimeType:'image/png'}
    })});return;
  }
  await route.fulfill({status:404,contentType:'application/json',body:'{}'});
});
await page.route('https://cover.example.invalid/image.png',async route=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRlkAAAAASUVORK5CYII=','base64');
  await route.fulfill({status:200,contentType:'image/png',body:png});
});
await page.goto(url,{waitUntil:'networkidle'});
const card=page.locator('.preset-card',{hasText:'Example Scene'});
await card.waitFor({timeout:15000});
await card.getByRole('button',{name:'Scene revision'}).click();
const panel=page.locator('[data-wep-scene-revision-readonly]');
await panel.waitFor({timeout:15000});
assert.equal(await panel.getByRole('button',{name:'Inspect current'}).isEnabled(),true);
assert.equal(await panel.locator('[data-wep-scene-save-disabled]').count(),1);
pass('EXISTING_PRESET_SELECTION_NO_SAVE_REVISION');
await panel.getByRole('button',{name:'Inspect current'}).click();
await panel.getByText('Example Scene').waitFor({timeout:15000});
await panel.locator('[data-wep-scene-current-cover] img').waitFor({timeout:15000});
assert.ok((await panel.innerText()).includes(ids.galleryRevision));
assert.ok((await panel.innerText()).includes('Historical media not available'));
pass('CURRENT_REVISION_WITH_GALLERY_COVER_READ_ONLY');
mode='expired';
await panel.getByRole('button',{name:'Retry cover'}).click();
await panel.getByText(/unavailable or expired/i).waitFor({timeout:15000});
assert.equal(await panel.locator('[data-wep-scene-current-cover] img').count(),0);
pass('EXPIRED_MEDIA_RETRY_FAIL_CLOSED');
mode='tampered';
await panel.getByRole('button',{name:'Inspect current'}).click();
await panel.getByText(/WEP_SCENE_PUBLIC_CURRENT_GALLERY_COVER_UNBOUND/).waitFor({timeout:15000});
pass('TAMPERED_CURRENT_COVER_DENIED');
await page.setViewportSize({width:320,height:740});
const metric=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
assert.ok(metric.scroll<=metric.viewport+5,JSON.stringify(metric));
pass('RESPONSIVE_320PX');
assert.deepEqual(report.pageErrors,[]);
assert.deepEqual(report.consoleErrors,[]);
pass('PAGE_CONSOLE_ERRORS_ZERO');
report.result='PASS';
await ctx.close();
}catch(e){report.error=String(e?.stack||e);report.result='FAIL';}
finally{
await mkdir('.artifacts/wep-scene-revision-browser',{recursive:true});
await writeFile('.artifacts/wep-scene-revision-browser/report.json',JSON.stringify(report,null,2));
await browser.close();
}
if(report.result!=='PASS')throw new Error(report.error);
