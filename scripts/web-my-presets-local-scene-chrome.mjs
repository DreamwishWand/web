import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {localScenePresetCopy} from '../src/lib/wep/local-scene-preset-copy.js';
const origin=process.env.WEB_LOCAL_SCENE_ORIGIN||'http://127.0.0.1:4349';
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'Real installed Chrome required');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const errors=[],unsafe=[];
context.on('request',req=>{
 if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))
  unsafe.push(req.method()+' '+req.url());
});
const attach=p=>p.on('pageerror',e=>errors.push(String(e)));
async function openMy(){
 const page=await context.newPage();attach(page);
 const response=await page.goto(origin+'/presets/',{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);
 await page.locator('[data-preset-child="my"]').click();
 await page.locator('[data-my-domain-view="wand"]').waitFor();
 await page.locator('[data-my-local-scenes]').waitFor();
 return page;
}
const haveDB=p=>p.evaluate(async()=>(
 (await indexedDB.databases()).some(db=>db.name==='dreamwishwand:wep:scene-presets:local:v1')));
const oldKeys=['dreamwishwand:moodboards:v1','dreamwishwand:moodboards:v1:backup'];
const oldData=['legacy-primary-preserve','legacy-backup-preserve'];
async function legacyState(p){return p.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),oldKeys);}
async function saveSynthetic(p,{title,expectedRevision,uuid,now}){
 return p.evaluate(async input=>{
  const {captureScenePreset}=await import('/src/lib/wep/scene-capture-runtime.ts');
  const {validatePublishablePreset}=await import('/src/lib/wep/scene-preset-runtime.ts');
  const {saveLocalScene}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const doc={target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'test-only'},
   objects:[{editorId:'object-a',itemId:40000048,layer:'furniture',x:3,y:4,
    orientation:0,footprint:[{x:0,y:0}],portableState:null,dependencyIds:[],
    editability:'editable'}]};
  const captured=captureScenePreset(doc,{selectionIds:['object-a'],includeRoads:false,
   includeFences:false,title:input.title},validatePublishablePreset);
  if(!captured.publicationReady)throw Error('SYNTHETIC_CAPTURE_INVALID');
  const receipt=await saveLocalScene({artifact:captured.artifact,title:input.title,
   expectedRevision:input.expectedRevision,idFactory:()=>input.uuid,now:input.now});
  return {id:receipt.id,revision:receipt.revision};
 },{title,expectedRevision,uuid,now});
}
const snapshot=p=>p.evaluate(async()=>{
 const m=await import('/src/lib/wep/local-scene-preset-store.mjs');
 const row=await m.reopenLocalScenes();
 return {revision:row.revision,primary:row.primary,backup:row.backup,backupRevision:row.backupRevision};
});
async function rawSnapshot(p){return p.evaluate(async()=>{
 const request=indexedDB.open('dreamwishwand:wep:scene-presets:local:v1',1);
 const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('snapshots','readonly');
  const r=tx.objectStore('snapshots').get('library');
  tx.oncomplete=()=>resolve(r.result);
  tx.onabort=()=>reject(tx.error);
 });}finally{db.close();}
});}
try{
 const p=await openMy();
 assert.equal(await haveDB(p),false,'Passive render must not open/create local Scene DB');
 assert.equal(await p.locator('[data-device-scenes-list]').count(),0);
 assert.equal(await p.locator('[data-device-scene-preview]').count(),0);
 assert.equal(await p.locator('[data-my-wand-view="created"]').count(),1);
 assert.equal(await p.locator('[data-my-local-scenes] [data-account-created="unverified"]').count(),0);
 await p.evaluate(([keys,values])=>keys.forEach((k,i)=>localStorage.setItem(k,values[i])),[oldKeys,oldData]);
 await p.locator('[data-device-scenes-reopen]').click();
 await p.locator('[data-device-scenes-status]').filter({hasText:localScenePresetCopy('en').empty}).waitFor();
 assert.equal(await haveDB(p),false,'Explicit readonly open of missing DB must not create');
 assert.equal(await p.locator('[data-device-scenes-list]').count(),0);
 assert.deepEqual(await legacyState(p),oldData);
 console.log('WEB_LOCAL_SCENE_NO_AUTO_DB_CREATE_NO_ACCOUNT_CLAIM_PASS');
 const first=await saveSynthetic(p,{title:'First verified Scene',expectedRevision:0,
  uuid:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now:'2026-11-09T10:00:00.000Z'});
 assert.equal(first.revision,1);
 const original=await snapshot(p);
 assert.equal(JSON.parse(original.primary).entries.length,1);
 assert.equal(JSON.parse(original.backup).entries.length,0);
 await p.locator('[data-device-scenes-reopen]').click();
 await p.locator('[data-device-scenes-list] [data-device-scene-select]').first().waitFor();
 assert.equal(await p.locator('[data-device-scene-select]').count(),1);
 assert.equal(await p.locator('[data-my-wand-view="created"]').count(),1);
 await p.locator('[data-my-view-button="saved"]').click();
 assert.equal(await p.locator('[data-my-wand-view="saved"]').count(),1);
 assert.equal(await p.locator('[data-device-scenes-list] [data-device-scene-select]').count(),1);
 await p.locator('[data-my-view-button="created"]').click();
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await p.locator('#site-locale').selectOption(loc);
  await p.waitForFunction(title=>document.querySelector('#my-device-scenes-title')?.textContent?.trim()===title,
   localScenePresetCopy(loc).title);
  assert.equal(await p.locator('[data-device-scenes-reopen]').innerText(),
   localScenePresetCopy(loc).reopen);
  assert.equal(await p.locator('[data-device-scene-select]').count(),1);
 }
 console.log('WEB_LOCAL_SCENE_EIGHT_LOCALES_CREATED_SAVED_DISTINCT_PASS');
 await p.locator('#site-locale').selectOption('en');
 const item=p.locator('[data-device-scene-select]').first();
 await item.focus();
 assert.equal(await item.evaluate(el=>el===document.activeElement),true);
 await p.keyboard.press('Enter');
 await p.locator('[data-device-scene-preview]').waitFor();
 assert.match(await p.locator('[data-device-scene-preview]').innerText(),/First verified Scene/);
 assert.match(await p.locator('[data-device-scene-preview] code').innerText(),/writeReady=false/);
 assert.equal(await p.locator('[data-device-scene-world-editor]').getAttribute('href'),'/editor/world/');
 assert.deepEqual(await snapshot(p),original,'Readonly list and preview must be byte-neutral');
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:860});
  await p.evaluate(z=>{document.documentElement.style.zoom=z;},zoom);
  const dimensions=await p.locator('[data-my-local-scenes]').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(dimensions.scroll<=dimensions.client+2,'Scene panel overflow '+width+'/'+zoom+': '+JSON.stringify(dimensions));
 }
 await p.evaluate(()=>{document.documentElement.style.zoom='1';});
 await p.setViewportSize({width:1280,height:900});
 console.log('WEB_LOCAL_SCENE_KEYBOARD_320_CSS200_READONLY_PREVIEW_PASS');
 // Keep the original selection tab at Revision 1 while an independent tab commits revision 2.
 const stale=await openMy();
 await stale.locator('[data-device-scenes-reopen]').click();
 await stale.locator('[data-device-scene-select]').first().waitFor();
 const second=await saveSynthetic(p,{title:'Second verified Scene',expectedRevision:1,
  uuid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now:'2026-11-09T10:01:00.000Z'});
 assert.equal(second.revision,2);
 const afterWrite=await snapshot(p);
 assert.equal(afterWrite.backup,original.primary,'exact previous primary must remain backup');
 await stale.locator('[data-device-scene-select]').first().click();
 await stale.locator('[data-device-scenes-status]').filter({hasText:localScenePresetCopy('en').blocked}).waitFor();
 assert.equal(await stale.locator('[data-device-scene-preview]').count(),0);
 assert.deepEqual(await snapshot(stale),afterWrite,'stale preview must not mutate either snapshot');
 await stale.locator('[data-device-scenes-reopen]').click();
 assert.equal(await stale.locator('[data-device-scene-select]').count(),2);
 await stale.locator('[data-device-scene-select]').nth(1).click();
 await stale.locator('[data-device-scene-preview]').waitFor();
 assert.match(await stale.locator('[data-device-scene-preview]').innerText(),/Second verified Scene/);
 assert.deepEqual(await snapshot(stale),afterWrite);
 assert.deepEqual(await legacyState(stale),oldData);
 console.log('WEB_LOCAL_SCENE_STALE_TWO_TAB_REVISION_REJECT_BACKUP_UNCHANGED_PASS');
 // A damaged row is never repaired by the UI. Only the synthetic test damages its own fixture.
 await stale.evaluate(async()=>{
  const request=indexedDB.open('dreamwishwand:wep:scene-presets:local:v1',1);
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{await new Promise((resolve,reject)=>{
   const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
   const get=store.get('library');
   get.onsuccess=()=>store.put({...get.result,primary:'{"bad":"primary"}'},'library');
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
 });
 const corrupted=await rawSnapshot(stale);
 await stale.locator('[data-device-scenes-reopen]').click();
 await stale.locator('[data-device-scenes-status]').filter({hasText:localScenePresetCopy('en').blocked}).waitFor();
 assert.equal(await stale.locator('[data-device-scene-preview]').count(),0);
 assert.deepEqual(await rawSnapshot(stale),corrupted);
 assert.deepEqual(await legacyState(stale),oldData);
 console.log('WEB_LOCAL_SCENE_CORRUPTED_SNAPSHOT_FAIL_CLOSED_NO_REPAIR_PASS');
 const href=p.locator('[data-device-scene-world-editor]');
 await href.focus();
 await p.keyboard.press('Enter');
 await p.waitForURL(origin+'/editor/world/',{timeout:35000});
 assert.equal(await p.locator('[data-wep-local-scene-preview]').count(),0,
  'Editor entry is navigation only; does not assume selected Scene authority');
 assert.deepEqual(unsafe,[],'No external POST or off-origin requests');
 assert.deepEqual(errors,[],'No browser script exceptions');
 console.log('WEB_LOCAL_SCENE_WORLD_EDITOR_LINK_NO_AUTO_APPLY_NO_EXTERNAL_POST_PASS');
 console.log('WEB_MY_PRESETS_LOCAL_SCENE_REAL_CHROME_FINAL_PASS');
}finally{await context.close();await browser.close();}
