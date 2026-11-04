/** 04 QR-W independently authored ACTUAL Chrome Stage1 Guide visual + keyboard.
 * No private P1G, service session, unapproved artwork, or public work data.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {guideCopy} from '../src/lib/guide/copy.js';
if(!process.env.CHROME_BIN)throw Error('QR522_CHROME_NOT_INSTALLED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)throw Error('QR522_PRIVATE_SAVE_CI_FORBIDDEN');
const target=new URL(process.env.QR522_URL??'http://127.0.0.1:4286/guide/');
if(target.href!=='http://127.0.0.1:4286/guide/')throw Error('QR522_EXACT_LOOPBACK_REQUIRED');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const types=['quests','starPaths','events','systems'];
const errors=[],denied=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR522_WS_BLOCK_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4286')route.connectToServer();
  else{denied.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===target.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{denied.push(route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(target.href,{waitUntil:'domcontentloaded'});
 const hub=page.locator('[data-stage1-guide-hub]');
 await hub.waitFor({state:'visible',timeout:30000});
 const cards=hub.locator('button.guide-hub-card');
 const expectedKeys=types;
 for(const lang of locales){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(({q,e})=>{
    const got=document.querySelector('[data-guide-child="quests"] strong')?.textContent?.trim();
    return got===e&&document.querySelector('#site-locale')?.value===q;
  },{q:lang,e:guideCopy(lang).quests},{timeout:20000});
  assert.equal(await cards.count(),4,lang+' count');
  const got=await cards.evaluateAll(a=>a.map(x=>x.getAttribute('data-guide-child')));
  assert.deepEqual(got,expectedKeys,lang+' order');
  for(const key of types){
   const expected=guideCopy(lang)[key];
   assert.equal((await hub.locator('[data-guide-child="'+key+'"] strong').innerText()).trim(),expected,lang+':'+key);
  }
  assert.equal(await page.locator('[data-guide-child="issues"]').count(),0);
  assert.equal(await page.locator('.guide-tabs').count(),0,'root cannot already be flat Guide workbench');
 }
 console.log('QR522 ACTUAL GUIDE8 LOCALES TRANSLATED FOUR LABELS/ORDER/NO ISSUES PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(e=>document.querySelector('[data-guide-child="quests"] strong')?.textContent?.trim()===e,guideCopy('ja').quests);
 const screenshot=await page.screenshot({type:'png',fullPage:false,animations:'disabled'});
 assert.ok(screenshot.length>9000,'rendered desktop screenshot must have nonempty visual pixels');
 console.log('QR522 VISUAL DESKTOP SCREENSHOT PNG IN-MEMORY SHA256 '+createHash('sha256').update(screenshot).digest('hex').slice(0,16));
 // Keyboard Enter activation/return is a user path, not a static string test.
 for(const key of types){
  const card=hub.locator('[data-guide-child="'+key+'"]');
  await card.focus();
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-guide-child')),key);
  await page.keyboard.press('Enter');
  await hub.waitFor({state:'detached'});
  const nav=page.locator('.guide-tabs');
  await nav.waitFor();
  assert.equal(await nav.locator('button').count(),4,key+' only four read workbench tabs');
  assert.equal(await page.locator('button.guide-back').count(),1);
  assert.equal(await page.locator('.guide-workspace').count(),1);
  assert.equal(await page.locator('[data-guide-child="issues"]').count(),0);
  if(key==='quests'){
   const search=page.locator('.guide-page .search input[type=search]');
   await search.fill('!QR522_NO_SUCH_VERIFIED_QUEST_9031!');
   await page.locator('.guide-page .result-list button').count().then(n=>assert.equal(n,0));
   assert.equal(await page.locator('.guide-page .empty').count()>0,true,'unmatched data must show empty state');
  }
  await page.locator('button.guide-back').click();
  await hub.waitFor({state:'visible'});
  assert.equal(await page.locator('.guide-page .search input[type=search]').count(),0);
 }
 console.log('QR522 KEYBOARD ENTER FOUR WORKSPACES/UNKNOWN QUERY/BACK PASS');
 // Issues remains Help Center only, with no mutation to Guide data or public positive content.
 await page.goto(target.origin+'/help/',{waitUntil:'domcontentloaded'});
 const help=page.locator('[data-help-root="four-children"]');
 await help.waitFor();
 assert.equal(await help.locator('a[href*="/help/issues/"]').count(),1);
 assert.equal(await help.locator('.public-children a').count(),3);
 assert.equal(await help.locator('.personal').count(),1);
 await page.goto(target.href,{waitUntil:'domcontentloaded'});
 await hub.waitFor();
 await page.setViewportSize({width:320,height:780});
 const metrics=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(metrics.scroll<=metrics.w+2,JSON.stringify(metrics));
 assert.equal(await cards.count(),4);
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>6000);
 await page.setViewportSize({width:640,height:860});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.w+2,JSON.stringify(zoom));
 const zoomScreen=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoomScreen.length>6000);
 assert.equal(await cards.count(),4);
 console.log('QR522 320PX AND 200PERCENT SCREENSHOTS IN-MEMORY/NO OVERFLOW PASS');
 assert.deepEqual(denied,[]);
 assert.deepEqual(errors,[]);
 console.log('QR522 NO OFFHOST/POST/WS/PRIVATE DATA/PAGE ERRORS PASS');
 await context.close();
}finally{await browser.close();}
