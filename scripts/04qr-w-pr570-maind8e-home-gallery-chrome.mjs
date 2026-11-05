// 04 QR-W independent NEW latest-main d8e Home -> unmerged Source Gallery composite real Chrome.
// This does not retest accepted Gallery 8-locale visuals; no private save or provider/media permissions.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {stage1GalleryCopy} from '../src/lib/community/gallery-stage1-root.mjs';

const origin='http://127.0.0.1:4318';
if(!process.env.CHROME_BIN)throw Error('QR570_LATEST_MAIN_REAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR570_OWNER_PRIVATE_SAVE_FORBIDDEN');
const denied=[],errors=[];
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(String(error)));
if(typeof page.routeWebSocket!=='function')throw Error('QR570_NO_BOUNDARY_WEBSOCKET_ROUTE');
await page.routeWebSocket('**/*',route=>{
 const url=new URL(route.url());
 if(url.hostname==='127.0.0.1'&&url.port==='4318')route.connectToServer();
 else{denied.push('WS '+route.url());route.close();}
});
await page.route('**/*',route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin===origin&&['GET','HEAD'].includes(request.method()))route.continue();
 else{denied.push(request.method()+' '+request.url());route.abort('blockedbyclient');}
});
async function fit(reason){
 const rect=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(rect.scroll<=rect.client+2,reason+': '+JSON.stringify(rect));
}
try{
 await page.goto(origin+'/',{waitUntil:'networkidle',timeout:45000});
 const homeGallery=page.locator('.home-product-grid a.visual-card[href="/gallery/"]');
 await homeGallery.waitFor({state:'visible',timeout:30000});
 assert.equal(await page.locator('.home-product-grid a.visual-card').count(),6);
 assert.equal(await page.locator('.home-qa-entry a.visual-card[href="/help/"]').count(),1);
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(({copy})=>document.documentElement.dataset.locale==='ja' &&
  document.querySelector('.home-product-grid a.visual-card[href="/gallery/"] .visual-card-copy >span')?.textContent?.trim()===copy,
  {copy:homeCopy('ja').galleryDetail},{timeout:20000});
 assert.equal((await homeGallery.locator('strong').innerText()).trim(),homeCopy('ja').gallery);
 await homeGallery.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/gallery/');
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/gallery\/$/,{timeout:25000});
 const gallery=page.locator('[data-stage1-gallery-root]');
 await gallery.waitFor({state:'visible',timeout:25000});
 assert.equal(await gallery.getAttribute('data-writer'),'off');
 assert.equal(await gallery.getAttribute('data-public-eligibility'),'provider-gated');
 assert.equal(await gallery.getAttribute('data-media-rights'),'unverified');
 assert.deepEqual(await gallery.locator('[data-gallery-child]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-gallery-child'))),
  ['decorations','touchOfMagic','myGallery']);
 assert.equal(await gallery.locator('.gallery-hub-card.prominent').count(),1);
 assert.equal(await gallery.locator('img,video,iframe').count(),0);
 assert.equal(await gallery.locator('[data-gallery-direct-link]').count(),0);
 assert.equal(await page.locator('a[href*="/gallery/dreamsnaps/"]').count(),0);
 console.log('QR570_MAIND8E_HOME_JA_GALLERY_KEYBOARD_ROUTE_THREE_CARDS_PRIVACY_OFF_PASS');
 await gallery.locator('[data-gallery-child="decorations"]').click();
 await gallery.locator('[data-stage1-gallery-facets] button').first().waitFor({state:'visible',timeout:15000});
 assert.equal(await gallery.locator('[data-stage1-gallery-facets] button').count(),3);
 assert.equal(await gallery.locator('[data-gallery-subtype="decorations"]').count(),0,'no synthetic or unverified public Works without provider');
 await gallery.locator('.gallery-back').click();
 await gallery.locator('[data-gallery-child="touchOfMagic"]').click();
 await gallery.locator('[data-stage1-gallery-facets] button').first().waitFor({state:'visible'});
 assert.equal(await gallery.locator('[data-stage1-gallery-facets] button').count(),3);
 assert.equal(await gallery.locator('[data-gallery-subtype="touchOfMagic"]').count(),0);
 await gallery.locator('.gallery-back').click();
 assert.equal(await gallery.locator('[data-gallery-child="myGallery"]').getAttribute('href'),'/gallery/my/');
 assert.equal((await gallery.locator('[data-gallery-child="decorations"] strong').innerText()).trim(),stage1GalleryCopy('ja').decorations);
 console.log('QR570_MAIND8E_GALLERY_CATEGORY_FACETS_NO_PROVIDER_FORGED_PUBLIC_WORKS_PASS');
 await page.setViewportSize({width:320,height:760});
 await fit('Gallery current-main 320px');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('Gallery current-main zoom200');
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>5000);
 console.log('QR570_MAIND8E_GALLERY_RAM_SCREENSHOT_SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 assert.deepEqual(denied,[],'zero offsite GET, POST, WebSocket, Provider and uploads');
 assert.deepEqual(errors,[],'zero page exceptions');
 console.log('QR570_MAIND8E_HOME_COMPOSED_GALLERY_NO_OFFHOST_MUTATION_PASS');
}finally{await context.close();await browser.close();}
