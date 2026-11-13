import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4358';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const id='40006096', other='40000047';
const DB='dreamwishwand:wep:scene-presets:local:v1';
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const mediaRequests=[],unsafe=[],errors=[];
 context.on('request',r=>{if(r.url().startsWith('http')&&(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method())))unsafe.push(r.method()+' '+r.url());if(r.url().includes('/ddv/item-images/'))mediaRequests.push(r.url());});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 assert.equal((await page.goto(origin+'/editor/world/',{waitUntil:'networkidle'})).status(),200);
 const panel=page.locator('[data-wep-savefree-first-scene]');
 const search=panel.locator('[data-wep-savefree-search]');
 const selection=panel.locator('[data-wep-savefree-selection]');
 const choose=key=>panel.locator('[data-wep-savefree-choose="'+key+'"]');
 const candidate=key=>panel.locator('[data-wep-savefree-results] [data-item-thumb-id="'+key+'"]');
 const selected=key=>selection.locator('[data-item-thumb-id="'+key+'"]');
 const noDB=async()=>assert.equal(await page.evaluate(n=>indexedDB.databases().then(d=>d.some(x=>x.name===n)),DB),false);
 const pick=async(key)=>{await search.fill(key);await choose(key).waitFor();await choose(key).focus();await page.keyboard.press('Enter');};
 const fallback=async(loc)=>{await loc.waitFor();assert.equal(await loc.getAttribute('data-media-status'),'unavailable');assert.equal(await loc.locator('img').count(),0);};
 await panel.locator('[data-wep-savefree-load]').click();await search.waitFor({timeout:30000});
 await pick(other);await fallback(selected(other));await noDB();
 await panel.locator('[data-wep-savefree-title]').fill('QA457 preview only');await panel.locator('[data-wep-savefree-preview]').click();
 await panel.locator('[data-wep-savefree-artifact]').waitFor();assert.match(await panel.locator('[data-wep-savefree-artifact]').innerText(),/3 × 2/);
 await noDB();
 await search.fill(id);await candidate(id).waitFor();await fallback(candidate(id));assert.deepEqual(mediaRequests,[]);
 // Reuse reviewed synthetic fixture construction, not the Owner lifecycle assertions.
 const fixturePath=await page.evaluate(async()=>{
  const media=await import('/src/lib/item-media/switch1253-public-item-images.mjs');
  const prefs=await import('/src/lib/item-media/public-item-images.mjs');
  const id='40006096',pin=media.SWITCH1253_NATIVE_PINS[id];
  const release={
   mediaPublic:true,decisionId:prefs.ITEM_IMAGE_OWNER_DECISION_ID,scope:media.SWITCH1253_OWNER_SCOPE,
   rightsHolderLicense:'DOCUMENTED_SCOPE_LICENSE',licenseEvidenceSha256:'a'.repeat(64),
   rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',
   takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',attribution:'EIGHT_LOCALES_REVIEWED',
   oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',operatorReceiptSha256:'b'.repeat(64),
   items:{[id]:{originalNativeStreamSha256:pin.originalNativeStreamSha256,
    sourcePngSha256:pin.sourcePngSha256,webpSha256:pin.webpSha256,
    rightsStatus:'DOCUMENTED_LICENSE_APPROVED',publicationDecision:'OWNER_SCOPED_PUBLICATION_ACCEPTED',
    visibility:'RELEASED_PLAYER_FACING'}}
  };
  const {mediaPublic,items,...reviewFields}=release;
  const raw={schema:media.SWITCH1253_ITEM_IMAGE_SCHEMA,assetVariant:media.SWITCH1253_ITEM_IMAGE_VARIANT,
   codec:'WEBP_LOSSLESS_RGBA_EXACT',format:'webp',lossless:true,
   source:{...media.SWITCH1253_TARGET,originalBundleSha256:media.SWITCH1253_ORIGINAL_BUNDLE_SHA256},
   target:{...media.SWITCH1253_TARGET},publication:{gate:'MEDIA_PUBLIC_SCOPED_ON',...reviewFields},
   items:{[id]:{...pin,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',visibility:'RELEASED_PLAYER_FACING',
    rightsStatus:'DOCUMENTED_LICENSE_APPROVED',publicationDecision:'OWNER_SCOPED_PUBLICATION_ACCEPTED',
    assetStatus:'WEBP_LOSSLESS_VERIFIED_160'}}};
  const catalog=media.validateSwitch1253ItemImageCatalog(raw,release);
  // Keep the validated synthetic fixture separate from any live manifest.
  window.__wepSyntheticItemThumbCatalog=catalog;
  return media.scopedSwitch1253ItemImageHref('',id,catalog);
 });

 const url=origin+fixturePath;
 assert.match(fixturePath,/^\/ddv\/item-images\//);
 let responseMode='fail',hits=0;
 await page.route(url,async r=>{hits++;if(responseMode==='fail')await r.fulfill({status:404,body:'synthetic missing'});else await r.fulfill({status:200,contentType:'image/webp',headers:{'cache-control':'no-store'},body:Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAdQsnoUuf+BiOh/AAA=','base64')});});
 const enable=()=>page.evaluate(async()=>{const m=await import('/src/lib/item-media/switch1253-public-item-images.mjs');m.switch1253PublicItemImageSource.set({status:'VERIFIED',catalog:window.__wepSyntheticItemThumbCatalog,reason:''});});
 const disable=()=>page.evaluate(async()=>{const m=await import('/src/lib/item-media/switch1253-public-item-images.mjs');m.switch1253PublicItemImageSource.set({status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'});});
 await enable();await candidate(id).scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const e=document.querySelector('[data-wep-savefree-results] [data-item-thumb-id="40006096"]');return e?.dataset.mediaStatus==='unavailable'&&!!e.querySelector('[aria-hidden=true]');});
 // Wait for real HTTP failure, not a synthetic error event.
 for(let i=0;i<100&&hits===0;i++)await new Promise(r=>setTimeout(r,50));
 assert.ok(hits>0,'actual synthetic 404 requested');await fallback(candidate(id));await fallback(selected(other));
 // Search removal destroys failed component; same canonical ID remount must recover.
 await search.fill('QRW457-no-result');await candidate(id).waitFor({state:'detached'});assert.equal(await panel.locator('[data-wep-savefree-results] li').count(),0);
 responseMode='ok';await search.fill(id);await candidate(id).scrollIntoViewIfNeeded();
 const img=candidate(id).locator('img');await img.waitFor();await img.evaluate(e=>e.decode());
 assert.equal(await img.evaluate(e=>e.naturalWidth),8);assert.equal(await img.getAttribute('src'),fixturePath);
 assert.ok((await img.getAttribute('alt')).trim());
 await fallback(selected(other));assert.match(await panel.locator('[data-wep-savefree-artifact]').innerText(),/3 × 2/);
 // Pick a second ID: geometry decides independently, never image presence.
 await pick(id);
 assert.equal(await panel.locator('[data-wep-savefree-artifact]').count(),0);
 const eligible=await page.evaluate(async()=>{const {loadCollectionRuntime}=await import('/src/lib/collection/runtime.js');const {buildSharedCatalogDirectory}=await import('/src/lib/entity/shared-catalog-directory.mjs');const {createSwitchWorldReadAdapter}=await import('/src/lib/wep/world-browser-adapter.ts');const {resolveVerifiedSaveFreeSceneItem}=await import('/src/lib/wep/savefree-first-scene.ts');const c=await loadCollectionRuntime('');const b=await createSwitchWorldReadAdapter({basePath:''});try{return !!resolveVerifiedSaveFreeSceneItem(buildSharedCatalogDirectory(c.index,c.rows,'en'),b,40006096)}catch{return false}});
 if(eligible){await selected(id).locator('img').waitFor();assert.equal(await selected(id).locator('img').getAttribute('src'),fixturePath);}
 else{assert.equal(await selection.count(),0);assert.equal(await panel.locator('[data-wep-savefree-status][role=alert]').count(),1);}
 await pick(other);await fallback(selected(other));assert.equal(await panel.locator('[data-wep-savefree-save]:not([disabled])').count(),0);
 // At 320 CSS pixels with max preference, candidate/selection do not escape panel.
 await page.evaluate(async()=>{const {itemImagePreferences}=await import('/src/lib/item-media/public-item-images.mjs');itemImagePreferences.set({size:96,fit:'cover',density:'compact'});});
 await search.fill(id);await candidate(id).locator('img').waitFor();
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await page.setViewportSize({width,height:900});await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
  const m=await panel.evaluate(e=>({c:e.clientWidth,s:e.scrollWidth}));assert.ok(m.s<=m.c+2,JSON.stringify(m));
  for(const el of [candidate(id),selected(other)]){const b=await el.evaluate(e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,w:innerWidth}});assert.ok(b.l>=-1&&b.r<=b.w+2,JSON.stringify(b));}
 }
 await disable();await fallback(candidate(id));await fallback(selected(other));
 await search.fill('QRW457-no-result');await search.fill(id);await fallback(candidate(id));await noDB();
 assert.equal(await page.locator('[data-editor-object-id]').count(),0);
 assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);assert.ok(mediaRequests.every(u=>u===url));
 console.log('QRW457_ACTUAL_CHROME_404_REMOUNT_RESELECT_OFF_NO_DB_PASS',JSON.stringify({hits,eligible,mediaRequests:mediaRequests.length}));
 await context.close();
}finally{await browser.close()}
