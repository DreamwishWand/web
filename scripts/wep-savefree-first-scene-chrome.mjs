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
 const thumbFor=id=>panel.locator('[data-item-thumb-id="'+id+'"]');
 const mediaRequests=[];
 context.on('request',req=>{if(req.url().includes('/ddv/item-images/'))mediaRequests.push(req.url());});
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
  const thumbBounds=await selectedThumb.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,vw:document.documentElement.clientWidth};});
  assert.ok(thumbBounds.left>=-1&&thumbBounds.right<=thumbBounds.vw+2,'selected thumb must fit viewport '+JSON.stringify(thumbBounds));
 }
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
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
 assert.deepEqual(mediaRequests,[],'production OFF path must make no image or manifest requests');
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
