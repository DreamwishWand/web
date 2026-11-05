// 04 QR-W independent PR609 final-public ItemThumb Source new-only QA.
// All image bytes below are a self-created 8x8 WebP fixture, NOT Disney/Gameloft R39 art.
// No private encrypted P1G, no game art upload, no public media deployment.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {
 validateItemImageCatalog, scopedItemImageHref,
 ITEM_IMAGE_TARGET, ITEM_IMAGE_SCHEMA, ITEM_IMAGE_SOURCE,
 R39_DERIVATIVE_MANIFEST_SHA256, ITEM_IMAGE_OWNER_DECISION_ID
} from '../src/lib/item-media/public-item-images.mjs';

const MAIN='6428d080786bf3b2035be86b945b1460dbf1452a';
const SRC='1eedc47658b2499fb278eb656ef874fb0a30b00a';
const SOURCE=[
 '.github/workflows/web-shared-catalog-detail.yml',
 'src/lib/entity/SharedEntityDetail.svelte',
 'src/lib/entity/shared-catalog-detail.mjs',
 'src/lib/item-media/public-item-images.mjs',
 'src/lib/ui/ItemImagePreferences.svelte',
 'src/lib/ui/ItemThumb.svelte',
 'src/routes/collection/+page.svelte',
 'src/routes/explore/+page.svelte',
 'tests/web-stage1-public-item-thumb-contract.test.mjs'
].sort();
const QA=[
 '.github/workflows/04qr-w-pr609-public-itemthumb-new-only.yml',
 'scripts/04qr-w-pr609-public-itemthumb-new-only.mjs'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',MAIN,SRC),MAIN,'Source parent main HEAD changed unexpectedly');
assert.equal(git('merge-base',SRC,'HEAD'),SRC,'QA must be descendant of fixed Source');
assert.deepEqual(git('diff','--name-only',MAIN,SRC).split('\n').sort(),SOURCE);
assert.deepEqual(git('diff','--name-only',SRC,'HEAD').split('\n').sort(),QA,'QA may add only two independent QA files');
for(const [file,sha] of Object.entries({
 'src/lib/item-media/public-item-images.mjs':'809877ba36c286e20a0deca011f1916be36ed7d2',
 'src/lib/ui/ItemThumb.svelte':'e24816599ffd7860be0114793a65c91edb68429b',
 'src/lib/ui/ItemImagePreferences.svelte':'1770ccf92b83a3977d55c87c8c159c1bdc686af8',
 'src/routes/collection/+page.svelte':'e1c7ed6f40344f6b67c545d5881b4d644782b178',
 'tests/web-stage1-public-item-thumb-contract.test.mjs':'ae19191034aaa395ce801019b6d9c7b1ddec7bbc'
}))assert.equal(git('rev-parse',SRC+':'+file),sha,file);
console.log('QR609_SOURCE_EXACT9_BASE_SHA_AND_QA_EXACT2_GIT_PASS');

const ITEM='40000048',HASH='a'.repeat(64);
const manifest=()=>({
 schema:ITEM_IMAGE_SCHEMA,
 source:{...ITEM_IMAGE_SOURCE,derivativeManifestSha256:R39_DERIVATIVE_MANIFEST_SHA256},
 target:{...ITEM_IMAGE_TARGET},
 publication:{
  gate:'OWNER_GO_FOR_DDV_GAME_IMAGES',
  decisionId:ITEM_IMAGE_OWNER_DECISION_ID,
  scope:'RELEASED_PLAYER_FACING_ITEM_THUMBNAILS'
 },
 items:{[ITEM]:{
  sourcePngSha256:HASH,
  identityStatus:'VERSION_VERIFIED',
  visibility:'RELEASED_PLAYER_FACING',
  assetStatus:'WEBP_VERIFIED_160'
 }}
});
const good=validateItemImageCatalog(manifest());
assert.equal(scopedItemImageHref('',ITEM,good),'/ddv/item-images/v1.24.13/15/'+HASH+'.webp');
for(const input of [
 {...manifest(),target:{...ITEM_IMAGE_TARGET,gameVersion:'1.25.3',buildID:'9A239D3DB569756D',schema:626}},
 {...manifest(),items:{[ITEM]:{...manifest().items[ITEM],identityStatus:'UNKNOWN'}}},
 {...manifest(),items:{[ITEM]:{...manifest().items[ITEM],visibility:'UNRELEASED'}}},
 {...manifest(),items:{[ITEM]:{...manifest().items[ITEM],assetStatus:'NOT_VERIFIED'}}},
 {...manifest(),publication:{...manifest().publication,gate:'OFF'}}
])assert.throws(()=>validateItemImageCatalog(input),/ITEM_IMAGE_/);
for(const badBase of ['https://evil.invalid','//evil.invalid','/web/../','/web/%2e%2e'])
 assert.equal(scopedItemImageHref(badBase,ITEM,good),null);
assert.equal(scopedItemImageHref('',ITEM+'?redirect=evil',good),null);
assert.equal(scopedItemImageHref('',Number.MAX_SAFE_INTEGER+1,good),null);
console.log('QR609_INDEPENDENT_FUTURE_BUILD_UNRELEASED_OFF_UNSAFE_BASE_FAILCLOSED_PASS');

for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 assert.ok(!process.env[k],'private original forbidden in shared QA');
assert.ok(process.env.CHROME_BIN,'NOT_RUN installed system Chrome required');
const origin='http://127.0.0.1:4178';
// Pure synthetic generated thumbnail, 8x8 WebP, no game-file image.
const webp=Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAACQAQCdASoIAAgAAkA4JZgCdLoAA5gA/uu3r9XYnwoQT+N5vNbHYAAA','base64');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const denied=[],errors=[],mediaRequests=[];
async function createPage(withManifest){
 const ctx=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN WebSocket interception required');
 await page.routeWebSocket('**/*',r=>{
  const u=new URL(r.url());
  // Local Vite HMR attempts ws://127.0.0.1:4178; close it deliberately,
  // but don't misclassify dev-server HMR as a remote Provider/Cloud exfil.
  const localHmr=u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4178';
  if(!localHmr)denied.push('WS '+r.url());
  r.close();
 });
 await page.route('**/*',r=>{
  const req=r.request(),u=new URL(req.url());
  if(u.origin===origin&&['GET','HEAD'].includes(req.method()))r.continue();
  else {denied.push(req.method()+' '+req.url());r.abort('blockedbyclient');}
 });
 if(withManifest){
  await page.route('**/ddv/item-images/v1/manifest.json',r=>r.fulfill({
   status:200,contentType:'application/json',body:JSON.stringify(manifest()),
   headers:{'Cache-Control':'no-store'}
  }));
  await page.route('**/ddv/item-images/v1.24.13/**/*.webp',r=>{
   mediaRequests.push(r.request().url());
   return r.fulfill({status:200,contentType:'image/webp',body:webp,headers:{'Cache-Control':'no-store'}});
  });
 }
 return {ctx,page};
}
async function showItem(page){
 const resp=await page.goto(origin+'/explore/',{waitUntil:'networkidle',timeout:50000});
 assert.equal(resp?.status(),200);
 const search=page.locator('.controls input[type="search"]');
 await search.waitFor({state:'visible',timeout:30000});
 await search.fill(ITEM);
 const thumb=page.locator('[data-item-thumb-id="'+ITEM+'"]').first();
 await thumb.waitFor({state:'visible',timeout:30000});
 return thumb;
}
async function noOverflow(page,label){
 const s=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(s.scroll<=s.width+2,label+' '+JSON.stringify(s));
}
try{
 const missing=await createPage(false);
 const off=await showItem(missing.page);
 await missing.page.waitForTimeout(350);
 assert.equal(await off.getAttribute('data-media-status'),'unavailable');
 assert.equal(await off.locator('img').count(),0,'no image without a published manifest');
 await missing.ctx.close();
 console.log('QR609_INDEPENDENT_MISSING_MANIFEST_REFUSES_REAL_IMG_PASS');

 const goodCtx=await createPage(true);
 const page=goodCtx.page;
 const thumb=await showItem(page);
 await page.waitForFunction(id=>{
  const x=document.querySelector('[data-item-thumb-id="'+id+'"] img');
  return Boolean(x&&x.complete&&x.naturalWidth===8);
 },ITEM,{timeout:30000});
 assert.equal(await thumb.getAttribute('data-media-status'),'verified-public-image');
 assert.equal(await thumb.locator('img').getAttribute('src'),'/ddv/item-images/v1.24.13/15/'+HASH+'.webp');
 assert.ok((await thumb.locator('img').getAttribute('alt'))?.length>0);
 assert.ok(mediaRequests.length>=1,'same-origin image actually requested');
 console.log('QR609_INDEPENDENT_BROWSER_RIGHTS_CLEAN_SYNTHETIC_WEBP_VISIBLE_PASS');
 const controls=page.locator('[data-item-image-layout-controls]');
 await controls.locator('summary').click();
 const selects=controls.locator('select');
 await selects.nth(0).selectOption('80');
 await selects.nth(1).selectOption('cover');
 await selects.nth(2).selectOption('compact');
 assert.match(await thumb.locator('img').getAttribute('style'),/object-fit:\s*cover/);
 assert.match(await thumb.getAttribute('style'),/80px/);
 const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('wand.item-image.visual-preferences@1')||'null'));
 assert.deepEqual(prefs,{size:80,fit:'cover',density:'compact'});
 await page.reload({waitUntil:'networkidle'});
 await page.locator('[data-item-image-layout-controls]').waitFor({state:'visible'});
 assert.match(await page.locator('[data-item-image-layout-controls] summary').innerText(),/Item image layout/);
 console.log('QR609_INDEPENDENT_LAYOUT_FIT_DENSITY_PERSIST_ONLY_PREFS_PASS');
 const locales=['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'];
 for(const locale of locales){
  await page.locator('#site-locale').selectOption(locale);
  await page.waitForFunction(l=>document.documentElement.lang===l,locale,{timeout:16000});
  const summary=await page.locator('[data-item-image-layout-controls] summary').innerText();
  assert.ok(summary.trim().length>0);
 }
 await page.setViewportSize({width:320,height:780});
 await noOverflow(page,'Explore 320');
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await noOverflow(page,'Explore 200 percent');
 await page.evaluate(()=>{document.documentElement.style.zoom=''});
 assert.deepEqual(errors,[],'JS page exceptions must be zero');
 assert.deepEqual(denied,[],'no remote/offorigin/POST/WS media and Writer requests');
 await goodCtx.ctx.close();
 console.log('QR609_INDEPENDENT_8LOCALE_320_200_NO_EXFIL_NO_WRITER_PASS');
}finally{await browser.close();}
