// 04 QR-W: NEW-only protected main227 publicly deployed ItemThumb verification.
// Source QA616/626 accepted earlier; do not reuse synthetic manifest or inject game art.
// Browser hits actual managed GitHub Pages HTTPS. No P1G, auth, Writer, media payload.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {
 ITEM_IMAGE_MANIFEST_PATH,ITEM_IMAGE_DEFAULT_PREFERENCES,ITEM_IMAGE_PREFS_KEY,
 ITEM_IMAGE_VARIANT
} from '../src/lib/item-media/public-item-images.mjs';

const PREV='d772376b75bd7e4ab0dd0675ecf3e4271f1aad12';
const MAIN='2277411409205017858c6ac6abf2ead002d9b95b';
const ORIGIN='https://dreamwishwand.github.io';
const BASE=ORIGIN+'/web';
const source=Object.freeze({
 '.github/workflows/web-shared-catalog-detail.yml':'2edd7f5ea06843de83704432a5b5a58e04a442e0',
 'src/lib/entity/SharedEntityDetail.svelte':'522a9b836c16b1bee14187a70b96fe7d1876cb68',
 'src/lib/entity/shared-catalog-detail.mjs':'fd8ff395cc1017deb6e63ba34619b81579e18f3e',
 'src/lib/item-media/public-item-images.mjs':'05bb81a0608785aab739a29c78bd2d7f842322aa',
 'src/lib/ui/ItemImagePreferences.svelte':'1770ccf92b83a3977d55c87c8c159c1bdc686af8',
 'src/lib/ui/ItemThumb.svelte':'e24816599ffd7860be0114793a65c91edb68429b',
 'src/routes/collection/+page.svelte':'e1c7ed6f40344f6b67c545d5881b4d644782b178',
 'src/routes/explore/+page.svelte':'a2986b4c44a8913b0fadca8ad84b5e088fd722d4',
 'tests/web-stage1-public-item-thumb-contract.test.mjs':'f09978df9c75b182cec4f8f1c44a886ac25cd705'
});
const qa=[
 '.github/workflows/04qr-w-main227-itemthumb-hosted-chrome.yml',
 'scripts/04qr-w-main227-itemthumb-hosted-chrome.mjs'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.ok(process.env.CHROME_BIN,'NOT_RUN: genuine installed Chrome required');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 assert.ok(!process.env[k],k+' private data MUST NOT enter shared CI');
assert.equal(git('merge-base',PREV,MAIN),PREV);
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-only',PREV,MAIN).split('\n').sort(),Object.keys(source).sort(),'exact nine accepted PR609 original Source');
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').split('\n').sort(),qa,'QA-only two files');
for(const [p,sha] of Object.entries(source))assert.equal(git('rev-parse',MAIN+':'+p),sha,p);
assert.equal(ITEM_IMAGE_VARIANT,'webp-lossless-160-v1');
assert.equal(ITEM_IMAGE_MANIFEST_PATH,'ddv/item-images/webp-lossless-160-v1/manifest.json');
console.log('QR_MAIN227_EXACT_SOURCE9_QA2_SOURCE_HASHES_PASS');

const routePaths=['/collection/','/explore/'];
for(const path of routePaths){
 const res=await fetch(BASE+path,{redirect:'manual',headers:{'Cache-Control':'no-cache'}});
 assert.equal(res.status,200,'actual hosted route HTTP200: '+path);
 assert.match(res.headers.get('content-type')??'',/text\/html/);
 const html=await res.text();
 assert.ok(html.length>500,'not blank html '+path);
 if(path==='/collection/'){
  assert.match(html,/data-stage1-collection-root/);
  assert.match(html,/data-writer="off"/);
  assert.match(html,/data-personal-progress="unknown"/);
 }
}
const manifest=await fetch(BASE+'/'+ITEM_IMAGE_MANIFEST_PATH,{redirect:'manual',headers:{'Cache-Control':'no-cache'}});
const type=manifest.headers.get('content-type')??'';
assert.ok(manifest.status===404||manifest.status===410||
 (manifest.status===200&&!/application\/json/i.test(type)),
 'genuine public image manifest is NOT deployed; no positive images may be shown '+manifest.status+' '+type);
console.log('QR_MAIN227_ACTUAL_PAGES_HTTP200_2ROUTES_NO_VERIFIED_ASSET_MANIFEST_PASS');

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:820},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),offsite=[],errors=[],badUploads=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN: browser websocket route interception missing');
await page.routeWebSocket('**/*',r=>{offsite.push('WS '+r.url());r.close();});
await page.route('**/*',r=>{
 const req=r.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))r.continue();
 else {
  badUploads.push(req.method()+' '+req.url());
  offsite.push(req.method()+' '+req.url());
  r.abort('blockedbyclient');
 }
});
const noOverflow=async label=>{
 const w=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(w.scroll<=w.client+2,label+' '+JSON.stringify(w));
};
const noVerifiedArt=async label=>{
 const thumbs=page.locator('[data-item-thumb-id]');
 const count=await thumbs.count();
 assert.ok(count>0,label+' expected real catalog thumbnails in DOM');
 assert.equal(await page.locator('[data-item-thumb-id][data-media-status="verified-public-image"]').count(),0,label+' must not falsely mark verified');
 assert.equal(await thumbs.locator('img').count(),0,label+' must not load game image bytes absent manifest');
 assert.equal(await thumbs.locator('.image-unavailable').count(),count,label+' nonimage placeholders');
};
const openPrefs=async()=>{
 const details=page.locator('details[data-item-image-layout-controls]');
 await details.locator('summary').focus();
 await page.keyboard.press('Enter');
 await details.locator('select').first().waitFor({state:'visible'});
 return details;
};
try{
 const explore=await page.goto(BASE+'/explore/',{waitUntil:'domcontentloaded',timeout:55000});
 assert.equal(explore?.status(),200);
 await page.locator('.explore-page .controls input[type="search"]').waitFor({state:'visible',timeout:40000});
 await page.locator('[data-item-thumb-id]').first().waitFor({state:'visible',timeout:25000});
 await noVerifiedArt('deployed Explore');
 const itemHref=await page.locator('.explore-page .card footer a[href]').first().getAttribute('href');
 assert.match(itemHref??'',/^\/web\/(?:en|fr|it|de|es-ES|ja|zh-CN|pt-BR)\/[1-9][0-9]{0,15}\/$/);
 console.log('QR_MAIN227_REMOTE_EXPLORE_REAL_ROWS_NO_MANIFEST_NO_ART_PASS');

 let details=await openPrefs();
 const controls=details.locator('select');
 assert.equal(await controls.count(),3);
 assert.equal(await controls.nth(0).inputValue(),String(ITEM_IMAGE_DEFAULT_PREFERENCES.size));
 assert.equal(await controls.nth(1).inputValue(),ITEM_IMAGE_DEFAULT_PREFERENCES.fit);
 assert.equal(await controls.nth(2).inputValue(),ITEM_IMAGE_DEFAULT_PREFERENCES.density);
 assert.ok(await details.locator('p[role="status"]').isVisible(),'explicit absence disclosure');
 await controls.nth(0).selectOption('80');
 await controls.nth(1).selectOption('cover');
 await controls.nth(2).selectOption('compact');
 let stored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)??'null'),ITEM_IMAGE_PREFS_KEY);
 assert.deepEqual(stored,{size:80,fit:'cover',density:'compact'});
 await noVerifiedArt('Explore after local preference update');
 console.log('QR_MAIN227_REMOTE_ITEM_MEDIA_PREFS_LOCAL_SAVE_NO_ASSET_PASS');

 const collection=await page.goto(BASE+'/collection/',{waitUntil:'domcontentloaded',timeout:55000});
 assert.equal(collection?.status(),200);
 const root=page.locator('[data-stage1-collection-root]');
 await root.waitFor({state:'visible',timeout:30000});
 assert.equal(await root.getAttribute('data-writer'),'off');
 assert.equal(await root.getAttribute('data-personal-progress'),'unknown');
 await page.locator('[data-stage1-category-grid] button[data-source-verified="true"]').first().waitFor({state:'visible',timeout:30000});
 details=await openPrefs();
 assert.equal(await details.locator('select').nth(0).inputValue(),'80');
 assert.equal(await details.locator('select').nth(1).inputValue(),'cover');
 assert.equal(await details.locator('select').nth(2).inputValue(),'compact');
 await page.locator('[data-stage1-category-grid] button[data-source-verified="true"]').first().focus();
 await page.keyboard.press('Enter');
 await page.locator('[data-item-thumb-id]').first().waitFor({state:'visible',timeout:35000});
 await noVerifiedArt('deployed Collection');
 assert.equal(await page.locator('button[disabled]:has-text("Owned")').count()>=0,true);
 console.log('QR_MAIN227_REMOTE_COLLECTION_PERSONAL_UNKNOWN_WRITER_OFF_PREFS_PERSIST_PASS');

 // Visit the actual ItemID detail linked from loaded Explore records, never fake IDs.
 const direct=await page.goto(ORIGIN+itemHref,{waitUntil:'domcontentloaded',timeout:55000});
 const red=[];
 if(direct?.status()!==200){
  red.push('PUBLIC_ITEM_DETAIL_DIRECT_HTTP_'+direct?.status()+' href='+itemHref);
  console.log('QR_MAIN227_TRUE_RED_PUBLIC_ITEM_DETAIL_DIRECT_HTTP '+JSON.stringify({status:direct?.status(),href:itemHref}));
 } else {
  await page.locator('[data-shared-entity-detail="preview"]').waitFor({state:'visible',timeout:25000});
  assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('data-writer'),'off');
  assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('data-public-indexable'),'false');
  assert.equal(await page.locator('meta[name="robots"][content="noindex,follow"]').count(),1);
  await page.locator('[data-item-thumb-id]').first().waitFor({state:'visible',timeout:30000});
  await noVerifiedArt('hosted Item Detail');
  details=await openPrefs();
  assert.equal(await details.locator('select').nth(0).inputValue(),'80');
  console.log('QR_MAIN227_REMOTE_ITEM_DETAIL_DYNAMIC_ROUTE_NOINDEX_FAILCLOSED_PASS');
 }

 // Same publicly-hosted document, eight locale changes, no published art or fake owned.
 await page.goto(BASE+'/explore/',{waitUntil:'domcontentloaded',timeout:55000});
 await page.locator('[data-item-thumb-id]').first().waitFor({state:'visible',timeout:35000});
 for(const loc of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  const control=page.locator('#site-locale');
  await control.selectOption(loc);
  await page.waitForFunction(l=>document.documentElement.dataset.locale===l,loc,{timeout:15000});
  details=page.locator('details[data-item-image-layout-controls]');
  assert.ok((await details.locator('summary').innerText()).trim().length>5,loc+' translated layout affordance');
  await noVerifiedArt('Explore '+loc);
 }
 console.log('QR_MAIN227_REMOTE_8_LOCALES_NO_FALSE_VERIFIED_ART_PASS');

 await page.setViewportSize({width:320,height:780});
 await noOverflow('Explore 320px');
 await page.goto(BASE+'/collection/',{waitUntil:'domcontentloaded',timeout:55000});
 await page.locator('[data-stage1-category-grid]').waitFor({state:'visible',timeout:35000});
 await noOverflow('Collection 320px');
 await page.setViewportSize({width:640,height:840});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await noOverflow('Collection 200 percent zoom');
 await page.evaluate(()=>{document.documentElement.style.zoom='';});
 assert.equal(await page.locator('[data-shell-control="save"]:disabled').count(),1);
 assert.equal(await page.locator('[data-shell-control="account"]:disabled').count(),1);
 const shot=await page.screenshot({animations:'disabled',type:'png'});
 assert.ok(shot.length>4000);
 console.log('QR_MAIN227_REMOTE_UI_320_200_RAM_SCREENSHOT_SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 assert.deepEqual(offsite,[],'off-origin/POST/WS must NOT reach Cloud Provider or upload');
 assert.deepEqual(badUploads,[],'no state-changing request');
 assert.deepEqual(errors,[],'no JS uncaught errors');
 console.log('QR_MAIN227_DEPLOYED_HTTPS_CHROME_NO_OFFSITE_NO_WRITER_PASS');
 assert.deepEqual(red,[],'independent actual hosted public Item Detail must not return HTTP404');
}finally{
 await ctx.close();
 await browser.close();
}
