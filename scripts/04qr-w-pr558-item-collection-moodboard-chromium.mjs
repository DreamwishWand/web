// 04 QR-W: independent ACTUAL browser coverage for PR558's ONLY changed
// Collection 29-category -> Item preview -> typed detail navigation Desktop/320.
// Owner Source full E2E additionally covers Moodboard/Explore/forged data/HTTP404.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createHash} from 'node:crypto';
const ITEM='40000047';
if(!process.env.CHROME_BIN)throw Error('QR558_GENUINE_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR558_OWNER_PRIVATE_P1G_CI_FORBIDDEN');
const root=process.env.QR558_URL||'http://127.0.0.1:4303';
if(root!=='http://127.0.0.1:4303')throw Error('QR558_STRICT_LOOPBACK_ONLY');
const denied=[],errors=[];
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR558_WEBSOCKET_BLOCK_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4303')route.connectToServer();
  else{denied.push('WS '+route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===root && ['GET','HEAD'].includes(route.request().method()))route.continue();
  else {denied.push(route.request().method()+' '+route.request().url());route.abort('blockedbyclient');}
 });
 const run=async(width)=>{
  await page.setViewportSize({width,height:850});
  await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({state:'visible',timeout:35000});
  const collection=page.locator('[data-stage1-collection-root]');
  assert.equal(await collection.getAttribute('data-personal-progress'),'unknown');
  assert.equal(await collection.getAttribute('data-writer'),'off');
  await page.locator('[data-stage1-search]').fill(ITEM);
  const found=page.locator('[data-stage1-search-groups] .item-card');
  await found.first().waitFor({state:'visible',timeout:25000});
  assert.equal(await found.count(),1,width+' unique item 40000047');
  await found.first().click();
  const info=page.locator('[data-stage1-item-info]');
  await info.waitFor({state:'visible',timeout:12000});
  assert.match(await info.innerText(),/40000047/);
  const link=info.locator('.info-actions a');
  assert.equal(await link.count(),1,'one deliberate full-detail route');
  await link.click();
  await page.locator('[data-shared-entity-detail="preview"] h1').waitFor({state:'visible',timeout:25000});
  assert.match(page.url(),/\/[a-zA-Z-]+\/40000047\/$/);
  const typed=await page.locator('[data-entity-identity]').innerText();
  assert.match(typed,/40000047/);
  assert.match(typed,/52BD625D9B4E0053/);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
  await page.locator('[data-shared-discovery="READY"]').waitFor({state:'visible',timeout:30000});
  const dims=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dims.scroll<=dims.client+2,width+' no overflow '+JSON.stringify(dims));
  console.log('QR558 ACTUAL '+width+'PX COLLECTION_29_CATEGORY_SEARCH_ITEM40000047_PREVIEW_TO_TYPED_DETAIL_PASS');
 };
 await run(1280);
 const screenshot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(screenshot.length>6500);
 console.log('QR558 DESKTOP VIEW RAM SHA '+createHash('sha256').update(screenshot).digest('hex').slice(0,16));
 await run(320);
 await page.keyboard.press('Tab');
 assert.ok(['A','BUTTON','INPUT','SELECT'].includes(await page.evaluate(()=>document.activeElement?.tagName)));
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dimensions.scroll<=dimensions.client+2,'zoom200 '+JSON.stringify(dimensions));
 assert.deepEqual(denied,[],'no Provider/Community/Cloud offhost or POST');
 assert.deepEqual(errors,[],'no runtime crash');
 console.log('QR558 WRITER_OFF UNKNOWN/320/200/KEYBOARD AND NO OFFHOST POST WS PASS');
 await ctx.close();
} finally { await browser.close(); }
