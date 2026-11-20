// 04 QR-W independent changed-only L2 of WEP PR2398 fixed source.
 // Real ephemeral Chrome IndexedDB. ZERO game Save bytes, account, Provider, media ON.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const host='http://127.0.0.1:4363';
assert.ok(process.env.CHROME_BIN,'real installed Chrome required');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
const page=await context.newPage(),unsafe=[],errors=[];
context.on('request',r=>{
 const u=new URL(r.url());
 if(u.origin!==host||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+r.url());
});
page.on('pageerror',e=>errors.push(String(e)));
const dbName='dreamwishwand:wep:scene-presets:local:v1';
const entryUrl=host+'/editor/world/';
const pick=()=>page.evaluate(async()=>{
 const {reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
 return reopenLocalScenes();
});
const rename=(args)=>page.evaluate(async args=>{
 const {renameLocalSceneAlias}=await import('/src/lib/wep/local-scene-preset-store.mjs');
 return renameLocalSceneAlias(args);
},args);
try{
 const response=await page.goto(entryUrl,{waitUntil:'networkidle'});
 assert.equal(response.status(),200);
 const panel=page.locator('[data-wep-local-scene-alias]');
 await panel.waitFor();
 assert.equal(await panel.getAttribute('data-save-writer'),'off');
 assert.equal(await panel.getAttribute('data-native-apply'),'off');
 assert.equal(await panel.getAttribute('data-cloud'),'off');
 assert.equal((await page.evaluate(name=>indexedDB.databases().then(rows=>rows.some(x=>x.name===name)),dbName)),false,
  'World Editor load must not implicitly read/create IndexedDB');
 assert.equal(await panel.locator('[data-wep-alias-scene]').count(),0);
 assert.equal(await page.locator('input[type=file]').count(),0,'no Owner Save import');
 console.log('QRW2398_PASSIVE_WORLD_EDITOR_NO_DB_OR_SAVE_PASS');

 // Create a real local-only synthetic verified artifact through the accepted
 // save-free UI; no writer/Native Grid data is involved in this QA.
 const savefree=page.locator('[data-wep-savefree-first-scene]');
 await savefree.locator('[data-wep-savefree-load]').click();
 await savefree.locator('[data-wep-savefree-search]').waitFor({timeout:40000});
 await savefree.locator('[data-wep-savefree-search]').fill('40000047');
 const choice=savefree.locator('[data-wep-savefree-choose="40000047"]');
 await choice.waitFor({timeout:30000});await choice.click();
 await savefree.locator('[data-wep-savefree-title]').fill('QRW original local-only Scene');
 await savefree.locator('[data-wep-savefree-preview]').click();
 await savefree.locator('[data-wep-savefree-artifact]').waitFor();
 await savefree.locator('[data-wep-savefree-save]').click();
 await savefree.locator('[data-wep-savefree-saved]').waitFor({timeout:20000});
 const created=await pick();
 assert.equal(created.revision,1);
 assert.equal(created.document.entries.length,1);
 const original=created.document.entries[0];
 assert.equal(original.title,'QRW original local-only Scene');
 assert.equal(original.artifact.objects[0].itemId,40000047);
 assert.equal(original.artifact.networks.roads,null);
 assert.equal(original.artifact.networks.fences,null);
 const args=(oldTitle,newTitle,rev=1)=>({
  sceneId:original.id,expectedOldTitle:oldTitle,newTitle,expectedRevision:rev
 });
 console.log('QRW2398_REAL_LOCAL_IDB_VERIFIED_SYNTHETIC_SOURCE_CREATED_PASS');

 // Fresh stored CAS, then same-title ABA restoration. Even when current title
 // returns to original A, the old revision=1 must be permanently rejected.
 const edit=await rename(args(original.title,'QRW second name'));
 assert.equal(edit.revision,2);
 assert.equal(edit.backup,created.primary,'exact old primary becomes raw backup');
 const other=await pick();
 assert.equal(other.revision,2);
 assert.equal(other.document.entries[0].title,'QRW second name');
 assert.deepEqual(other.document.entries[0].artifact,original.artifact);
 const restore=await rename(args('QRW second name',original.title,2));
 assert.equal(restore.revision,3);
 assert.equal(restore.backup,other.primary);
 const restored=await pick();
 assert.equal(restored.document.entries[0].title,original.title);
 assert.deepEqual(restored.document.entries[0].artifact,original.artifact);
 await assert.rejects(rename(args(original.title,'QRW stale ABA must fail',1)),
  /WEP_LOCAL_SCENE_STALE_REVISION/);
 const afterABA=await pick();
 assert.deepEqual({r:afterABA.revision,p:afterABA.primary,b:afterABA.backup},
  {r:restored.revision,p:restored.primary,b:restored.backup});
 assert.equal(afterABA.document.entries[0].title,original.title);
 console.log('QRW2398_REAL_IDB_ABA_OLD_TITLE_MATCH_STALE_REVISION_DENIED_PASS');

 // Simulated disk/transaction put failure at the real browser API boundary:
 // the complete existing primary/backup/revision must remain unchanged.
 const blocked=await page.evaluate(async({sceneId,title,revision})=>{
  const {renameLocalSceneAlias,reopenLocalScenes}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const originalPut=IDBObjectStore.prototype.put;let invoked=0,err='';
  IDBObjectStore.prototype.put=function(...args){
   invoked++;
   throw Error('QRW_TEST_INJECTED_DISK_PUT_FAILURE');
  };
  try{await renameLocalSceneAlias({sceneId,newTitle:'QRW discarded mutation',
   expectedOldTitle:title,expectedRevision:revision});}
  catch(e){err=String(e)}
  finally{IDBObjectStore.prototype.put=originalPut}
  const row=await reopenLocalScenes();
  return {invoked,err,revision:row.revision,primary:row.primary,backup:row.backup};
 },{sceneId:original.id,title:original.title,revision:3});
 assert.ok(blocked.invoked>=1,'must actually reach the failing transaction write');
 assert.match(blocked.err,/QRW_TEST_INJECTED_DISK_PUT_FAILURE/);
 assert.equal(blocked.revision,3);
 assert.equal(blocked.primary,afterABA.primary);
 assert.equal(blocked.backup,afterABA.backup);
 console.log('QRW2398_REAL_IDB_PUT_FAILURE_ABORT_ATOMIC_NO_PARTIAL_BACKUP_PASS');

 // Corrupt ONLY backup in this disposable QA browser, then verify fail-closed
 // before any update. A mismatched backup is not permission to self-heal.
 const corrupted=await page.evaluate(async({dbName,sceneId,title,revision})=>{
  const request=indexedDB.open(dbName,1);
  const db=await new Promise((resolve,reject)=>{
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('snapshots','readwrite');
   const store=tx.objectStore('snapshots'),read=store.get('library');
   read.onsuccess=()=>{
    const next={...read.result,backup:'{"schema":"broken","entries":[]}'};
    store.put(next,'library');
   };
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });
  db.close();
  let before;
  {const req=indexedDB.open(dbName,1);
   const d=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   before=await new Promise((resolve,reject)=>{
    const tx=d.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').get('library');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
   });d.close();}
  let error='';
  try{
   const {renameLocalSceneAlias}=await import('/src/lib/wep/local-scene-preset-store.mjs');
   await renameLocalSceneAlias({sceneId,newTitle:'QRW should never self-heal',
    expectedOldTitle:title,expectedRevision:revision});
  }catch(e){error=String(e)}
  const req=indexedDB.open(dbName,1);
  const d=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  const after=await new Promise((resolve,reject)=>{
   const tx=d.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').get('library');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });d.close();
  return {error,before,after};
 },{dbName,sceneId:original.id,title:original.title,revision:3});
 assert.match(corrupted.error,/WEP_LOCAL_SCENE_DOCUMENT_INVALID|WEP_LOCAL_SCENE_ENTRY_INVALID/);
 assert.deepEqual(corrupted.after,corrupted.before,'repair/rewrite on corrupted backup denied');
 console.log('QRW2398_REAL_IDB_CORRUPT_BACKUP_FAIL_CLOSED_NO_AUTO_RECOVERY_PASS');

 assert.deepEqual(unsafe,[],'no Cloud/provider or mutating network');
 assert.deepEqual(errors,[],'no browser JS exception');
 assert.equal(await page.locator('[data-editor-object-id]').count(),0,'never activated game Save Editor');
 console.log('QRW2398_REAL_CHROME_DISTINCT_ABA_PUT_ABORT_CORRUPT_BACKUP_SAVE_OFF_PASS');
}finally{
 await context.close();
 await browser.close();
}
