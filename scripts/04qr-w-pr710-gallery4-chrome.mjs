// 04 QR-W independent Chrome R24 Gallery Root four-card new-only QA.
// No private DreamSnaps/Work/media/account fixture; local source routes only.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {stage1GalleryCopy} from '../src/lib/community/gallery-stage1-root.mjs';
const chrome=process.env.CHROME_BIN;if(!chrome)throw Error('QR710_CHROME_BIN_REQUIRED');
const origin=(process.env.QR710_URL??'http://127.0.0.1:4291').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:false,serviceWorkers:'block'});
const page=await ctx.newPage(),errors=[],offOriginOrWrite=[],websockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>websockets.push(w.url()));
ctx.on('request',r=>{
 const url=r.url();
 if(r.method()!=='GET'||new URL(url).origin!==origin)offOriginOrWrite.push(r.method()+' '+url);
});
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const ordered=['decorations','touchOfMagic','myGallery','dreamsnaps'];
const root=()=>page.locator('[data-stage1-gallery-root][data-writer="off"][data-public-eligibility="provider-gated"][data-media-rights="unverified"]');
const cards=()=>page.locator('[data-stage1-gallery-hub] [data-gallery-child]');
const fit=async name=>{
 const m=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(m.scroll<=m.width+2,name+JSON.stringify(m));
};
const gotoGallery=async()=>{
 await page.goto(origin+'/gallery/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('[data-stage1-gallery-hub]').waitFor({timeout:20000});
};
try{
 await gotoGallery();
 for(const loc of locales){
  await page.locator('#site-locale').selectOption(loc);
  await page.locator('html[data-locale="'+loc+'"]').waitFor({timeout:16000});
  assert.equal(await root().count(),1,loc);
  assert.deepEqual(await cards().evaluateAll(els=>els.map(e=>e.getAttribute('data-gallery-child'))),ordered,loc+' four order');
  assert.equal(await page.locator('[data-gallery-child="dreamsnaps"]').getAttribute('href'),'/dreamsnaps/');
  assert.equal(await page.locator('[data-gallery-child="myGallery"]').getAttribute('href'),'/gallery/my/');
  assert.equal(await page.locator('[data-stage1-gallery-hub] .prominent').count(),1);
  assert.equal(await page.locator('[data-gallery-child="dreamsnaps"][data-dreamsnaps-routing="independent"][data-dreamsnaps-media="off"]').count(),1);
  assert.equal((await page.locator('[data-gallery-child="dreamsnaps"] strong').innerText()).trim(),stage1GalleryCopy(loc).dreamsnaps,loc);
  assert.equal((await page.locator('[data-gallery-child="dreamsnaps"] small').innerText()).trim(),stage1GalleryCopy(loc).dreamsnapsBoundary,loc);
  assert.equal(await page.locator('[data-stage1-gallery-hub] img, [data-stage1-gallery-hub] video').count(),0);
  assert.equal(await page.locator('a[href*="/gallery/dreamsnaps/"]').count(),0);
 }
 console.log('QR710_CHROME_GALLERY_EXACT_FOUR_ORDER_8LOCALE_LINKS_NO_PUBLIC_MEDIA_PASS');

 await page.locator('#site-locale').selectOption('ja');
 await page.locator('[data-gallery-child="decorations"]').click();
 await page.locator('[data-stage1-gallery-facets] button').first().waitFor();
 assert.equal(await page.locator('[data-stage1-gallery-facets] button').count(),3);
 assert.equal(await page.locator('[data-stage1-gallery-facets] button[aria-pressed="true"]').count(),1);
 await page.locator('[data-stage1-gallery-facets] button').nth(1).click();
 assert.equal(await page.locator('[data-stage1-gallery-facets] button').nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('.gallery-back').click();
 assert.equal(await cards().count(),4);
 await page.locator('[data-gallery-child="touchOfMagic"]').click();
 await page.locator('[data-stage1-gallery-facets] button').first().waitFor();
 assert.equal(await page.locator('[data-stage1-gallery-facets] button').count(),3);
 await page.locator('.gallery-back').click();
 assert.equal(await cards().count(),4);
 console.log('QR710_CHROME_DECORATION_TOM_SOURCE_DEFINED_FACETS_BACK_RETAINED_PASS');

 // Private My Gallery is navigation-only on root; its separate route must remain non-indexed.
 const my=page.locator('[data-gallery-child="myGallery"]');
 assert.equal(await my.getAttribute('href'),'/gallery/my/');
 await my.click();
 await page.waitForURL(/\/gallery\/my\/$/);
 assert.equal(await page.locator('meta[name="robots"][content*="noindex"]').count(),1,'My Gallery not public index');
 assert.equal(await page.locator('img,video').count(),0,'no private media without auth');
 await gotoGallery();
 console.log('QR710_CHROME_MY_GALLERY_NAVIGATION_NOINDEX_NO_PRIVATE_MEDIA_PASS');

 // Keyboard-only activation of fourth card must go to independent DreamSnaps 1-3-1.
 const ds=page.locator('[data-gallery-child="dreamsnaps"]');
 await ds.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-gallery-child')),'dreamsnaps');
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/dreamsnaps\/$/);
 const dream=page.locator('[data-stage1-dreamsnaps-root="1-3-1"][data-public-provider="off"][data-writer="off"][data-private-results="off"][data-media-rights="unverified"]');
 await dream.waitFor();
 assert.equal(await dream.count(),1);
 assert.deepEqual(await page.locator('[data-stage1-dreamsnaps-root] [data-dreamsnaps-child]').evaluateAll(els=>els.map(e=>e.getAttribute('data-dreamsnaps-child'))),
 ['community','submit','judge','results','my']);
 assert.equal(await page.locator('img,video,picture').count(),0,'no submissions or results media rendered');
 assert.equal(await page.locator('[data-stage1-gallery-hub]').count(),0,'DreamSnaps is not Gallery legacy child');
 assert.ok((await page.title()).includes('Dreamwish Wand'));
 console.log('QR710_CHROME_DREAMSNAPS_KEYBOARD_INDEPENDENT_131_PROVIDER_RESULTS_OFF_PASS');

 await gotoGallery();
 await page.setViewportSize({width:320,height:780});
 await fit('320px Gallery4');
 assert.equal(await cards().count(),4);
 await page.locator('[data-gallery-child="dreamsnaps"]').focus();
 await page.keyboard.press('Enter');
 await dream.waitFor();
 await fit('320px DreamSnaps');
 await page.setViewportSize({width:640,height:780});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await fit('200percent DreamSnaps');
 await gotoGallery();
 await fit('200percent Gallery4');
 await page.evaluate(()=>{document.documentElement.style.zoom='1'});
 console.log('QR710_CHROME_320_200_KEYBOARD_BOTH_ROOTS_PASS');

 // Guessed Work query at public root cannot synthesize private Work, image or result.
 await page.goto(origin+'/gallery/?work=qr-unknown-private-entity',{waitUntil:'domcontentloaded',timeout:30000});
 await root().waitFor();
 assert.equal(await page.locator('img,video,picture').count(),0);
 assert.equal(await page.locator('[data-gallery-direct-link]').count(),0);
 assert.equal(await page.locator('[data-stage1-gallery-hub] [data-gallery-child]').count(),4);
 assert.ok((await page.title()).includes('Dreamwish Wand'));
 assert.deepEqual(offOriginOrWrite,[],'no unauthenticated provider/cross-origin/POST');
 const unsafeWs=websockets.filter(u=>!/^ws:\/\/127\.0\.0\.1:4291\/\?token=[A-Za-z0-9_-]+$/.test(u));
 assert.deepEqual(unsafeWs,[],'only known localhost Vite HMR websocket is allowed');
 assert.deepEqual(errors,[],'no unhandled JS errors');
 console.log('QR710_CHROME_UNKNOWN_WORK_NOT_POSITIVE_NO_OFFHOST_POST_EXTERNAL_WS_PASS');
}finally{await ctx.close();await browser.close();}
console.log('QR710_INDEPENDENT_ACTUAL_CHROME_PASS');