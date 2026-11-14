import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=(process.env.WEP_SAVEFREE_ORIGIN||'http://127.0.0.1:4358').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'Installed real Chrome required');
const DB='dreamwishwand:wep:scene-presets:local:v1';
const oldKeys=['dreamwishwand:moodboards:v1','dreamwishwand:moodboards:v1:backup'];
const oldValues=['savefree-never-touch-moodboard','savefree-never-touch-backup'];
const unsafe=[],errors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 context.on('request',req=>{
  if(req.url().startsWith('http')&&
     (new URL(req.url()).origin!==origin ||
      !['GET','HEAD'].includes(req.method())))
    unsafe.push(req.method()+' '+req.url());
 });
 const mediaRequests=[];
 context.on('request',req=>{if(req.url().includes('/ddv/item-images/'))mediaRequests.push(req.url());});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 let response=await page.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(response.status(),200);
 const panel=page.locator('[data-wep-savefree-first-scene]');
 await panel.waitFor({timeout:30000});
 const dbs=()=>page.evaluate(()=>indexedDB.databases());
 assert.equal((await dbs()).some(x=>x.name===DB),false,'passive Editor must not create Scene Store');
 assert.equal(await page.locator('[data-editor-object-id]').count(),0,
  'no Save/file/EditorSession was loaded');
 await page.evaluate(([keys,vals])=>keys.forEach((k,i)=>localStorage.setItem(k,vals[i])),
   [oldKeys,oldValues]);
 assert.equal(await page.locator('[data-wep-savefree-save]').count(),0);
 await page.locator('[data-wep-savefree-load]').focus();
 await page.keyboard.press('Enter');
 try {
  await page.locator('[data-wep-savefree-search]').waitFor({timeout:20000});
 } catch (error) {
  const status=await page.locator('[data-wep-savefree-status]').allTextContents();
  const state=await page.locator('[data-wep-savefree-load]').evaluate(el=>({
    text:el.textContent,disabled:el.disabled,outer:el.outerHTML.slice(0,600)
  }));
  const pageSnapshot=await page.locator('[data-wep-savefree-first-scene]').innerText();
  const probe=await page.evaluate(async()=>{
   const result={};
   try{
    const {loadCollectionRuntime}=await import('/src/lib/collection/runtime.js');
    const catalog=await loadCollectionRuntime('');
    result.catalog={n:catalog.rows.length,target:catalog.index.t};
    const {buildSharedCatalogDirectory}=await import('/src/lib/entity/shared-catalog-directory.mjs');
    const started=performance.now();
    const dir=buildSharedCatalogDirectory(catalog.index,catalog.rows,'en');
    result.directory={status:dir.status,length:dir.entries?.length,elapsedMs:performance.now()-started};
   }catch(e){result.catalogError=String(e);}
   try{
    const {createSwitchWorldReadAdapter}=await import('/src/lib/wep/world-browser-adapter.ts');
    const binding=await createSwitchWorldReadAdapter({basePath:''});
    result.world={version:binding.source.gameVersion,sha:binding.provenance.readDataSha256};
   }catch(e){result.worldError=String(e);}
   return result;
  });
  throw Error('WEP_SAVEFREE_BROWSER_CATALOG_LOAD_DENIED '+JSON.stringify({status,state,pageSnapshot:pageSnapshot.slice(0,700),probe,errors,unsafe})+' '+String(error));
 }
 assert.equal((await dbs()).some(x=>x.name===DB),false,'Catalog load must not touch IndexedDB');
 // New presentation-only scope: canonical catalog ID -> shared ItemThumb.
 // This is the real production OFF path, not a real game-image assertion.
 assert.equal(await panel.locator('[data-media-status="verified-public-image"]').count(),0);
 assert.ok(await panel.locator('[data-wep-savefree-results] [data-item-thumb-id]').count()>0);
 for(const id of await panel.locator('[data-wep-savefree-results] [data-item-thumb-id]').evaluateAll(els=>els.map(el=>el.getAttribute('data-item-thumb-id')))){
  assert.equal(await panel.locator('[data-wep-savefree-choose="'+id+'"]').count(),1,'thumbnail and catalog button must share canonical ID');
 }
 assert.deepEqual(mediaRequests,[],'OFF must not request any media');

 await page.locator('[data-wep-savefree-search]').fill('40000047');
 const choose=page.locator('[data-wep-savefree-choose="40000047"]');
 await choose.waitFor({timeout:30000});
 await choose.focus();
 await page.keyboard.press('Enter');
 const selection=page.locator('[data-wep-savefree-selection]');
 await selection.waitFor();
 const selectedThumb=selection.locator('[data-item-thumb-id="40000047"]');
 assert.equal(await selectedThumb.count(),1);
 assert.equal(await selectedThumb.getAttribute('data-media-status'),'unavailable');
 assert.equal(await selectedThumb.locator('img').count(),0);
 assert.equal(await selectedThumb.locator('[aria-hidden="true"]').count(),1);
 // The shared preference store changes presentation only.
 await page.evaluate(async()=>{
  const {itemImagePreferences}=await import('/src/lib/item-media/public-item-images.mjs');
  itemImagePreferences.set({size:96,fit:'cover',density:'compact'});
 });
 assert.equal(await selectedThumb.evaluate(el=>getComputedStyle(el).getPropertyValue('--image-size').trim()),'96px');
 await page.evaluate(async()=>{
  const {itemImagePreferences}=await import('/src/lib/item-media/public-item-images.mjs');
  itemImagePreferences.set({size:56,fit:'contain',density:'comfortable'});
 });
 assert.deepEqual(mediaRequests,[],'OFF search and selection do not fetch images');
 assert.match(await selection.innerText(),/3 × 2/);
 assert.match(await selection.innerText(),/VERIFIED_SWITCH1250_CATALOG_GEOMETRY_SCOPE/);
 assert.equal(await page.locator('[data-wep-savefree-save]:not([disabled])').count(),0,
  'Save requires title and explicit valid preview');
 await page.locator('[data-wep-savefree-title]').fill('First Save-free verified furniture Scene');
 await page.locator('[data-wep-savefree-preview]').focus();
 await page.keyboard.press('Enter');
 await page.locator('[data-wep-savefree-artifact]').waitFor();
 const artifact=await page.locator('[data-wep-savefree-artifact]').innerText();
 assert.match(artifact,/1 objects/);assert.match(artifact,/3 × 2/);
 assert.match(artifact,/writeReady=false \/ applyReady=false/);
 assert.equal((await dbs()).some(x=>x.name===DB),false,
  'preview is in-memory only; store created on explicit Save');
 await page.locator('[data-wep-savefree-save]').focus();await page.keyboard.press('Enter');
 const saved=page.locator('[data-wep-savefree-saved]');
 await saved.waitFor({timeout:15000});
 const current=await page.evaluate(async name=>{
  const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const row=await reopenLocalScenes();
  return {revision:row.revision,primary:row.primary,backup:row.backup,
   backupRevision:row.backupRevision,entries:row.document.entries};
 },DB);
 assert.equal(current.revision,1);
 assert.equal(current.backupRevision,0);
 assert.deepEqual(JSON.parse(current.backup).entries,[]);
 assert.equal(current.entries.length,1);
 const entry=current.entries[0];
 assert.equal(entry.artifact.objects.length,1);
 assert.equal(entry.artifact.objects[0].itemId,40000047);
 assert.equal(entry.artifact.objects[0].layer,'furniture');
 assert.equal(entry.artifact.objects[0].footprint.length,6);
 assert.deepEqual(entry.artifact.bounds,{w:3,h:2});
 assert.equal(entry.artifact.source.platform,'synthetic');
 assert.equal(entry.artifact.networks.roads,null);
 assert.equal(entry.artifact.networks.fences,null);
 assert.equal(await page.locator('[data-editor-object-id]').count(),0,
  'Save-free Save must never create EditorSession');
 assert.equal(await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),oldKeys)
  .then(x=>JSON.stringify(x)),JSON.stringify(oldValues));
 console.log('WEP_SAVEFREE_FIRST_NONEMPTY_REAL_CHROME_PINNED_CATALOG_GEOMETRY_IDB_CAS_REOPEN_PASS');
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(loc,{force:true});
  assert.ok((await panel.locator('h2').innerText()).length>5);
  assert.ok((await page.locator('[data-wep-savefree-status]').innerText()).length>5);
 }
 await page.locator('#site-locale').selectOption('en',{force:true});
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(z=>{document.documentElement.style.zoom=z;},zoom);
  const m=await panel.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(m.scroll<=m.client+2,'Savefree 320/CSS200 panel overflow '+JSON.stringify(m));
  const thumbBounds=await selectedThumb.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,vw:window.innerWidth};});
  assert.ok(thumbBounds.left>=-1&&thumbBounds.right<=thumbBounds.vw+2,'selected thumb must fit viewport '+JSON.stringify(thumbBounds));
 }
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 // Synthetic-only image positive: the existing reviewed-resolver fixture
 // is injected into this disposable page store, after mounting the actual
 // canonical candidate. Never change production release configuration.
 assert.deepEqual(mediaRequests,[],'OFF did not fetch media before synthetic fixture');
 await page.locator('[data-wep-savefree-search]').fill('40006096');
 const fixtureChoice=panel.locator('[data-wep-savefree-choose="40006096"]');
 await fixtureChoice.waitFor({timeout:10000});
 const fixtureRow=fixtureChoice.locator('..');
 const fixtureThumb=fixtureRow.locator('[data-item-thumb-id="40006096"]');
 assert.equal(await fixtureThumb.count(),1);
 assert.equal(await fixtureThumb.getAttribute('data-media-status'),'unavailable');
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
 assert.match(fixturePath,/^\/ddv\/item-images\//);
 const fixtureUrl=origin+fixturePath;
 // Generated solid 8x8 WebP, NOT DDV artwork or the authentic pinned SHA bytes.
 // Intercept only within this isolated synthetic browser, never publish the file.
 await page.route(fixtureUrl,route=>route.fulfill({status:200,contentType:'image/webp',
  body:Buffer.from('UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAdQsnoUuf+BiOh/AAA=','base64')}));
 await page.evaluate(async()=>{
  const media=await import('/src/lib/item-media/switch1253-public-item-images.mjs');
  const prefs=await import('/src/lib/item-media/public-item-images.mjs');
  media.switch1253PublicItemImageSource.set({status:'VERIFIED',catalog:window.__wepSyntheticItemThumbCatalog,reason:''});
  prefs.itemImagePreferences.set({size:80,fit:'cover',density:'comfortable'});
 });
 const fixtureImage=fixtureThumb.locator('img');
 await fixtureImage.scrollIntoViewIfNeeded();
 await fixtureImage.waitFor();
 await fixtureImage.evaluate(img=>img.decode());
 assert.equal(await fixtureImage.evaluate(img=>img.naturalWidth),8);
 assert.equal(await fixtureImage.getAttribute('src'),fixturePath);
 assert.ok((await fixtureImage.getAttribute('alt')).trim().length>0);
 assert.ok((await fixtureRow.locator('.item-name').innerText()).includes(await fixtureImage.getAttribute('alt')));
 assert.equal(await fixtureImage.evaluate(img=>getComputedStyle(img).objectFit),'cover');
 assert.equal(await fixtureThumb.evaluate(el=>getComputedStyle(el).getPropertyValue('--image-size').trim()),'80px');
 assert.equal(await selectedThumb.getAttribute('data-media-status'),'unavailable','different canonical ID must not alias fixture');
 await fixtureImage.dispatchEvent('error');
 await fixtureThumb.locator('[aria-hidden="true"]').waitFor();
 assert.equal(await fixtureThumb.getAttribute('data-media-status'),'unavailable','decode failure falls back');
 await page.evaluate(async()=>{
  const media=await import('/src/lib/item-media/switch1253-public-item-images.mjs');
  const prefs=await import('/src/lib/item-media/public-item-images.mjs');
  media.switch1253PublicItemImageSource.set({status:'NOT_CONFIGURED',catalog:null,reason:'MEDIA_PUBLIC_OFF'});
  prefs.itemImagePreferences.set({size:56,fit:'contain',density:'comfortable'});
  delete window.__wepSyntheticItemThumbCatalog;
 });
 await page.unroute(fixtureUrl);
 assert.ok(mediaRequests.length>0,'synthetic positive must load an image');
 assert.ok(mediaRequests.every(url=>url===fixtureUrl),'only intercepted synthetic exact URL is allowed');
 console.log('WEP_SAVEFREE_ITEMTHUMB_SYNTHETIC_VALIDATED_RESOLVER_8X8_WEBP_POSITIVE_ERROR_FALLBACK_PASS');
 // Reuse the accepted Presets -> explicit selected same-tab sender -> WEP
 // receiver. This is a NEW first-time-created source path, not old QA re-run.
 await page.goto(origin+'/presets/',{waitUntil:'networkidle',timeout:60000});
 await page.locator('[data-preset-child="my"]').click();
 await page.locator('[data-device-scenes-reopen]').click();
 await page.locator('[data-device-scene-select]').first().waitFor();
 await page.locator('[data-device-scene-select]').first().click();
 await page.locator('[data-device-scene-world-editor-selected]').focus();
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/editor\/world\/?$/);
 await page.locator('[data-wep-selected-scene-route-confirm]').waitFor();
 assert.equal(await page.locator('[data-wep-selected-scene-route-draft]').count(),0,
  'no auto Draft after one-shot sender');
 await page.locator('[data-wep-selected-scene-route-confirm]').focus();
 await page.keyboard.press('Enter');
 const detached=page.locator('[data-wep-selected-scene-route-draft]');
 await detached.waitFor();
 assert.match(await detached.innerText(),/40000047/);
 assert.match(await detached.innerText(),/3 × 2/);
 assert.match(await detached.innerText(),/writeReady=false \/ applyReady=false/);
 assert.equal(await page.locator('[data-editor-object-id]').count(),0);
 const afterward=await page.evaluate(async()=>{
  const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const row=await reopenLocalScenes();
  return {revision:row.revision,primary:row.primary,backup:row.backup};
 });
 assert.deepEqual(afterward,{revision:current.revision,primary:current.primary,
  backup:current.backup},'selected read-only sender/receiver cannot mutate stored first Scene');
 assert.deepEqual(await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),oldKeys),
  oldValues,'legacy Moodboard primary/backup unchanged');
 assert.ok(mediaRequests.every(url=>url===fixtureUrl),'no real game image or manifest requests');
 console.log('WEP_SAVEFREE_SHARED_ITEMTHUMB_CANONICAL_ID_OFF_FALLBACK_PREFERENCES_PASS');
 assert.deepEqual(unsafe,[],'unexpected external request or mutating HTTP');
 assert.deepEqual(errors,[],'browser JS exception');
 console.log(JSON.stringify({operation:'WEP_SAVEFREE_FIRST_NONEMPTY_VERIFIED_CATALOG_SCENE@1',
  evidence:'INSTALLED_REAL_CHROME_STATIC_VERIFIED_SWITCH1250_CATALOG_SYNTHETIC_SCENE_ONLY',
  itemId:40000047,footprint:{w:3,h:2},revision:1,backupRevision:0,
  checks:['fresh browser no Save or EditorSession','Catalog and geometry SHA verified',
   'user explicit Item/Title/Preview/Save','nonempty one-object valid Scene',
   'same single IDB CAS+Backup+independent Reopen','8 locales','320/CSS200',
   'existing Presets one-shot sender/receiver and detached readonly','no POST/Cloud/Native',
   'no legacy/Moodboard mutation'],unsafe,errors}));
 await context.close();
}finally{await browser.close();}
