/** Independent 04 QR-W actual system Chrome Stage1 Collection repaired locale.
 * Checks all 29 cards for each of 8 locales, personal UNKNOWN, keyboard,
 * user navigation, blocked state, 320px/200%; screenshots stay in-memory.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createHash} from 'node:crypto';
import {STAGE1_COLLECTION_ORDER,stage1CategoryLabel} from '../src/lib/collection/stage1-root.mjs';
if(!process.env.CHROME_BIN)throw Error('QR519_ACTUAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR519_PRIVATE_SAVE_CI_FORBIDDEN');
const url=new URL(process.env.QR519_URL??'http://127.0.0.1:4285/collection/');
if(url.href!=='http://127.0.0.1:4285/collection/')throw Error('QR519_EXACT_LOOPBACK_REQUIRED');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const errors=[],violations=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR519_WEBSOCKET_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.hostname==='127.0.0.1'&&u.port==='4285'&&u.protocol==='ws:')route.connectToServer();
  else{violations.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{violations.push(route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 const grid=page.locator('[data-stage1-category-grid]');
 await grid.waitFor({state:'visible',timeout:30000});
 const cards=grid.locator('.category-card');
 for(const lang of locales){
  await page.locator('#site-locale').selectOption(lang);
  try{
   await page.waitForFunction(({lang,expected})=>
    document.documentElement.dataset.locale===lang &&
    document.querySelector('[data-category="Furniture"] .category-name')?.textContent?.trim()===expected,
    {lang,expected:stage1CategoryLabel(lang,'Furniture')},{timeout:12000});
  }catch(e){
   const live=await page.evaluate(()=>({select:document.querySelector('#site-locale')?.value,dom:document.documentElement.dataset.locale,label:document.querySelector('[data-category="Furniture"] .category-name')?.textContent?.trim()}));
   throw Error('QR519_REAL_8LOCALE_LABEL_STALE '+JSON.stringify({lang,expected:stage1CategoryLabel(lang,'Furniture'),...live}));
  }
  assert.equal(await cards.count(),29);
  const actual=await cards.evaluateAll(a=>a.map(x=>({id:x.getAttribute('data-category'),text:x.querySelector('.category-name')?.textContent?.trim(),measure:x.querySelector('.category-measure')?.textContent?.trim(),disabled:x.hasAttribute('disabled')})));
  assert.deepEqual(actual.map(x=>x.id),STAGE1_COLLECTION_ORDER,lang+' all category order');
  for(const card of actual){
   assert.equal(card.text,stage1CategoryLabel(lang,card.id),lang+'/'+card.id+' localized actual DOM');
   assert.match(card.measure,/—\s*\/\s*—/);
   assert.match(card.measure,/—%/);
   assert.ok(!/[0-9]+\s*%/.test(card.measure),'no invented personal percent '+card.id);
  }
  assert.equal(await page.locator('button:has-text("Owned"):not([disabled])').count(),0,'personal Owned must not be actionable');
  assert.equal(await page.locator('img').count(),0,'no unlicensed game image rights');
 }
 console.log('QR519 ACTUAL 8 LOCALES ALL29 CATEGORY DOM LABELS+UNKNOWN PERCENT/NO MEDIA PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(e=>document.querySelector('[data-category="Memories"] .category-name')?.textContent?.trim()===e,stage1CategoryLabel('ja','Memories'));
 const desktop=await page.screenshot({type:'png',animations:'disabled',fullPage:false});
 assert.ok(desktop.length>7000);
 console.log('QR519 INMEMORY DESKTOP SCREENSHOT SHA256 '+createHash('sha256').update(desktop).digest('hex').slice(0,16));
 const ownerPanel=page.locator('[data-stage1-collection-root]');
 assert.equal(await ownerPanel.getAttribute('data-personal-progress'),'unknown');
 assert.equal(await ownerPanel.getAttribute('data-writer'),'off');
 assert.equal(await ownerPanel.getAttribute('data-media-rights'),'unverified');
 const ownedButtons=page.locator('.personal-state button');
 assert.equal(await ownedButtons.count(),3);
 assert.equal(await ownedButtons.nth(1).isDisabled(),true);
 assert.equal(await ownedButtons.nth(2).isDisabled(),true);
 // keyboard-initiated real user action; then Item source detail only, no Writer
 const furniture=grid.locator('[data-category="Furniture"]');
 assert.equal(await furniture.isDisabled(),false);
 await furniture.focus();
 await page.keyboard.press('Enter');
 const browse=page.locator('[data-stage1-category-browse]');
 await browse.waitFor({state:'visible',timeout:15000});
 await browse.locator('.item-card').first().click();
 const info=page.locator('[data-stage1-item-info]');
 await info.waitFor();
 const detail=await info.locator('a').getAttribute('href');
 assert.match(detail,/\/[0-9]+\/$/);
 assert.equal(await info.locator('button').count(),1);
 await info.locator('button').click();
 assert.equal(await info.count(),0);
 await page.locator('.back-category').click();
 await grid.waitFor();
 console.log('QR519 KEYBOARD CATEGORY ENTER→UNIVERSE→ITEM INFO DEEP LINK→RETURN PASS');
 // Multi World OR, independent Universe AND and clear chips are user controls, not a static fixture.
 await page.locator('.filter-toggle').click();
 const worldOptions=page.locator('.filter-panel fieldset').first().locator('button');
 assert.ok(await worldOptions.count()>=2);
 await worldOptions.first().click();
 await worldOptions.nth(1).click();
 assert.equal(await page.locator('.active-filters button').count(),3);
 assert.equal(await worldOptions.first().getAttribute('aria-pressed'),'true');
 assert.equal(await worldOptions.nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('.active-filters .clear').click();
 assert.equal(await page.locator('.active-filters').count(),0);
 await page.locator('[data-stage1-search]').fill('40000047');
 await page.locator('[data-stage1-search-groups] .item-section').first().waitFor({timeout:15000});
 assert.equal(await grid.count(),0);
 await page.locator('[data-stage1-search]').fill('');
 await grid.waitFor();
 console.log('QR519 MULTIFACET CHIPS/CLEAR AND GROUPED SEARCH PASS');
 await page.setViewportSize({width:320,height:760});
 const small=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(small.scroll<=small.w+2,JSON.stringify(small));
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>6000);
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.w+2,JSON.stringify(zoom));
 const zoomShot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoomShot.length>6000);
 assert.equal(await cards.count(),29);
 console.log('QR519 320PX+200PERCENT VISUAL SCREENSHOTS INMEMORY PASS');
 assert.deepEqual(errors,[]);
 assert.deepEqual(violations,[]);
 console.log('QR519 NO OFFHOST/WS/POST/PRIVATE UPLOAD/PAGE ERRORS PASS');
 await context.close();
}finally{await browser.close();}
