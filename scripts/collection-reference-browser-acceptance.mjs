import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base=(process.env.COLLECTION_BASE_URL||'http://127.0.0.1:4175').replace(/\/$/,'');
const chrome=process.env.CHROME_BIN;
if(!chrome)throw new Error('CHROME_BIN is required.');
const artifactDir='.artifacts/collection-browser';
await mkdir(artifactDir,{recursive:true});
const report={checks:[],synthetic:false,source:'existing checked-in v1.25.0 reference shards; network failure injected only for negative test',
  pageErrors:[],consoleErrors:[]};
const ok=(name)=>report.checks.push(name);
function assert(b,msg){if(!b)throw Error(msg);}
async function eventually(fn,timeout=40000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,160));}throw Error('Timeout waiting for '+String(fn).slice(0,100));}
async function reflow(page){
 const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 assert(dims.scroll<=dims.client+2,'Horizontal overflow '+JSON.stringify(dims));
}
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900}});
const page=await context.newPage();
page.on('pageerror',error=>report.pageErrors.push(String(error)));
page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
try{
 await page.goto(base+'/collection/',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('.collection-card').count()===120);
 assert(await page.locator('.view-switch').count()===0,'Permanent World/Universe modes must not exist');
 assert(await page.locator('.collection-controls select').count()===3,'Category/Universe/Expansion contextual facets missing');
 assert(await page.locator('.load-more button').count()===1,'No way to browse beyond the first 120 records');
 await page.locator('.load-more button').click();
 await eventually(async()=>await page.locator('.collection-card').count()===240);
 ok('CATALOG_12552_CATEGORY_DEFAULT_PROGRESSIVE_120_TO_240');

 const first=page.locator('.collection-card').first();
 const href=await first.getAttribute('href');
 assert(/\/collection\/\?item=\d+$/.test(href||''),'Item detail URL is not source ID only '+href);
 const expectedId=new URL(href,base).searchParams.get('item');
 await first.focus();
 assert(await first.evaluate(node=>node===document.activeElement),'Item card cannot receive keyboard focus');
 await page.keyboard.press('Enter');
 await eventually(async()=>await page.locator('[data-collection-state="item-detail"]').count()===1);
 assert(await page.locator('.item-detail dd code').first().textContent()===expectedId,'ItemID identity drift');
 assert((await page.locator('.item-detail').innerText()).includes('No DDV save'),'Owned disclaimer missing');
 assert(!(await page.locator('.item-detail').innerText()).includes('Owned: Yes'),'Invented Owned state');
 ok('SOURCE_ITEMID_DEEP_LINK_DETAIL_KEYBOARD_NO_OWNERSHIP_INFERENCE');

 await page.locator('.back-link').click();
 await eventually(async()=>await page.locator('.collection-card').count()===120);
 await page.locator('.collection-controls select').nth(1).selectOption('Mickey');
 await eventually(async()=>await page.locator('.collection-card').count()>0);
 await page.locator('.collection-controls select').nth(2).selectOption('BaseGame');
 await eventually(async()=>await page.locator('.collection-card').count()>0);
 const lensHref=await page.locator('.collection-card').first().getAttribute('href');
 assert(lensHref?.includes('universe=Mickey')&&lensHref?.includes('expansion=BaseGame'),'Universe/Expansion facet absent from detail link');
 await page.locator('.collection-card').first().click();
 await eventually(async()=>await page.locator('[data-collection-state="item-detail"]').count()===1);
 await page.locator('.back-link').click();
 await eventually(async()=>await page.locator('.collection-card').count()>0);
 assert((await page.locator('.collection-controls select').nth(1).inputValue())==='Mickey','Universe filter not restored');
 assert((await page.locator('.collection-controls select').nth(2).inputValue())==='BaseGame','Expansion filter not restored');
 ok('CATEGORY_FIRST_UNIVERSE_EXPANSION_FACET_ROUND_TRIP');

 await page.locator('.search input').fill('___NO_SUCH_NAMED_ITEM____');
 await eventually(async()=>await page.locator('.empty').count()===1);
 ok('CONTEXTUAL_FILTER_AND_EMPTY_SEARCH');
 await page.locator('.search input').fill('');

 for (const legacy of ['?view=world&world=IsDreamlightValley&item='+expectedId,
                        '?view=universe&universe=Mickey&item='+expectedId]) {
   await page.goto(base+'/collection/'+legacy,{waitUntil:'domcontentloaded'});
   await eventually(async()=>await page.locator('[data-collection-state="invalid-url"]').count()===1);
   assert(await page.locator('.item-detail').count()===0,'Legacy view mode exposed Detail');
 }
 ok('LEGACY_WORLD_UNIVERSE_VIEWMODE_DENIED');

 await page.goto(base+'/collection/?item=9999999999999',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-collection-state="unknown-item"]').count()===1);
 assert(await page.locator('.item-detail').count()===0,'Unknown ItemID opened detail');
 ok('UNKNOWN_ITEM_FAIL_CLOSED');

 await page.goto(base+'/collection/?item=123&version=1.25.3',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-collection-state="unsupported-version"]').count()===1);
 assert(await page.locator('.item-detail').count()===0,'Unverified game version opened Item detail');
 assert(await page.locator('.collection-card').count()===0,'Unverified game version showed catalog rows');
 ok('UNSUPPORTED_SWITCH_1253_DENIED');

 await page.goto(base+'/collection/?item='+expectedId,{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('.item-detail').count()===1);
 for(const suffix of [
   '&item=abc&view=???&world=WRONG',
   '&view=world&family=Furniture',
   '&item='+expectedId,
   '&view=wrong'
 ]) {
   await page.goto(base+'/collection/?item='+expectedId+suffix,{waitUntil:'domcontentloaded'});
   await eventually(async()=>await page.locator('[data-collection-state="invalid-url"]').count()===1);
   assert(await page.locator('.item-detail').count()===0,'Invalid URL retained stale Detail');
   assert(await page.locator('.collection-card').count()===0,'Invalid URL exposed browse records');
 }
 ok('QR193_URL_AMBIGUITY_CONFLICT_AND_STALE_DETAIL_DENIED');

 await page.route('**/ddv/collection/v1.25/index.json',async route=>{
   const source=await route.fetch();
   const original=await source.json();
   original.f[0]='FORGED_CATEGORY';
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(original)});
 });
 await page.goto(base+'/collection/?item='+expectedId,{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('.status.error[role="alert"]').count()===1);
 assert(await page.locator('.item-detail').count()===0,'Tampered trusted Index opened stale Detail');
 await page.unroute('**/ddv/collection/v1.25/index.json');
 await page.locator('.retry-button').click();
 await eventually(async()=>await page.locator('.item-detail').count()===1);
 assert(await page.locator('.item-detail dd code').first().textContent()===expectedId,'Retry restored wrong ItemID');
 ok('QR193_TAMPERED_INDEX_DENIED_AND_RETRY_CANONICAL_DETAIL');

 await page.goto(base+'/collection/',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('.collection-card').count()>0);
 await page.locator('.collection-card').first().click();
 await eventually(async()=>await page.locator('.item-detail').count()===1);
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of locales){
   // Desktop locale control is hidden by the responsive mobile shell. Switch on desktop,
   // then verify each 320px localized rendering with the mobile shell visible.
   await page.setViewportSize({width:1280,height:900});
   await page.locator('#site-locale').selectOption(locale);
   await eventually(async()=>await page.locator('html').getAttribute('lang')===locale);
   await page.setViewportSize({width:320,height:820});
   assert(await page.locator('.item-detail h2').textContent().then(x=>Boolean(x?.trim())),'Localized Item name missing '+locale);
   assert(await page.locator('.detail-boundary').count()===2,'Missing rights or ownership note '+locale);
   await reflow(page);
 }
 ok('EIGHT_LOCALES_ITEM_DETAIL_320PX_NO_OVERFLOW');

 await page.route('**/ddv/collection/v1.25/index.json',route=>route.fulfill({status:503,body:'offline source'}));
 await page.goto(base+'/collection/',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('.status.error[role="alert"]').count()===1);
 assert(await page.locator('.collection-card').count()===0,'Unverified data rendered after broken index');
 assert(await page.locator('.retry-button').count()===1,'Failure recovery absent');
 await page.unroute('**/ddv/collection/v1.25/index.json');
 await page.locator('.retry-button').click();
 await eventually(async()=>await page.locator('.collection-card').count()===120);
 ok('FETCH_INTEGRITY_FAILURE_AND_RETRY_RECOVERY');
 report.consoleErrors=report.consoleErrors.filter(x=>!x.includes('Failed to load resource'));
 assert(report.pageErrors.length===0,'Page errors '+report.pageErrors.join(' | '));
 assert(report.consoleErrors.length===0,'Console errors '+report.consoleErrors.join(' | '));
 report.result='PASS';report.failed=null;
 await page.screenshot({path:artifactDir+'/collection-item-detail.png',fullPage:true});
}catch(error){
 report.result='FAIL';report.failed=String(error?.stack||error);
 try{await page.screenshot({path:artifactDir+'/collection-failure.png',fullPage:true});}catch{}
 throw error;
}finally{
 await writeFile(artifactDir+'/result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 await browser.close();
}
