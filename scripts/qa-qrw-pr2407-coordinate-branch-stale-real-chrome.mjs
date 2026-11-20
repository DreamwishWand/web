// 04 QR-W independent 02 WEP PR2407 real Chrome L2.
 // Source-only local Scene 2D review; never a DDV game Save or Native Apply.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4368';
assert.ok(process.env.CHROME_BIN,'installed Chrome required');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block'});
const page=await context.newPage(),unsafe=[],errors=[];
context.on('request',r=>{
 if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))
  unsafe.push(r.method()+' '+r.url());
});
page.on('pageerror',e=>errors.push(String(e)));
const readRow=()=>page.evaluate(async()=>{
 const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
 return reopenLocalScenes();
});
try{
 const response=await page.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(response.status(),200);
 const panel=page.locator('[data-wep-local-coordinate-studio]');
 await panel.waitFor();
 for(const [attribute,value] of [['data-save-writer','off'],['data-native-apply','off'],
  ['data-cloud','off'],['data-editor-mutation','off']]){
  assert.equal(await panel.getAttribute(attribute),value);
 }
 assert.equal((await page.evaluate(()=>indexedDB.databases())).some(d=>d.name===
  'dreamwishwand:wep:scene-presets:local:v1'),false);
 const seed=await page.evaluate(async()=>{
  const {loadCollectionRuntime}=await import('/src/lib/collection/runtime.js');
  const {buildSharedCatalogDirectory}=await import('/src/lib/entity/shared-catalog-directory.mjs');
  const {createSwitchWorldReadAdapter}=await import('/src/lib/wep/world-browser-adapter.ts');
  const {buildSaveFreeTwoFurnitureScene}=await import('/src/lib/wep/savefree-first-scene.ts');
  const {saveLocalScene,verifiedReopenLocalScene}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const [catalog,binding]=await Promise.all([
   loadCollectionRuntime(''),createSwitchWorldReadAdapter({basePath:''})
  ]);
  const directory=buildSharedCatalogDirectory(catalog.index,catalog.rows,'en');
  if(directory.status!=='READY')throw Error('QRW_SOURCE_NOT_VERIFIED');
  const s=buildSaveFreeTwoFurnitureScene({
   directory,binding,firstItemId:40000047,secondItemId:40000047,
   secondX:3,secondY:0,title:'QRW source local scene'
  });
  const receipt=await saveLocalScene({artifact:s.artifact,title:s.title,expectedRevision:0});
  const reopened=await verifiedReopenLocalScene(receipt);
  return {id:reopened.entry.id,entry:reopened.entry,
   revision:reopened.revision,primary:reopened.row.primary,
   backup:reopened.row.backup};
 });
 assert.equal(seed.revision,1);
 assert.equal(seed.entry.artifact.objects.length,2);
 await panel.locator('[data-wep-coord-load]').click();
 await panel.locator('[data-wep-coord-scene]').selectOption(seed.id);
 await panel.locator('[data-wep-coord-object]').selectOption('o1');
 const x=panel.locator('[data-wep-coord-x]'),y=panel.locator('[data-wep-coord-y]');
 const preview=panel.locator('[data-wep-coord-preview]');
 async function move(xvalue,yvalue){
  await x.fill(String(xvalue));await y.fill(String(yvalue));
  await preview.click();await panel.locator('[data-wep-coord-review]').waitFor();
 }
 await move(0,2);
 let body=await panel.locator('[data-wep-coord-review]').innerText();
 assert.match(body,/o1 \(3,0\) → \(0,2\)/);
 await move(0,3);
 assert.match(await panel.locator('[data-wep-coord-review]').innerText(),/\(0,3\)/);
 await panel.locator('[data-wep-coord-undo]').click();
 assert.match(await panel.locator('[data-wep-coord-review]').innerText(),/\(0,2\)/);
 assert.equal(await panel.locator('[data-wep-coord-redo]').isEnabled(),true);
 await move(0,4);
 assert.equal(await panel.locator('[data-wep-coord-redo]').isEnabled(),false,
  'new branch after Undo must discard old Redo, never replay stale coordinate');
 assert.match(await panel.locator('[data-wep-coord-review]').innerText(),/\(0,4\)/);
 assert.equal(await panel.locator('[data-wep-coord-save-as]').isEnabled(),true);
 const afterHistory=await readRow();
 assert.equal(afterHistory.revision,1);
 assert.equal(afterHistory.primary,seed.primary);
 assert.equal(afterHistory.backup,seed.backup);
 assert.deepEqual(afterHistory.document.entries[0],seed.entry);
 console.log('QRW2407_REAL_CHROME_UNDO_NEW_BRANCH_REDO_DISCARDED_NO_IDB_MUTATION_PASS');

 // Changing title after a valid review must revoke that review. Restoring the
 // old value must not resurrect a stale in-memory permission to save.
 const title=panel.locator('[data-wep-coord-title]');
 const previous=await title.inputValue();
 await title.fill('QRW changed after review');
 assert.equal(await panel.locator('[data-wep-coord-review]').count(),0);
 assert.equal(await panel.locator('[data-wep-coord-save-as]').isEnabled(),false);
 await title.fill(previous);
 assert.equal(await panel.locator('[data-wep-coord-save-as]').isEnabled(),false);
 await preview.click();
 await panel.locator('[data-wep-coord-review]').waitFor();
 assert.equal(await panel.locator('[data-wep-coord-save-as]').isEnabled(),true);
 console.log('QRW2407_TITLE_EDIT_REVOKES_STALE_REVIEW_UNTIL_FRESH_PREVIEW_PASS');

 // Adversarial local tamper: change the source entry within the real IDB
 // with EXACT SAME revision (bypass app CAS as a corrupt/foreign local actor).
 // Save-as must re-read the actual source entry, detect changed artifact row
 // and refuse, even if sourceRevision stays equal and preview was green.
 const tampered=await page.evaluate(async()=>{
  const name='dreamwishwand:wep:scene-presets:local:v1';
  const req=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('snapshots','readwrite');
   const store=tx.objectStore('snapshots');
   const r=store.get('library');
   r.onsuccess=()=>{
    const row=r.result;
    const doc=JSON.parse(row.primary);
    doc.entries[0].title='External same-revision source rewrite';
    store.put({...row,primary:JSON.stringify(doc)},'library');
   };
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });db.close();
  const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  return reopenLocalScenes();
 });
 assert.equal(tampered.revision,1,'foreign tamper deliberately does NOT advance CAS');
 assert.notEqual(tampered.primary,seed.primary);
 assert.equal(tampered.backup,seed.backup);
 assert.equal(tampered.document.entries[0].title,'External same-revision source rewrite');
 await panel.locator('[data-wep-coord-save-as]').click();
 await panel.locator('[data-wep-coord-status][role=alert]').waitFor({timeout:10000});
 const after=await readRow();
 assert.equal(after.revision,1);
 assert.equal(after.primary,tampered.primary);
 assert.equal(after.backup,tampered.backup);
 assert.equal(after.document.entries.length,1,'no second Scene may be saved from invalid stale source');
 assert.deepEqual(after.document.entries[0].artifact,seed.entry.artifact,
  'the original captured local artifact is immutable');
 console.log('QRW2407_REAL_IDB_SAME_REVISION_SOURCE_TAMPER_FAIL_CLOSED_NO_SAVE_AS_PASS');

 assert.deepEqual(unsafe,[],'no mutating network/Cloud');
 assert.deepEqual(errors,[],'no browser JS errors');
 assert.equal(await page.locator('[data-editor-object-id]').count(),0,
  'no game Save EditorSession');
 console.log('QRW2407_REAL_BROWSER_LOCAL_COORD_BRANCH_REVIEW_CAS_BACKUP_OFF_PASS');
}finally{await context.close();await browser.close()}
