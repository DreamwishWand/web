import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=(process.env.WEP_COORD_ORIGIN||'http://127.0.0.1:4366').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'installed Chrome must exist');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const network=[],errors=[];
try {
 const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});
 context.on('request',req=>{
  if(req.url().startsWith('http') &&
    (new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method())))
    network.push(req.method()+' '+req.url());
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 const response=await page.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(response.status(),200);
 const panel=page.locator('[data-wep-local-coordinate-studio]');
 await panel.waitFor();
 assert.equal(await panel.getAttribute('data-save-writer'),'off');
 assert.equal(await panel.getAttribute('data-native-apply'),'off');
 assert.equal(await panel.getAttribute('data-cloud'),'off');
 const library='dreamwishwand:wep:scene-presets:local:v1';
 assert.equal((await page.evaluate(()=>indexedDB.databases())).some(d=>d.name===library),false,
  'passive Studio never opens local Scene DB');
 assert.equal(await panel.locator('[data-wep-coord-scene]').count(),0);
 // Seed only with existing production SaveFree from static pinned Catalog.
 const seed=await page.evaluate(async()=>{
  const {loadCollectionRuntime}=await import('/src/lib/collection/runtime.js');
  const {buildSharedCatalogDirectory}=await import('/src/lib/entity/shared-catalog-directory.mjs');
  const {createSwitchWorldReadAdapter}=await import('/src/lib/wep/world-browser-adapter.ts');
  const {buildSaveFreeTwoFurnitureScene}=await import('/src/lib/wep/savefree-first-scene.ts');
  const {saveLocalScene,verifiedReopenLocalScene}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const [collection,binding]=await Promise.all([
    loadCollectionRuntime(''),createSwitchWorldReadAdapter({basePath:''})
  ]);
  const directory=buildSharedCatalogDirectory(collection.index,collection.rows,'en');
  if(directory.status!=='READY')throw Error('UNVERIFIED_CATALOG');
  const source=buildSaveFreeTwoFurnitureScene({
    directory,binding,firstItemId:40000047,secondItemId:40000047,
    secondX:3,secondY:0,title:'Verified source two furniture'
  });
  const receipt=await saveLocalScene({
    artifact:source.artifact,title:source.title,expectedRevision:0
  });
  const reopened=await verifiedReopenLocalScene(receipt);
  return {id:reopened.entry.id,revision:reopened.revision,
    raw:reopened.row.primary,entry:reopened.entry,
    oldArtifact:JSON.stringify(reopened.entry.artifact)};
 });
 assert.equal(seed.revision,1);
 assert.deepEqual(seed.entry.artifact.bounds,{w:6,h:2});
 await panel.locator('[data-wep-coord-load]').click();
 await panel.locator('[data-wep-coord-scene]').selectOption(seed.id);
 await panel.locator('[data-wep-coord-object]').selectOption('o1');
 // Collision is a negative BEFORE any local library mutation.
 await panel.locator('[data-wep-coord-x]').fill('1');
 await panel.locator('[data-wep-coord-y]').fill('1');
 await panel.locator('[data-wep-coord-preview]').click();
 assert.equal(await panel.locator('[data-wep-coord-review]').count(),0);
 assert.equal(await panel.locator('[data-wep-coord-save-as]:not([disabled])').count(),0);
 // One independently reviewed, relative coordinate change.
 await panel.locator('[data-wep-coord-x]').fill('0');
 await panel.locator('[data-wep-coord-y]').fill('2');
 await panel.locator('[data-wep-coord-preview]').click();
 await panel.locator('[data-wep-coord-review]').waitFor();
 assert.equal(await panel.locator('[data-wep-coord-map] rect').count(),12);
 assert.match(await panel.locator('[data-wep-coord-review]').innerText(),/o1/);
 assert.equal(await panel.locator('[data-wep-coord-save-as]:not([disabled])').count(),1);
 await panel.locator('[data-wep-coord-undo]').click();
 assert.equal(await panel.locator('[data-wep-coord-review]').count(),0);
 assert.equal(await panel.locator('[data-wep-coord-save-as]:not([disabled])').count(),0);
 await panel.locator('[data-wep-coord-redo]').click();
 await panel.locator('[data-wep-coord-review]').waitFor();
 const unchanged=await page.evaluate(async()=>{
  const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const row=await reopenLocalScenes();return {revision:row.revision,primary:row.primary};
 });
 assert.deepEqual(unchanged,{revision:1,primary:seed.raw},
  'preview/undo/redo must not mutate original Scene DB');
 await panel.locator('[data-wep-coord-save-as]').click();
 await panel.locator('[data-wep-coord-status]').filter({hasText:/New Scene saved and independently reopened/}).waitFor({timeout:15000});
 const saved=await page.evaluate(async()=>{
  const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const row=await reopenLocalScenes();
  return {revision:row.revision,backupRevision:row.backupRevision,
    backup:row.backup,entries:row.document.entries};
 });
 assert.equal(saved.revision,2);
 assert.equal(saved.backupRevision,1);
 assert.equal(saved.backup,seed.raw,'old complete library raw string retained in Backup');
 assert.equal(saved.entries.length,2);
 assert.deepEqual(saved.entries[0],seed.entry,'the original entry is immutable');
 assert.equal(saved.entries[1].artifact.objects.length,2);
 assert.deepEqual(saved.entries[1].artifact.bounds,{w:3,h:4});
 assert.equal(saved.entries[1].artifact.source.platform,'synthetic');
 assert.equal(saved.entries[1].artifact.requirements.itemQuantities['40000047'],2);
 assert.equal(await page.locator('[data-editor-object-id]').count(),0);
 console.log('WEP_COORD_REAL_CHROME_NONDESTRUCTIVE_CAS_BACKUP_UNDO_REDO_REOPEN_PASS');

 // Concurrency adversarial: user preview becomes stale after a second writer.
 await panel.locator('[data-wep-coord-load]').click();
 await panel.locator('[data-wep-coord-scene]').selectOption(seed.id);
 await panel.locator('[data-wep-coord-object]').selectOption('o1');
 await panel.locator('[data-wep-coord-x]').fill('0');
 await panel.locator('[data-wep-coord-y]').fill('3');
 await panel.locator('[data-wep-coord-preview]').click();
 await panel.locator('[data-wep-coord-review]').waitFor();
 await page.evaluate(async entry=>{
  const {saveLocalScene}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  await saveLocalScene({artifact:entry.artifact,title:'Concurrent extra Scene',expectedRevision:2});
 },seed.entry);
 await panel.locator('[data-wep-coord-save-as]').click();
 await panel.locator('[data-wep-coord-status][role="alert"]').waitFor({timeout:15000});
 assert.equal(await panel.locator('[data-wep-coord-status]').getAttribute('role'),'alert',
   'stale Preview Save must fail closed');
 const after=await page.evaluate(async()=>{
  const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const row=await reopenLocalScenes();
  return {revision:row.revision,entries:row.document.entries};
 });
 assert.equal(after.revision,3,'no duplicate output from stale user');
 assert.equal(after.entries.length,3);
 assert.deepEqual(after.entries[0],seed.entry);
 assert.equal(after.entries[2].title,'Concurrent extra Scene');
 assert.deepEqual(network,[],'no Cloud/POST/external requests');
 assert.deepEqual(errors,[],'no JS errors');
 console.log('WEP_COORD_REAL_CHROME_STALE_CAS_DENY_NO_NATIVE_WRITER_PASS');
 await context.close();
}finally{await browser.close();}
