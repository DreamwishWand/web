import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {localSceneRouteCopy} from '../src/lib/wep/local-scene-route-handoff.mjs';
const origin=(process.env.WEB_SCENE_SENDER_ORIGIN||'http://127.0.0.1:4355').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'Installed Google Chrome is required');
const KEY='dreamwishwand:wep:scene-preset:selected-route:v1';
const SCHEMA='wand.wep.local-scene-route-intent@1';
const DB='dreamwishwand:wep:scene-presets:local:v1';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const errors=[],unsafe=[];
ctx.on('request',r=>{if((r.url().startsWith('http')&&!r.url().startsWith(origin))||
 !['GET','HEAD'].includes(r.method())) unsafe.push(r.method()+' '+r.url());});
const attach=p=>p.on('pageerror',e=>errors.push(String(e)));
const hint=p=>p.evaluate(key=>sessionStorage.getItem(key),KEY);
const hasDb=p=>p.evaluate(async name=>(await indexedDB.databases()).some(x=>x.name===name),DB);
async function openMy(p) {
 const response=await p.goto(origin+'/presets/',{waitUntil:'networkidle',timeout:30000});
 assert.equal(response.status(),200);
 await p.locator('[data-stage1-presets-four-cards]').waitFor();
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:15000});
 await p.locator('[data-preset-child="my"]').click();
 await p.locator('[data-my-local-scenes]').waitFor();
}
async function saveSynthetic(p,{title,rev,uuid,now}){
 return p.evaluate(async input=>{
  const {captureScenePreset}=await import('/src/lib/wep/scene-capture-runtime.ts');
  const {validatePublishablePreset}=await import('/src/lib/wep/scene-preset-runtime.ts');
  const {saveLocalScene}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const editor={target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'test-only'},
   objects:[{editorId:'object-a',itemId:40000048,layer:'furniture',
    x:3,y:4,orientation:0,footprint:[{x:0,y:0}],portableState:null,
    dependencyIds:[],editability:'editable'}]};
  const captured=captureScenePreset(editor,{selectionIds:['object-a'],includeRoads:false,
   includeFences:false,title:input.title},validatePublishablePreset);
  if(!captured.publicationReady)throw Error('SYNTHETIC_SCENE_CAPTURE_INVALID');
  const receipt=await saveLocalScene({artifact:captured.artifact,title:input.title,
   expectedRevision:input.rev,idFactory:()=>input.uuid,now:input.now});
  return {id:receipt.id,revision:receipt.revision};
 },{title,rev,uuid,now});
}
async function row(p){
 return p.evaluate(async()=>{
  const request=indexedDB.open('dreamwishwand:wep:scene-presets:local:v1',1);
  const db=await new Promise((res,rej)=>{
    request.onsuccess=()=>res(request.result);
    request.onerror=()=>rej(request.error);
  });
  try{return await new Promise((res,rej)=>{
    const tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get('library');
    tx.oncomplete=()=>res(q.result);
    tx.onabort=()=>rej(tx.error);
  });}finally{db.close();}
 });
}
async function corruptPrimary(p){
 return p.evaluate(async()=>{
  const request=indexedDB.open('dreamwishwand:wep:scene-presets:local:v1',1);
  const db=await new Promise((res,rej)=>{
    request.onsuccess=()=>res(request.result);
    request.onerror=()=>rej(request.error);
  });
  try{await new Promise((res,rej)=>{
    const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
    const q=store.get('library');
    q.onsuccess=()=>store.put({...q.result,primary:'{"corrupt":"row"}'},'library');
    tx.oncomplete=res;tx.onabort=()=>rej(tx.error);
  });}finally{db.close();}
 });
}
const oldKeys=['dreamwishwand:moodboards:v1','dreamwishwand:moodboards:v1:backup'];
const oldValues=['preserve-legacy-primary','preserve-legacy-backup'];
const legacy=p=>p.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),oldKeys);
try{
 const p=await ctx.newPage();attach(p);
 await openMy(p);
 assert.equal(await hasDb(p),false,'passive navigation never creates Scene IDB');
 assert.equal(await p.locator('[data-device-scene-world-editor-selected]').count(),0);
 assert.equal(await hint(p),null,'no passive sender');
 await p.locator('[data-device-scenes-reopen]').click();
 await p.locator('[data-device-scenes-status]').waitFor();
 assert.equal(await hasDb(p),false,'explicit read of missing Scene DB aborts upgrade');
 assert.equal(await hint(p),null);
 console.log('WEB_SELECTED_SENDER_PASSIVE_ABSENT_DB_NO_HINT_NO_CREATE_PASS');
 await p.evaluate(({keys,values})=>keys.forEach((key,i)=>localStorage.setItem(key,values[i])),
   {keys:oldKeys,values:oldValues});
 const first=await saveSynthetic(p,{title:'Explicit portable Scene',rev:0,
  uuid:'11111111-1111-4111-8111-111111111111',now:'2026-11-09T10:00:00.000Z'});
 assert.equal(first.revision,1);
 const original=await row(p);
 const otherTab=await ctx.newPage();attach(otherTab);
 await otherTab.goto(origin+'/presets/',{waitUntil:'networkidle'});
 assert.equal(await hint(otherTab),null,'new independent tab has no hint');
 await p.locator('[data-device-scenes-reopen]').click();
 await p.locator('[data-device-scene-select]').first().waitFor();
 await p.locator('[data-device-scene-select]').first().focus();
 await p.keyboard.press('Enter');
 await p.locator('[data-device-scene-world-editor-selected]').waitFor();
 assert.equal(await hint(p),null,'selection for preview is not sender');
 assert.equal(await p.locator('[data-my-wand-view="created"]').count(),1);
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await p.locator('#site-locale').selectOption(loc);
  await p.waitForFunction(({l,action})=>
   document.documentElement.dataset.locale===l&&
   document.querySelector('[data-device-scene-world-editor-selected]')?.textContent?.trim()===action,
   {l:loc,action:localSceneRouteCopy(loc).action},{timeout:15000});
  assert.equal(await p.locator('[data-my-verified="false"]').count(),1);
  assert.equal(await p.locator('[data-account-created="unverified"]').count(),1);
  assert.equal(await p.locator('[data-account-saved="unverified"]').count(),1);
 }
 await p.locator('#site-locale').selectOption('en');
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:860});
  await p.evaluate(z=>{document.documentElement.style.zoom=z;},zoom);
  const area=await p.locator('[data-my-local-scenes]').evaluate(x=>({
   client:x.clientWidth,scroll:x.scrollWidth
  }));
  assert.ok(area.scroll<=area.client+2,'selected Scene overflow '+JSON.stringify({width,zoom,area}));
 }
 await p.evaluate(()=>{document.documentElement.style.zoom='1';});
 await p.setViewportSize({width:1280,height:900});
 console.log('WEB_SELECTED_SENDER_EIGHT_LOCALES_320_CSS200_ACCOUNT_SEPARATION_PASS');
 await p.locator('[data-device-scene-world-editor-selected]').focus();
 assert.equal(await p.locator('[data-device-scene-world-editor-selected]').evaluate(e=>e===document.activeElement),true);
 await p.keyboard.press('Enter');
 await p.waitForURL(origin+'/editor/world/',{timeout:30000});
 const value=JSON.parse(await hint(p));
 assert.deepEqual(Object.keys(value),['schema','sceneId','expectedRevision','issuedAt']);
 assert.deepEqual({schema:value.schema,sceneId:value.sceneId,expectedRevision:value.expectedRevision},
  {schema:SCHEMA,sceneId:first.id,expectedRevision:1});
 assert.ok(Date.now()-value.issuedAt<=3*60*1000&&Date.now()>=value.issuedAt,'3min finite TTL');
 assert.equal(new URL(p.url()).search,'');
 assert.equal(new URL(p.url()).hash,'');
 assert.equal(await hint(otherTab),null,'hint must remain same-tab only');
 await p.locator('[data-wep-selected-scene-route-confirm]').waitFor();
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0,'receiver needs second user confirmation');
 assert.deepEqual(await row(p),original,'sender and passive receiver do not alter Scene or Backup');
 await p.locator('[data-wep-selected-scene-route-confirm]').focus();
 await p.keyboard.press('Enter');
 await p.locator('[data-wep-selected-scene-route-draft]').waitFor();
 assert.match(await p.locator('[data-wep-selected-scene-route-draft]').innerText(),/writeReady=false \/ applyReady=false/);
 assert.equal(await hint(p),null,'receiver consumes hint once');
 assert.equal(await p.locator('[data-editor-object-id]').count(),0,'no EditorSession mutation');
 assert.deepEqual(await row(p),original,'read-only receiver may not edit IDB');
 assert.deepEqual(await legacy(p),oldValues,'legacy Moodboard originals unchanged');
 console.log('WEB_SELECTED_SENDER_SAME_TAB_ID_REV_TTL_EXPLICIT_RECEIVER_NO_AUTO_APPLY_PASS');
 // The previewing page is stale after another real CAS library update.
 const stale=await ctx.newPage();attach(stale);
 await openMy(stale);
 await stale.locator('[data-device-scenes-reopen]').click();
 await stale.locator('[data-device-scene-select]').first().waitFor();
 await stale.locator('[data-device-scene-select]').first().click();
 await stale.locator('[data-device-scene-world-editor-selected]').waitFor();
 const second=await saveSynthetic(otherTab,{title:'New other-tab Scene',rev:1,
  uuid:'22222222-2222-4222-8222-222222222222',now:'2026-11-09T10:01:00.000Z'});
 assert.equal(second.revision,2);
 const after=await row(otherTab);
 assert.equal(after.backup,original.primary);
 await stale.locator('[data-device-scene-world-editor-selected]').click();
 await stale.locator('[data-device-scenes-status]').filter({hasText:localSceneRouteCopy('en').blocked}).waitFor();
 assert.equal(new URL(stale.url()).pathname,'/presets/');
 assert.equal(await hint(stale),null,'stale sender must not stage');
 assert.deepEqual(await row(stale),after);
 console.log('WEB_SELECTED_SENDER_TWO_TAB_STALE_REVISION_BLOCK_NO_HINT_NO_MUTATION_PASS');
 // A corrupted synthetic scene row must be rejected, without repair.
 await stale.locator('[data-device-scenes-reopen]').click();
 await stale.locator('[data-device-scene-select]').nth(1).waitFor();
 await stale.locator('[data-device-scene-select]').first().click();
 await stale.locator('[data-device-scene-world-editor-selected]').waitFor();
 await corruptPrimary(otherTab);
 const corrupt=await row(otherTab);
 await stale.locator('[data-device-scene-world-editor-selected]').click();
 await stale.locator('[data-device-scenes-status]').filter({hasText:localSceneRouteCopy('en').blocked}).waitFor();
 assert.equal(new URL(stale.url()).pathname,'/presets/');
 assert.equal(await hint(stale),null);
 assert.deepEqual(await row(stale),corrupt,'failed read must not silently repair Scene snapshot');
 console.log('WEB_SELECTED_SENDER_CORRUPT_ROW_NO_HINT_NO_REPAIR_PASS');
 assert.deepEqual(unsafe,[],'no external HTTP or mutation POST');
 assert.deepEqual(errors,[],'no JS runtime errors');
 console.log('WEB_MYLOCAL_SELECTED_SCENE_SENDER_INSTALLED_CHROME_FINAL_PASS');
}finally{await ctx.close();await browser.close();}
