import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const S='ae7199e01f0fb36e9d62971cbb0f01fbf2c1b121',B='261f089bb164e0b2f566d16338da7b84a329f5d6';
const pins={
 'src/lib/wep/SaveFreeFirstScene.svelte':['b5a3610a1e9950bd5dd5be30960ef8820ff0f66b','ba09f189e76dafde45e7f9502003ba8704212d77'],
 'docs/wep/world-editor-localization-inventory-20261002.json':['b6712ea0df4341483a4da9a59758f534e63258a6','c69f64bfef779dd7fb8d71475bf536aab311cfe2'],
 'scripts/wep-savefree-first-scene-chrome.mjs':['20f8ccf845c2b56bd8a3dee07b75b71db206483b','d79102fe10c7bfcc9254577fb143ceab21741e30']
};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
assert.deepEqual(git('diff','--name-status',B,S).split('\n').sort(),Object.keys(pins).map(p=>'M\t'+p).sort());
for(const [p,[a,b]] of Object.entries(pins)){assert.equal(git('rev-parse',B+':'+p),a);assert.equal(git('rev-parse',S+':'+p),b);assert.equal(git('rev-parse','HEAD:'+p),b)}
assert.deepEqual(git('diff','--name-status',S,'HEAD').split('\n').sort(),['A\tscripts/04qr-w-pr1054-savefree-thumb-independent-20261113.mjs','A\t.github/workflows/04qr-w-pr1054-savefree-thumb-20261113.yml'].sort());
for(const p of ['src/lib/ui/ItemThumb.svelte','src/lib/item-media/switch1253-public-item-images.mjs','src/lib/wep/savefree-first-scene.ts','src/lib/wep/local-scene-preset-store.mjs'])assert.equal(git('rev-parse',B+':'+p),git('rev-parse',S+':'+p));
console.log('QRW1054_FIXED3_INVARIANTS_PASS');
const origin='http://127.0.0.1:4358';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const page=await context.newPage(),errors=[],unsafe=[],media=[];
 page.on('pageerror',e=>errors.push(String(e)));
 context.on('request',r=>{if(r.url().includes('/ddv/item-images/'))media.push(r.url());if(r.url().startsWith('http')&&(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method())))unsafe.push(r.method()+' '+r.url())});
 assert.equal((await page.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:60000})).status(),200);
 const panel=page.locator('[data-wep-savefree-first-scene]'),search=panel.locator('[data-wep-savefree-search]'),sel=panel.locator('[data-wep-savefree-selection]');
 const choice=id=>panel.locator('[data-wep-savefree-choose="'+id+'"]');
 const thumb=id=>choice(id).locator('..').locator('[data-item-thumb-id="'+id+'"]');
 const select=async id=>{await search.fill(id);await choice(id).waitFor();await choice(id).focus();await page.keyboard.press('Enter');};
 const dbs=()=>page.evaluate(()=>indexedDB.databases());
 const DB='dreamwishwand:wep:scene-presets:local:v1';
 const snapshot=()=>page.evaluate(async()=>{const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');const r=await reopenLocalScenes();return {revision:r.revision,primary:r.primary,backup:r.backup}});
 await panel.locator('[data-wep-savefree-load]').focus();await page.keyboard.press('Enter');await search.waitFor({timeout:30000});
 assert.ok(!(await dbs()).some(x=>x.name===DB));
 assert.deepEqual(media,[]);
 await select('40000047');await sel.waitFor();assert.equal(await sel.locator('[data-item-thumb-id]').getAttribute('data-item-thumb-id'),'40000047');
 await panel.locator('[data-wep-savefree-title]').fill('QA independent scene');
 await panel.locator('[data-wep-savefree-preview]').click();await panel.locator('[data-wep-savefree-artifact]').waitFor();
 await panel.locator('[data-wep-savefree-save]').click();await panel.locator('[data-wep-savefree-saved]').waitFor();
 const before=await snapshot();assert.equal(before.revision,1);
 await search.fill('40006096');await choice('40006096').waitFor();
 // Independent test-only validated fixture; no production gate edits, no authentic pixels.
 const path=await page.evaluate(async()=>{
 const m=await import('/src/lib/item-media/switch1253-public-item-images.mjs'),p=await import('/src/lib/item-media/public-item-images.mjs');
 const id='40006096',pin=m.SWITCH1253_NATIVE_PINS[id];
 const review={decisionId:p.ITEM_IMAGE_OWNER_DECISION_ID,scope:m.SWITCH1253_OWNER_SCOPE,rightsHolderLicense:'DOCUMENTED_SCOPE_LICENSE',licenseEvidenceSha256:'a'.repeat(64),rightsReview:'OPERATOR_ACCEPTED',receivingContact:'MANAGED_VERIFIED',takedown:'MANAGED_TESTED',managedHttps:'MANAGED_VERIFIED',attribution:'EIGHT_LOCALES_REVIEWED',oldUrlAndCache:'MANAGED_TESTED',rollback:'MANAGED_TESTED',operatorReceiptSha256:'b'.repeat(64)};
 const decision={rightsStatus:'DOCUMENTED_LICENSE_APPROVED',publicationDecision:'OWNER_SCOPED_PUBLICATION_ACCEPTED',visibility:'RELEASED_PLAYER_FACING'};
 const release={mediaPublic:true,...review,items:{[id]:{originalNativeStreamSha256:pin.originalNativeStreamSha256,sourcePngSha256:pin.sourcePngSha256,webpSha256:pin.webpSha256,...decision}}};
 const raw={schema:m.SWITCH1253_ITEM_IMAGE_SCHEMA,assetVariant:m.SWITCH1253_ITEM_IMAGE_VARIANT,codec:'WEBP_LOSSLESS_RGBA_EXACT',format:'webp',lossless:true,source:{...m.SWITCH1253_TARGET,originalBundleSha256:m.SWITCH1253_ORIGINAL_BUNDLE_SHA256},target:{...m.SWITCH1253_TARGET},publication:{gate:'MEDIA_PUBLIC_SCOPED_ON',...review},items:{[id]:{...pin,...decision,pixelStatus:'SWITCH_RGBA_EXACT_VERIFIED',assetStatus:'WEBP_LOSSLESS_VERIFIED_160'}}};
 const c=m.validateSwitch1253ItemImageCatalog(raw,release);window.__qrw1054=c;
 return m.scopedSwitch1253ItemImageHref('',id,c);
 });
 assert.match(path,/^\/ddv\/item-images\//);
 const url=origin+path;
 let bad=true;
 await page.route(url,r=>r.fulfill({status:200,contentType:'image/webp',headers:{'cache-control':'no-store'},body:bad?Buffer.from('not a webp'):Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAdQsnoUuf+BiOh/AAA=','base64')}));
 const enable=()=>page.evaluate(async()=>{const m=await import('/src/lib/item-media/switch1253-public-item-images.mjs');m.switch1253PublicItemImageSource.set({status:'VERIFIED',catalog:window.__qrw1054,reason:''})});
 await enable();await thumb('40006096').scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('[data-wep-savefree-results] [data-item-thumb-id="40006096"]')?.getAttribute('data-media-status')==='unavailable' && performance.getEntriesByType('resource').some(r=>r.name.includes('/ddv/item-images/')),{},{timeout:15000});
 assert.equal(await thumb('40006096').locator('img').count(),0);
 assert.equal(await sel.locator('[data-item-thumb-id="40000047"]').getAttribute('data-media-status'),'unavailable');
 console.log('QRW1054_REAL_INVALID_IMAGE_DECODE_FALLBACK_PASS');
 // A different keyed row and a later same-ID remount must not inherit failedUrl.
 await search.fill('40000047');await choice('40000047').waitFor();
 assert.equal(await thumb('40006096').count(),0);
 assert.equal(await thumb('40000047').getAttribute('data-media-status'),'unavailable');
 bad=false;await search.fill('40006096');await choice('40006096').waitFor();
 const img=thumb('40006096').locator('img');await img.scrollIntoViewIfNeeded();await img.waitFor();await img.evaluate(i=>i.decode());
 assert.equal(await img.evaluate(i=>i.naturalWidth),8);assert.equal(await img.getAttribute('src'),path);
 assert.equal(await img.getAttribute('alt'),(await choice('40006096').locator('..').locator('.item-name').innerText()).replace(/\s+#40006096\s*$/,'').trim());
 // A preview for old geometry must be invalidated by a different selection.
 await panel.locator('[data-wep-savefree-preview]').click();await panel.locator('[data-wep-savefree-artifact]').waitFor();
 await choice('40006096').focus();await page.keyboard.press('Enter');
 assert.equal(await panel.locator('[data-wep-savefree-artifact]').count(),0);
 assert.equal(await panel.locator('[data-wep-savefree-save]:not([disabled])').count(),0);
 const chosen=await sel.locator('[data-item-thumb-id]').count();
 if(chosen){assert.equal(await sel.locator('[data-item-thumb-id]').getAttribute('data-item-thumb-id'),'40006096');await sel.locator('img').waitFor();assert.equal(await sel.locator('img').getAttribute('src'),path);}
 else{assert.equal(await panel.locator('[data-wep-savefree-status][role="alert"]').count(),1);}
 await select('40000047');await sel.waitFor();assert.equal(await sel.locator('[data-item-thumb-id]').getAttribute('data-item-thumb-id'),'40000047');assert.equal(await sel.locator('img').count(),0);
 assert.equal(await panel.locator('[data-wep-savefree-save]:not([disabled])').count(),0);
 // Test locale and viewport on populated result + selected geometry, real browser.
 for(const loc of ['ja','de','fr','it','es-ES','zh-CN','pt-BR','en']){
 await page.locator('#site-locale').selectOption(loc,{force:true});
 assert.ok((await panel.locator('h2').innerText()).trim().length>0);
 assert.equal(await sel.locator('[data-item-thumb-id]').getAttribute('data-item-thumb-id'),'40000047');
 }
 for(const [w,z] of [[320,'1'],[640,'2']]){
 await page.setViewportSize({width:w,height:900});await page.evaluate(z=>document.documentElement.style.zoom=z,z);
 assert.ok(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+2));
 }
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>document.documentElement.style.zoom='1');
 // OFF transition clears mounted image; subsequent remount must remain OFF.
 await search.fill('40006096');await choice('40006096').waitFor();await thumb('40006096').locator('img').waitFor();
 await page.evaluate(async()=>{const m=await import('/src/lib/item-media/switch1253-public-item-images.mjs');m.switch1253PublicItemImageSource.set({status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'});delete window.__qrw1054});
 await thumb('40006096').locator('[aria-hidden=true]').waitFor();
 const count=media.length;await search.fill('40000047');await choice('40000047').waitFor();await search.fill('40006096');await choice('40006096').waitFor();
 assert.equal(await thumb('40006096').locator('img').count(),0);assert.equal(media.length,count);
 assert.ok(media.length>=2&&media.every(x=>x===url));assert.deepEqual(await snapshot(),before);
 assert.equal(await page.locator('[data-editor-object-id]').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(unsafe,[]);
 console.log('QRW1054_KEYED_RESELECT_PREVIEW_INVALIDATION_OFF_SCENE_INVARIANT_PASS',JSON.stringify({selectedGeometry:chosen?'verified':'denied',mediaRequests:media.length,revision:before.revision}));
 await context.close();
}finally{await browser.close()}
