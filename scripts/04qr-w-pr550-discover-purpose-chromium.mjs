/** Independent 04 QR-W real Chrome Stage1 Discover 7 purpose→first-step, optional Auth/Save.
 * No user-private P1G, no Provider/Writer/Media, screenshots RAM only.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {orientationCopy,ORIENTATION_DESTINATIONS} from '../src/lib/product-home/orientation-stage1-copy.mjs';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
if(!process.env.CHROME_BIN)throw Error('QR550_ACTUAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR550_OWNER_PRIVATE_P1G_CI_FORBIDDEN');
const url=new URL(process.env.QR550_URL??'http://127.0.0.1:4299/discover/');
if(url.href!=='http://127.0.0.1:4299/discover/')throw Error('QR550_EXACT_LOOPBACK_ONLY');
const languages=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const errors=[],denied=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR550_WS_DENY_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4299')route.connectToServer();
  else{denied.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{denied.push(route.request().method()+' '+route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 const root=page.locator('[data-discover-stage1="orientation-not-dashboard"]');
 await root.waitFor({state:'visible',timeout:30000});
 const products=root.locator('[data-discover-product]');
 assert.equal(await root.getAttribute('data-public-writer'),'off');
 assert.equal(await root.getAttribute('data-save-auto-upload'),'off');
 assert.equal(await root.locator('.home-product-grid, .test-availability').count(),0,'Discover orientation not Home duplicate');
 const ids=['decorate','collection','guide','presets','gallery','dreamsnaps','help'];
 for(const lang of languages){
  await page.locator('#site-locale').selectOption(lang);
  const copy=orientationCopy(lang);
  await page.waitForFunction(({lang,content})=>document.documentElement.dataset.locale===lang &&
   document.querySelector('[data-discover-product="decorate"] .discover-product-purpose p')?.textContent?.trim()===content,
   {lang,content:copy.products[0].purpose},{timeout:14000});
  assert.equal(await products.count(),7);
  assert.deepEqual(await products.evaluateAll(a=>a.map(x=>x.dataset.discoverProduct)),ids);
  assert.deepEqual(await products.locator('a[data-discover-destination]').evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),ORIENTATION_DESTINATIONS);
  for(const [index,id] of ids.entries()){
   const card=products.filter({has:page.locator('[data-discover-product="'+id+'"]')});
   const child=root.locator('[data-discover-product="'+id+'"]');
   assert.equal((await child.locator('.discover-product-purpose p').innerText()).trim(),copy.products[index].purpose,lang+':'+id+' purpose');
   assert.equal((await child.locator('.discover-product-start p').innerText()).trim(),copy.products[index].step,lang+':'+id+' step');
   const expectedTitle=id==='help'?helpStage1Copy(lang).title:homeCopy(lang)[id];
   assert.equal((await child.locator('h2').innerText()).trim(),expectedTitle,lang+':'+id+' title');
  }
  assert.equal((await root.locator('[data-discover-account-optional] p').innerText()).trim(),copy.account);
  assert.equal((await root.locator('[data-discover-save-optional] p').innerText()).trim(),copy.save);
  assert.equal((await root.locator('[data-discover-capability-gated] p').innerText()).trim(),copy.support);
  assert.equal(await root.locator('a[href="/rc-status/"]').count(),2);
  assert.equal(await root.locator('img,video').count(),0);
  assert.equal(await root.locator('a[href="/qa/"]').count(),0);
 }
 console.log('QR550 ACTUAL 7 PRODUCT PURPOSE+FIRSTSTEP X8 LANG + OPTIONAL ACCOUNT/SAVE/CAPABILITY PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(x=>document.querySelector('[data-discover-product="help"] .discover-product-purpose p')?.textContent?.trim()===x,orientationCopy('ja').products[6].purpose);
 const desktop=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(desktop.length>6500);
 console.log('QR550 DESKTOP SEVEN PURPOSE SCREENSHOT IN RAM SHA '+createHash('sha256').update(desktop).digest('hex').slice(0,16));
 await page.setViewportSize({width:320,height:750});
 const mobile=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(mobile.s<=mobile.w+2,JSON.stringify(mobile));
 const mobileShot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobileShot.length>5500);
 const help=root.locator('a[data-discover-destination="help"]');
 await help.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-discover-destination')),'help');
 await page.keyboard.press('Enter');
 await page.locator('[data-help-root="four-children"]').waitFor({state:'visible',timeout:20000});
 await page.goBack({waitUntil:'networkidle'});
 await root.waitFor({state:'visible'});
 await page.setViewportSize({width:640,height:840});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(zoom.s<=zoom.w+2,JSON.stringify(zoom));
 const zoomShot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoomShot.length>5500);
 assert.equal(await root.getAttribute('data-public-writer'),'off');
 assert.equal(await root.getAttribute('data-save-auto-upload'),'off');
 assert.deepEqual(errors,[]);
 assert.deepEqual(denied,[]);
 console.log('QR550 320PX/200PERCENT HELP KEYBOARD + NO OFFHOST/WS/POST/PRIVATE SAVE PASS');
 await ctx.close();
}finally{await browser.close();}
