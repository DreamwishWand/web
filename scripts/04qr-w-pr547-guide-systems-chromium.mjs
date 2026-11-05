/** 04QR-W real system Chrome Guide Systems P0 route, independent visual/rights negative.
 * Only synthetic taxonomy UI, no user P1G, real Provider, Native Writer or public Guide articles.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {
 GUIDE_SYSTEMS_CATEGORIES,guideSystemsCategoryLabel
} from '../src/lib/guide/systems-stage1-taxonomy.mjs';
if(!process.env.CHROME_BIN)throw Error('QR547_ACTUAL_SYSTEM_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR547_PRIVATE_ORIGINAL_SAVE_CI_DENIED');
const target=new URL(process.env.QR547_URL??'http://127.0.0.1:4297/guide/systems/');
if(target.href!=='http://127.0.0.1:4297/guide/systems/')throw Error('QR547_EXACT_LOOPBACK_ONLY');
const langs=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const denied=[],errors=[],keys=GUIDE_SYSTEMS_CATEGORIES.map(c=>c.id);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR547_WEBSOCKET_DENY_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4297')route.connectToServer();
  else{denied.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===target.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{denied.push(route.request().method()+' '+route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(target.href,{waitUntil:'networkidle'});
 const root=page.locator('[data-guide-systems-seven]');
 await root.waitFor({state:'visible',timeout:30000});
 const grid=page.locator('[data-systems-category-grid]');
 const cards=grid.locator('button[data-systems-category]');
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await root.getAttribute('data-guide-rights'),'unverified');
 assert.equal(await root.getAttribute('data-published-articles'),'off');
 assert.equal(await root.getAttribute('data-writer'),'off');
 assert.equal(await root.getAttribute('data-accepted-source-version'),'1.25.0');
 for(const lang of langs){
  await page.locator('#site-locale').selectOption(lang);
  try{
   await page.waitForFunction(({lang,text})=>
    document.documentElement.dataset.locale===lang &&
    document.querySelector('[data-systems-category="basics"] strong')?.textContent?.trim()===text,
    {lang,text:guideSystemsCategoryLabel('basics',lang)},{timeout:12000});
  }catch(e){
   const live=await page.evaluate(()=>({code:document.documentElement.dataset.locale,select:document.querySelector('#site-locale')?.value,label:document.querySelector('[data-systems-category="basics"] strong')?.textContent?.trim()}));
   throw Error('QR547_REAL_CHROME_LOCALE_STALE '+JSON.stringify({lang,expected:guideSystemsCategoryLabel('basics',lang),live}));
  }
  assert.deepEqual(await cards.evaluateAll(xs=>xs.map(x=>x.dataset.systemsCategory)),keys,lang);
  for(const key of keys)
   assert.equal((await grid.locator('[data-systems-category="'+key+'"] strong').innerText()).trim(),guideSystemsCategoryLabel(key,lang),lang+':'+key);
  assert.equal(await root.getAttribute('data-published-articles'),'off');
  assert.equal(await page.locator('img,video').count(),0);
  assert.equal(await page.locator('a[href*="/guide/systems/"]').count(),0,'no 106 positive individual page links');
 }
 console.log('QR547 ACTUAL 8 LOCALES X7 ROOT LABELS + NOINDEX/RIGHTS/ARTICLES OFF PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(x=>document.querySelector('[data-systems-category="basics"] strong')?.textContent?.trim()===x,'基本・進行・設定');
 const desktop=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(desktop.length>6500);
 console.log('QR547 DESKTOP CANONICAL 7CARD SCREENSHOT RAM SHA '+createHash('sha256').update(desktop).digest('hex').slice(0,16));
 const basics=grid.locator('[data-systems-category="basics"]');
 await basics.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.systemsCategory),'basics');
 await page.keyboard.press('Enter');
 await page.locator('[data-systems-subgroups]').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-systems-group]').count(),3);
 const japanese=await page.locator('[data-systems-group] strong').allInnerTexts();
 assert.deepEqual(japanese,GUIDE_SYSTEMS_CATEGORIES[0].subgroups.map(x=>x.ja));
 assert.equal(await page.locator('[data-systems-subgroups] a').count(),0);
 assert.equal(await page.locator('.systems-stage1 [role=status]').count(),1,'no positive Guide pages');
 await page.locator('#site-locale').selectOption('fr');
 await page.waitForFunction(x=>document.querySelector('[data-systems-group] strong')?.textContent?.trim()===x,
  GUIDE_SYSTEMS_CATEGORIES[0].subgroups[0].en,{timeout:12000});
 const fallback=await page.locator('.systems-fallback').innerText();
 assert.ok(fallback.length>15);
 assert.deepEqual(await page.locator('[data-systems-group] strong').allInnerTexts(),GUIDE_SYSTEMS_CATEGORIES[0].subgroups.map(x=>x.en));
 await page.locator('.systems-return').click();
 await grid.waitFor({state:'visible'});
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.systemsCategory),'basics','keyboard focus restored after returning');
 console.log('QR547 JAPANESE REVIEWED TOPIC LABEL / FRENCH HONEST ENGLISH SUBGROUP FALLBACK / BACK FOCUS PASS');
 const query=page.locator('.systems-query input');
 await query.fill('DLC');
 assert.deepEqual(await cards.evaluateAll(xs=>xs.map(x=>x.dataset.systemsCategory)),['basics','exploration']);
 await query.fill('DLC world entry');
 assert.deepEqual(await cards.evaluateAll(xs=>xs.map(x=>x.dataset.systemsCategory)),['exploration']);
 await query.fill('road');
 assert.deepEqual(await cards.evaluateAll(xs=>xs.map(x=>x.dataset.systemsCategory)),['decorating']);
 await query.fill('<img src=x onerror=alert(1)>');
 assert.equal(await cards.count(),0);
 assert.equal(await page.locator('.systems-empty[role=status]').count(),1);
 assert.equal(await page.locator('img').count(),0,'HTML injection must be plain text');
 await query.fill('');
 assert.equal(await cards.count(),7);
 console.log('QR547 CROSS DOMAIN DLC ALIAS/ROAD SEARCH + INJECTION/UNKNOWN DENY PASS');
 await page.setViewportSize({width:320,height:780});
 const small=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(small.scroll<=small.width+2,JSON.stringify(small));
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>5600);
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.width+2,JSON.stringify(zoom));
 const zoomPng=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoomPng.length>5600);
 assert.deepEqual(denied,[]);
 assert.deepEqual(errors,[]);
 console.log('QR547 ACTUAL 320PX 200PERCENT / ZERO OFFHOST WS POST ERRORS / NO PRIVATE P1G PASS');
 await context.close();
}finally{await browser.close();}
