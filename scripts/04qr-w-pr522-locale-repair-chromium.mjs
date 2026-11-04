/** Actual independent system Chromium for repaired Stage1 Guide locale root.
 * Frozen PR522 NEW fixed Source. Screenshots are in memory; no provider or P1G.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {guideCopy} from '../src/lib/guide/copy.js';
if(!process.env.CHROME_BIN)throw Error('QR522_REPAIRED_REAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR522_REPAIRED_PRIVATE_P1G_CI_DENIED');
const url=new URL(process.env.QR522_REPAIRED_URL??'http://127.0.0.1:4292/guide/');
if(url.href!=='http://127.0.0.1:4292/guide/')throw Error('QR522_REPAIRED_EXACT_LOOPBACK_REQUIRED');
const languages=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const roots=['quests','starPaths','events','systems'];
const deny=[],errors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR522_REPAIRED_WS_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4292')route.connectToServer();
  else{deny.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{deny.push(route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 const hub=page.locator('[data-stage1-guide-hub]');
 await hub.waitFor({state:'visible',timeout:30000});
 const cards=hub.locator('button.guide-hub-card');
 for(const lang of languages){
  await page.locator('#site-locale').selectOption(lang);
  try{
   await page.waitForFunction(({lang,expected})=>
    document.documentElement.dataset.locale===lang &&
    document.querySelector('[data-guide-child="quests"] strong')?.textContent?.trim()===expected,
    {lang,expected:guideCopy(lang).quests},{timeout:12000});
  }catch(err){
   const current=await page.evaluate(()=>({language:document.documentElement.lang,code:document.documentElement.dataset.locale,selector:document.querySelector('#site-locale')?.value,label:document.querySelector('[data-guide-child="quests"] strong')?.textContent?.trim()}));
   throw Error('QR522_REPAIRED_GUIDE_LOCALE_STALE '+JSON.stringify({lang,expect:guideCopy(lang).quests,current}));
  }
  assert.deepEqual(await cards.evaluateAll(els=>els.map(x=>x.getAttribute('data-guide-child'))),roots,lang+' 4 root order');
  for(const root of roots){
   assert.equal((await cards.locator('[data-guide-child="'+root+'"] strong').innerText()).trim(),guideCopy(lang)[root],lang+' '+root);
  }
  assert.equal(await page.locator('[data-guide-child="issues"]').count(),0);
  assert.equal(await page.locator('.guide-tabs').count(),0,'landing must not flatten to a workbench');
 }
 console.log('QR522 FIXED ACTUAL EIGHT LOCALES × FOUR ROOT LABELS/NO ISSUES PASS');
 await page.locator('#site-locale').selectOption('fr');
 await page.waitForFunction(v=>document.querySelector('[data-guide-child="quests"] strong')?.textContent?.trim()===v,'Quêtes');
 assert.equal((await cards.locator('[data-guide-child="quests"] strong').innerText()).trim(),'Quêtes');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(v=>document.querySelector('[data-guide-child="quests"] strong')?.textContent?.trim()===v,'クエスト');
 assert.equal((await cards.locator('[data-guide-child="systems"] strong').innerText()).trim(),'ゲームシステム');
 const desktop=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(desktop.length>7000);
 console.log('QR522 REPAIRED ROOT DESKTOP SCREENSHOT RAM SHA '+createHash('sha256').update(desktop).digest('hex').slice(0,16));
 for(const section of roots){
  const link=cards.locator('[data-guide-child="'+section+'"]');
  await link.focus();
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-guide-child')),section);
  await page.keyboard.press('Enter');
  await hub.waitFor({state:'detached'});
  assert.equal(await page.locator('.guide-tabs button').count(),4);
  assert.equal((await page.locator('.guide-tabs button.active').innerText()).trim(),guideCopy('ja')[section]);
  if(section==='quests'){
   const search=page.locator('.guide-page input[type=search]');
   await search.fill('!QR522_UNVERIFIED_NO_RESULTS_20261105!');
   assert.equal(await page.locator('.result-list button').count(),0);
   assert.ok(await page.locator('.empty').count()>0);
  }
  await page.locator('.guide-back').click();
  await hub.waitFor({state:'visible'});
 }
 console.log('QR522 REPAIRED REAL KEYBOARD FOUR WORKSPACES / EMPTY / BACK PASS');
 await page.goto(url.origin+'/help/',{waitUntil:'networkidle'});
 const help=page.locator('[data-help-root="four-children"]');
 await help.waitFor();
 assert.equal(await help.locator('.public-children a').count(),3);
 assert.equal(await help.locator('a[href*="/help/issues/"]').count(),1);
 assert.equal(await help.locator('.personal').count(),1);
 await page.goto(url.href,{waitUntil:'networkidle'});
 await hub.waitFor();
 await page.setViewportSize({width:320,height:750});
 const small=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(small.scroll<=small.w+2,JSON.stringify(small));
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>5500);
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.w+2,JSON.stringify(zoom));
 const zoomShot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoomShot.length>5500);
 assert.equal(await cards.count(),4);
 assert.deepEqual(deny,[]);
 assert.deepEqual(errors,[]);
 console.log('QR522 REPAIRED MOBILE320/ZOOM200 + HELP OWNERSHIP + NO OFFHOST/WRITER/PAGEERR PASS');
 await ctx.close();
}finally{await browser.close();}
