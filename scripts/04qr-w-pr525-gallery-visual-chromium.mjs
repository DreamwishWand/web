/** Independent actual Chromium Stage1 Gallery 3-card root.
 * 8 locales verified on rendered DOM, no private Save/actor/provider rights tests.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createHash} from 'node:crypto';
import {stage1GalleryCopy} from '../src/lib/community/gallery-stage1-root.mjs';
if(!process.env.CHROME_BIN)throw Error('QR525_ACTUAL_CHROME_MISSING');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)throw Error('QR525_PRIVATE_SAVE_FORBIDDEN');
const url=new URL(process.env.QR525_URL??'http://127.0.0.1:4287/gallery/');
if(url.href!=='http://127.0.0.1:4287/gallery/')throw Error('QR525_EXACT_LOOPBACK_ONLY');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const errors=[],external=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await context.newPage();
 page.on('pageerror',x=>errors.push(String(x)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR525_WS_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4287')route.connectToServer();
  else{external.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{external.push(route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 const hub=page.locator('[data-stage1-gallery-hub]');
 await hub.waitFor({state:'visible',timeout:30000});
 const products=['decorations','touchOfMagic','myGallery'];
 for(const lang of locales){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(({lang,text})=>document.documentElement.dataset.locale===lang &&
    document.querySelector('[data-gallery-child="decorations"] strong')?.textContent?.trim()===text,
    {lang,text:stage1GalleryCopy(lang).decorations},{timeout:15000});
  const cards=hub.locator('[data-gallery-child]');
  assert.equal(await cards.count(),3,lang);
  assert.deepEqual(await cards.evaluateAll(els=>els.map(el=>el.getAttribute('data-gallery-child'))),products,lang);
  const copy=stage1GalleryCopy(lang);
  assert.equal((await hub.locator('[data-gallery-child="decorations"] strong').innerText()).trim(),copy.decorations);
  assert.equal((await hub.locator('[data-gallery-child="touchOfMagic"] strong').innerText()).trim(),copy.tom);
  assert.equal((await hub.locator('[data-gallery-child="myGallery"] strong').innerText()).trim(),copy.mine);
  assert.equal(await page.locator('[data-gallery-child="dreamsnaps"]').count(),0);
  assert.equal(await page.locator('[data-stage1-gallery-root][data-writer="off"][data-media-rights="unverified"][data-public-eligibility="provider-gated"]').count(),1);
  assert.equal(await hub.locator('.prominent').count(),1);
  assert.equal(await hub.locator('img').count(),0,'no rights-unverified media');
 }
 console.log('QR525 ACTUAL GALLERY 3 CARDS X8 LOCALES + NO DREAMSNAPS ROOT + RIGHTS OFF PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(text=>document.querySelector('[data-gallery-child="decorations"] strong')?.textContent?.trim()===text,stage1GalleryCopy('ja').decorations);
 const png=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(png.length>7000);
 console.log('QR525 DESKTOP SCREENSHOT IN-MEMORY SHA '+createHash('sha256').update(png).digest('hex').slice(0,16));
 const direct=hub.locator('[data-gallery-child="myGallery"]');
 assert.match(await direct.getAttribute('href'),/\/gallery\/my\/$/);
 const deco=hub.locator('[data-gallery-child="decorations"]');
 await deco.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-gallery-child')),'decorations');
 await page.keyboard.press('Enter');
 const facets=page.locator('[data-stage1-gallery-facets] button');
 await facets.first().waitFor();
 assert.equal(await facets.count(),3);
 assert.equal(await page.locator('[data-gallery-direct-link]').count(),0);
 assert.equal(await page.locator('.gallery-browse .gallery-work-card').count(),0,'do not invent published Work');
 await facets.nth(1).click();
 assert.equal(await facets.nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('.gallery-back').click();
 await hub.waitFor();
 await hub.locator('[data-gallery-child="touchOfMagic"]').click();
 await facets.first().waitFor();
 assert.equal(await facets.count(),3);
 assert.equal(await facets.nth(0).getAttribute('aria-pressed'),'true');
 await page.locator('.gallery-back').click();
 await hub.waitFor();
 console.log('QR525 KEYBOARD DECORATIONS CATEGORY→3 FACETS→BACK/TOUCH OF MAGIC→BACK PASS');
 await page.setViewportSize({width:320,height:780});
 const mobile=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(mobile.scroll<=mobile.w+2,JSON.stringify(mobile));
 const mobileShot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobileShot.length>5000);
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.w+2,JSON.stringify(zoom));
 const zoomShot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoomShot.length>5000);
 console.log('QR525 320PX 200PERCENT IN-MEMORY VISUAL SCREENSHOT PASS');
 assert.deepEqual(external,[]);
 assert.deepEqual(errors,[]);
 console.log('QR525 NO OFFHOST HTTP/WS/POST OR P1G/UNAPPROVED PUBLIC WORK PASS');
 await context.close();
}finally{await browser.close();}
