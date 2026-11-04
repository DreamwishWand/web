// Independent 04 QR new-only PR380 shared ItemID relations/search/locale/Version privacy.
// Genuine Chromium on static verified Catalog; no private Save, art or public HTTP release.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const root='http://127.0.0.1:4201';
const ITEM='40000047';
const executablePath=process.env.CHROME_BIN;
assert.ok(executablePath);
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1100,height:850},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],badNetwork=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',r=>{
 const url=new URL(r.url());
 if(r.method()!=='GET'||url.origin!==root)badNetwork.push(r.method()+' '+url.href);
});
const mark=s=>console.log('QR_ENTITY380_'+s+'_PASS');
try {
 await page.goto(root+'/editor/items/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:35000});
 const editor=page.locator('[data-editor-item-surface]');
 assert.equal(await editor.getAttribute('data-owned'),'unknown');
 assert.equal(await editor.getAttribute('data-writer'),'off');
 await page.locator('[data-shared-query]').fill(ITEM);
 await page.locator('[data-shared-results] a').first().waitFor();
 assert.match(await page.locator('[data-shared-results]').innerText(),new RegExp(ITEM));
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');
 mark('EDITOR_ITEMS_SOURCE_CATALOG_UNOWNED_OFF');
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
   await page.goto(root+'/'+lang+'/'+ITEM+'/',{waitUntil:'domcontentloaded'});
   await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:35000});
   const detail=page.locator('[data-shared-entity-detail]');
   assert.equal(await detail.getAttribute('lang'),lang);
   assert.equal(await detail.getAttribute('data-public-indexable'),'false');
   assert.equal(await detail.getAttribute('data-writer'),'off');
   assert.equal(await page.locator('[data-shared-discovery]').getAttribute('data-personal-state'),'unknown');
   assert.match(await page.locator('[data-entity-identity]').innerText(),new RegExp(ITEM));
   assert.match(await page.locator('[data-entity-identity]').innerText(),/52BD625D9B4E0053/);
   const links=await page.locator('[data-shared-related] a').evaluateAll(as=>as.map(a=>a.pathname));
   assert.ok(links.length>0,lang+' related links missing');
   assert.ok(links.every(path=>path.startsWith('/'+lang+'/')&&/\/[0-9]+\/$/.test(path)),lang+' locale route unstable');
   assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');
 }
 mark('EIGHT_LOCALE_VERIFIED_TYPED_ID_RELATED_URLS_NOINDEX');
 await page.locator('[data-shared-query]').fill(ITEM);
 await page.locator('[data-shared-results] a').first().waitFor({timeout:16000});
 assert.equal(await page.locator('[data-shared-results] a').count(),1);
 await page.locator('[data-shared-family]').selectOption('Fish');
 await page.locator('[data-shared-empty]').waitFor();
 assert.equal(await page.locator('[data-shared-results] a').count(),0);
 await page.locator('[data-shared-family]').selectOption('Furniture');
 await page.locator('[data-shared-results] a').first().waitFor({timeout:15000});
 mark('FACET_COMPOSITION_POSITIVE_NEGATIVE');
 await page.goto(root+'/en/999999999/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-shared-entity-detail="preview"] h1').waitFor();
 assert.equal(await page.locator('[data-shared-detail-moodboard-action]').count(),0);
 assert.equal(await page.locator('[data-shared-discovery="READY"]').count(),0);
 mark('UNKNOWN_ID_NO_RELATIONS_NO_MOODBOARD');
 const denied=await browser.newContext({viewport:{width:900,height:750},serviceWorkers:'block'});
 const denyPage=await denied.newPage();
 await denyPage.route('**/ddv/collection/v1.25/index.json',async route=>{
   const response=await route.fetch();
   const index=await response.json();
   index.t.buildID='UNVERIFIED_BID';
   await route.fulfill({json:index});
 });
 await denyPage.goto(root+'/en/'+ITEM+'/',{waitUntil:'domcontentloaded'});
 await denyPage.getByRole('heading',{name:'Verified detail unavailable'}).waitFor({timeout:35000});
 assert.equal(await denyPage.locator('[data-shared-detail-moodboard-action]').count(),0);
 assert.equal(await denyPage.locator('[data-shared-discovery="READY"]').count(),0);
 await denied.close();
 mark('FORGED_BID_UNAVAILABLE_IN_BROWSER');
 await page.goto(root+'/ja/'+ITEM+'/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:35000});
 await page.setViewportSize({width:320,height:740});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),'mobile overflow');
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),'200% overflow');
 assert.deepEqual(badNetwork,[]);
 assert.deepEqual(errors,[]);
 mark('320_ZOOM200_NO_PRIVATE_NETWORK_ERRORS');
 console.log('QR_ENTITY380_INDEPENDENT_ACTUAL_CHROMIUM_NEW_ONLY_PASS');
} finally {
 await context.close();
 await browser.close();
}
