/** Independent actual system Chromium DreamSnaps Stage1 1–3–1. Loopback only.
 * All screenshots in RAM, no P1G, no provider, no published/official result.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {DREAMSNAPS_STAGE1_DESTINATIONS,dreamsnapsStage1Copy} from '../src/lib/community/dreamsnaps-stage1-root.mjs';
if(!process.env.CHROME_BIN)throw Error('QR532_REAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)throw Error('QR532_PRIVATE_P1G_CI_DENIED');
const url=new URL(process.env.QR532_URL??'http://127.0.0.1:4293/dreamsnaps/');
if(url.href!=='http://127.0.0.1:4293/dreamsnaps/')throw Error('QR532_EXACT_LOOPBACK_REQUIRED');
const langs=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const keys=['community','submit','judge','results','my'],deny=[],errors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR532_WS_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4293')route.connectToServer();
  else{deny.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{deny.push(route.request().method()+' '+route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 const root=page.locator('[data-stage1-dreamsnaps-root="1-3-1"]');
 await root.waitFor({state:'visible',timeout:30000});
 const nav=root.locator('nav.dreamsnaps-flow');
 const cards=nav.locator('a[data-dreamsnaps-child]');
 for(const lang of langs){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(({lang,text})=>
   document.documentElement.dataset.locale===lang &&
   document.querySelector('[data-dreamsnaps-child="community"] strong')?.textContent?.trim()===text,
   {lang,text:dreamsnapsStage1Copy(lang).community},{timeout:12000});
  assert.equal(await cards.count(),5);
  assert.deepEqual(await cards.evaluateAll(a=>a.map(x=>x.dataset.dreamsnapsChild)),keys);
  for(const key of keys)assert.equal(
   (await nav.locator('[data-dreamsnaps-child="'+key+'"] strong').innerText()).trim(),
   dreamsnapsStage1Copy(lang)[key],lang+' '+key);
  assert.deepEqual(await cards.evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.href));
  assert.equal(await nav.locator('[data-stage1-dreamsnaps-peers] a').count(),3);
  assert.equal(await page.locator('a[href*="/gallery/dreamsnaps/"]').count(),0);
  assert.equal(await root.getAttribute('data-public-provider'),'off');
  assert.equal(await root.getAttribute('data-writer'),'off');
  assert.equal(await root.getAttribute('data-private-results'),'off');
  assert.equal(await root.getAttribute('data-media-rights'),'unverified');
 }
 console.log('QR532 ACTUAL 8LOCALE FIVE ROOT LABELS 1-3-1 + NO GALLERY CHILD PASS');
 const boxes=await cards.evaluateAll(a=>a.map(x=>{const b=x.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};}));
 assert.ok(boxes[0].y<boxes[1].y && boxes[1].y<boxes[4].y,'top/peers/bottom stack');
 assert.ok(Math.abs(boxes[1].y-boxes[2].y)<3&&Math.abs(boxes[2].y-boxes[3].y)<3,'peer row aligned');
 assert.ok(boxes[1].x<boxes[2].x&&boxes[2].x<boxes[3].x,'3 peer columns');
 assert.ok(boxes[0].w>boxes[1].w*2&&boxes[4].w>boxes[2].w*2,'wide full row cards');
 const desktop=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(desktop.length>7000);
 console.log('QR532 ACTUAL DESKTOP 1-3-1 GEOMETRY PNG RAM SHA '+createHash('sha256').update(desktop).digest('hex').slice(0,16));
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(v=>document.querySelector('[data-dreamsnaps-child="community"] strong')?.textContent?.trim()===v,dreamsnapsStage1Copy('ja').community);
 await page.setViewportSize({width:320,height:760});
 const small=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(small.scroll<=small.w+2,JSON.stringify(small));
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>6000);
 const anchor=nav.locator('[data-dreamsnaps-child="community"]');
 await anchor.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.dreamsnapsChild),'community');
 await page.keyboard.press('Enter');
 const gate=page.locator('[data-community-dreamsnaps="gated"]');
 await gate.waitFor({state:'visible'});
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await gate.getAttribute('data-public-provider'),'off');
 assert.equal(await gate.getAttribute('data-private-results'),'off');
 assert.equal(await gate.locator('.public-modes span').count(),2);
 assert.equal(await gate.locator('.public-modes button').count(),0,'no dead public-facet action');
 assert.equal(await gate.locator('.unavailable').isVisible(),true);
 assert.equal(await page.locator('img,video').count(),0,'no owner/private/public media projection');
 assert.equal(await page.locator('a[href*="/gallery/dreamsnaps/"]').count(),0);
 await gate.locator('a.back').click();
 await root.waitFor({state:'visible'});
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.w+2,JSON.stringify(zoom));
 const zoomShot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoomShot.length>6000);
 assert.equal(await cards.count(),5);
 assert.deepEqual(deny,[]);
 assert.deepEqual(errors,[]);
 console.log('QR532 GATED COMMUNITY NOINDEX + 320/ZOOM200/KEYBOARD + NO OFFHOST/WS/POST PASS');
 await ctx.close();
}finally{await browser.close();}
