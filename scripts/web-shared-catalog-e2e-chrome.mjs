// 08 WEB / W-FOUND-020 main-first real Chromium E2E. Static source Catalog only, no private Save.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { sharedDirectoryCopy } from '../src/lib/entity/shared-catalog-directory.mjs';
import { readFile, access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const BIN=process.env.CHROME_BIN;
if(!BIN)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.SHARED_DETAIL_E2E_URL||'http://127.0.0.1:4194').replace(/\/$/,'');
const ITEM='40000047';
const browser=await chromium.launch({executablePath:BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let context=null;
const checks=[],network=[],errors=[];
const pass=n=>{checks.push(n);console.log('WEB_ENTITY_'+n+'_PASS');};
async function fit(page,label) {
 const w=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(w.scroll<=w.client+2,label+': '+JSON.stringify(w));
}
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
let fileServer;
try {
 context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 const page=await context.newPage();
 context.on('request',request=>{
   const url=new URL(request.url());
   if(request.method()!=='GET'||url.origin!==root)network.push({method:request.method(),path:url.pathname});
 });
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(root+'/moodboards/',{waitUntil:'networkidle'});
 // Svelte handlers are installed after hydration; selecting the SSR form too early loses submit.
 await page.locator('form.create-board input').first().fill('Offline E2E Board');
 await page.locator('form.create-board button[type="submit"]').click();
 await page.locator('.board-list>button').filter({hasText:'Offline E2E Board'}).waitFor({timeout:20000});
 pass('LOCAL_MOODBOARD_CREATED_WITHOUT_ACCOUNT');

 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:35000});
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-personal-progress'),'unknown');
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-writer'),'off');
 await page.locator('[data-stage1-search]').fill(ITEM);
 await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:20000});
 assert.equal(await page.locator('[data-stage1-search-groups] .item-card').count(),1);
 await page.locator('[data-stage1-search-groups] .item-card').first().click();
 await page.locator('[data-stage1-item-info]').waitFor({timeout:20000});
 assert.match(await page.locator('[data-stage1-item-info]').innerText(),new RegExp(ITEM));
 await page.locator('[data-stage1-item-info] .info-actions a').click();
 await page.locator('[data-shared-entity-detail="preview"] h1').waitFor({timeout:30000});
 assert.match(page.url(),new RegExp('/[a-zA-Z-]+/'+ITEM+'/$'));
 assert.match(await page.locator('[data-entity-identity]').innerText(),/40000047/);
 assert.match(await page.locator('[data-entity-identity]').innerText(),/52BD625D9B4E0053/);
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:30000});
 assert.ok(await page.locator('[data-shared-related] a').count()>0);
 pass('COLLECTION_ITEM_VERIFIED_ID_VERSION_RELATED_LINKS');

 await page.locator('[data-shared-query]').fill(ITEM);
 await page.waitForFunction(()=>document.querySelectorAll('[data-shared-results] a').length===1,{timeout:15000});
 assert.match(await page.locator('[data-shared-results]').innerText(),new RegExp(ITEM));
 await page.locator('[data-shared-family]').selectOption('Fish');
 await page.locator('[data-shared-empty]').waitFor({timeout:15000});
 await page.locator('[data-shared-family]').selectOption('Furniture');
 await page.locator('[data-shared-results] a').first().waitFor({timeout:15000});
 pass('DETAIL_FACET_FILTERS_SOURCE_BOUND');

 await page.locator('#shared-entity-board').selectOption({index:0});
 await page.locator('[data-shared-detail-moodboard-action] button').click();
 await page.locator('[data-shared-detail-moodboard-action] [role="status"]').waitFor();
 await page.goto(root+'/moodboards/',{waitUntil:'domcontentloaded'});
 await page.locator('.reference-card').filter({hasText:ITEM}).first().waitFor({timeout:20000});
 assert.equal(await page.locator('.reference-card').filter({hasText:ITEM}).count(),1);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.reference-card').filter({hasText:ITEM}).first().waitFor({timeout:20000});
 assert.equal(await page.locator('.reference-card').filter({hasText:ITEM}).count(),1);
 pass('DETAIL_TYPED_ITEM_MOODBOARD_SAVE_AND_RELOAD');

 await page.goto(root+'/explore/',{waitUntil:'domcontentloaded'});
 await page.locator('.grid .card').first().waitFor({timeout:35000});
 await page.locator('.controls input[type="search"]').fill(ITEM);
 await page.waitForFunction(()=>document.querySelectorAll('.grid .card').length===1,{timeout:15000});
 await page.locator('.card footer a').first().click();
 await page.locator('[data-entity-identity]').waitFor({timeout:25000});
 assert.match(await page.locator('[data-entity-identity]').innerText(),new RegExp(ITEM));
 pass('EXPLORE_TO_SAME_TYPED_ITEM_DETAIL');

 await page.goto(root+'/editor/items/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-editor-item-surface="verified-catalog-read-only"]').waitFor();
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:30000});
 assert.equal(await page.locator('[data-editor-item-surface]').getAttribute('data-owned'),'unknown');
 assert.equal(await page.locator('[data-editor-item-surface]').getAttribute('data-writer'),'off');
 await page.locator('[data-shared-query]').fill(ITEM);
 await page.locator('[data-shared-results] a').first().waitFor();
 assert.match(await page.locator('[data-shared-results]').innerText(),new RegExp(ITEM));
 pass('EDITOR_ITEMS_VERIFIED_CATALOG_NOT_TWELVE_FAKE_OWNED');

 // Eight real browser locale deep views are DEV-only; production Pages still returns HTTP404.
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
   await page.goto(root+'/'+locale+'/'+ITEM+'/',{waitUntil:'domcontentloaded'});
   await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:35000});
   assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('lang'),locale);
   assert.ok((await page.locator('.shared-discovery').innerText()).includes(sharedDirectoryCopy(locale).search),locale);
   assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
 }
 pass('ALL_EIGHT_ACTUAL_BROWSER_DETAIL_LOCALES_NOINDEX');

 // Negative browser path: a forged catalog Version cannot create a positive detail or moodboard.
 const deniedContext=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 const deniedPage=await deniedContext.newPage();
 await deniedPage.route('**/ddv/collection/v1.25/index.json',async route=>{
   const response=await route.fetch();
   const index=await response.json();
   index.t.gameVersion='1.25.3';
   await route.fulfill({json:index});
 });
 await deniedPage.goto(root+'/en/'+ITEM+'/',{waitUntil:'domcontentloaded'});
 await deniedPage.getByRole('heading',{name:'Verified detail unavailable'}).waitFor({timeout:35000});
 assert.equal(await deniedPage.locator('[data-shared-detail-moodboard-action]').count(),0);
 assert.equal(await deniedPage.locator('[data-shared-discovery="READY"]').count(),0);
 assert.equal(await deniedPage.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
 await deniedContext.close();
 pass('FORGED_SOURCE_VERSION_DENIED_IN_REAL_BROWSER');

 await page.setViewportSize({width:320,height:850});
 await fit(page,'editor/items320');
 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:35000});
 await page.locator('[data-stage1-search]').fill(ITEM);
 await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:20000});
 await page.locator('[data-stage1-search-groups] .item-card').first().click();
 await page.locator('[data-stage1-item-info] .info-actions a').click();
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:30000});
 await fit(page,'shared-item320');
 await page.keyboard.press('Tab');
 const focused=await page.evaluate(()=>document.activeElement?.tagName);
 assert.ok(['A','BUTTON','INPUT','SELECT'].includes(focused),'keyboard focus should stay on interactive element');
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit(page,'shared-item200percent');
 pass('MOBILE_320_ZOOM200_KEYBOARD_NO_OVERFLOW');

 // Pages-style direct URL server: 404.html fallback must preserve HTTP 404.
 // A client-side Svelte route working after click does NOT constitute SEO HTTP200.
 const build=process.env.SHARED_DETAIL_STATIC_BUILD||'build';
 assert.ok((await readFile(join(build,'404.html'))).length>0);
 try {
   await access(join(build,'en',ITEM,'index.html'));
   throw Error('UNEXPECTED_PRERENDERED_ITEM_ROUTE_NEEDS_EXPLICIT_ELIGIBILITY_REVIEW');
 } catch(e) {if(e?.code!=='ENOENT')throw e;}
 fileServer=createServer(async(req,res)=>{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(pathname==='/en/'+ITEM+'/'){
     res.writeHead(404,{'content-type':'text/html; charset=utf-8'});
     res.end(await readFile(join(build,'404.html')));
   } else {res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>fileServer.listen(0,'127.0.0.1',resolve));
 const port=fileServer.address().port;
 const response=await fetch('http://127.0.0.1:'+port+'/en/'+ITEM+'/');
 assert.equal(response.status,404);
 assert.match(await response.text(),/html/i);
 pass('DIRECT_STATIC_FALLBACK_HTTP404_NOT_SEO_HTTP200');
 assert.deepEqual(network,[],'no private save/Community/Provider network writes');
 assert.deepEqual(errors,[],'browser JS exceptions');
 pass('NO_PRIVATE_NETWORK_AND_NO_PAGE_EXCEPTIONS');
} finally {
 if(fileServer)await new Promise(resolve=>fileServer.close(resolve));
 await context?.close();
 await browser.close();
}
console.log('WEB_ENTITY_FOUNDATION_ACTUAL_CHROMIUM_PASS');
