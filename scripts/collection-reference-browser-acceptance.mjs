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
 assert(await page.locator('.view-switch button[aria-pressed="true"]').count()===1,'Missing active default view');
 assert((await page.locator('.view-switch button[aria-pressed="true"]').textContent()).includes('Category'),'Category not default');
 ok('CATALOG_12552_CATEGORY_DEFAULT_AND_120_WINDOW');

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
 await page.locator('.view-switch button').nth(1).click();
 assert((await page.locator('.view-switch button[aria-pressed="true"]').textContent()).includes('World'),'World alternate lens missing');
 await page.locator('.collection-controls select').selectOption({index:1});
 await eventually(async()=>await page.locator('.collection-card').count()>0);
 const lensHref=await page.locator('.collection-card').first().getAttribute('href');
 assert(lensHref?.includes('view=world')&&lensHref?.includes('world='),'World selection absent from detail link');
 await page.locator('.collection-card').first().click();
 await eventually(async()=>await page.locator('[data-collection-state="item-detail"]').count()===1);
 await page.locator('.back-link').click();
 await eventually(async()=>await page.locator('.view-switch button[aria-pressed="true"]').textContent().then(t=>t.includes('World')));
 assert((await page.locator('.collection-controls select').inputValue())!=='','World filter not restored');
 ok('SINGLE_WORKSPACE_WORLD_FACET_ROUND_TRIP');

 await page.locator('.view-switch button').nth(2).click();
 assert((await page.locator('.view-switch button[aria-pressed="true"]').textContent()).includes('Universe'),'Universe alternate lens missing');
 await page.locator('.search input').fill('___NO_SUCH_NAMED_ITEM____');
 await eventually(async()=>await page.locator('.empty').count()===1);
 ok('UNIVERSE_FILTER_AND_EMPTY_SEARCH');
 await page.locator('.search input').fill('');

 await page.goto(base+'/collection/?item=9999999999999',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-collection-state="unknown-item"]').count()===1);
 assert(await page.locator('.item-detail').count()===0,'Unknown ItemID opened detail');
 ok('UNKNOWN_ITEM_FAIL_CLOSED');

 await page.goto(base+'/collection/?item=123&version=1.25.3',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('[data-collection-state="unsupported-version"]').count()===1);
 assert(await page.locator('.item-detail').count()===0,'Unverified game version opened Item detail');
 assert(await page.locator('.collection-card').count()===0,'Unverified game version showed catalog rows');
 ok('UNSUPPORTED_SWITCH_1253_DENIED');

 await page.goto(base+'/collection/',{waitUntil:'domcontentloaded'});
 await eventually(async()=>await page.locator('.collection-card').count()>0);
 await page.locator('.collection-card').first().click();
 await eventually(async()=>await page.locator('.item-detail').count()===1);
 await page.setViewportSize({width:320,height:820});
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of locales){
   await page.locator('#site-locale').selectOption(locale);
   await eventually(async()=>await page.locator('html').getAttribute('lang')===locale);
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
