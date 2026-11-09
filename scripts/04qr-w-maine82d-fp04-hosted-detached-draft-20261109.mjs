// 04 QR-W — NEW actual post-09 INT #869 distributed HTTPS detached Scene Draft E2E.
// This is not Source867/QA868 or old hosted crossroute QA866 repeated.
// Only synthetic scene data inside a disposable isolated Chrome context.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {LOCAL_SCENE_PRESET_LOCALES,localScenePresetCopy} from '../src/lib/wep/local-scene-preset-copy.js';
const MAIN='e82d55981c371979cfdad2262ede1949d50f5e9d';
const HOST='https://dreamwishwand.github.io';
const ROOT=HOST+'/web/';
const route=path=>HOST+'/web'+path;
assert.equal(process.env.QRW_FP04_MAIN,MAIN);
assert.equal(process.env.QRW_FP04_HOSTED_URL,ROOT);
assert.ok(process.env.CHROME_BIN,'REAL_INSTALLED_CHROME_REQUIRED');
assert.ok(process.env.QRW_GITHUB_TOKEN,'DEPLOYMENT_API_TOKEN_REQUIRED');
assert.ok(!process.env.DDV_PRIVATE_SAVE_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.P1G_PATH,
 'PRIVATE_SAVE_UNAUTHORIZED');
async function github(path){
 const r=await fetch('https://api.github.com'+path,{
  headers:{Authorization:'Bearer '+process.env.QRW_GITHUB_TOKEN,
   Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28'},
  redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,200,'GITHUB_API_VERIFICATION '+path);
 return r.json();
}
const pages=await github('/repos/DreamwishWand/web/pages');
assert.equal(pages.html_url.replace(/\/?$/,'/'),ROOT);
const deployments=await github('/repos/DreamwishWand/web/deployments?environment=github-pages&per_page=20');
const exact=deployments.filter(d=>d.sha===MAIN);
assert.ok(exact.length,'DISTRIBUTED_DEPLOYMENT_SHA_NOT_THE_FIXED_PROTECTED_MAIN');
for(const path of ['/','/editor/world/','/moodboards/']){
 const r=await fetch(route(path),{redirect:'manual',method:'GET',signal:AbortSignal.timeout(18000)});
 assert.equal(r.status,200,'DISTRIBUTED_PUBLIC_HTTPS_DIRECT_GET '+path);
 assert.equal(r.headers.get('location'),null,'NO_GUESSED_REDIRECT');
 assert.match(r.headers.get('content-type')??'',/text\/html/);
 if(r.body)await r.body.cancel();
}
console.log('QRW869_DEPLOYED_PAGES_MAIN_E82D_EXACT_SHA_AND_REAL_HTTPS_HTTP200_PASS',
 JSON.stringify({url:ROOT,deploymentIds:exact.map(d=>d.id)}));

const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:900},
 serviceWorkers:'block',acceptDownloads:false,ignoreHTTPSErrors:false});
const errors=[],unsafe=[];
context.on('request',r=>{
 const u=new URL(r.url());
 if(u.origin!==HOST||!['GET','HEAD'].includes(r.method()))
  unsafe.push(r.method()+' '+r.url());
});
function attach(p){p.on('pageerror',e=>errors.push(String(e)));}
const OLD_KEY='dreamwishwand:moodboards:v1',OLD_BACKUP='dreamwishwand:moodboards:v1:backup';
const dbName='dreamwishwand:wep:scene-presets:local:v1';
const timestamp='2026-11-09T00:00:00.000Z';
const oldPrimary=JSON.stringify({schema:'wand.moodboards.local@1',version:2,updatedAt:timestamp,
 boards:[{id:'only-qa-e82d-moodboard',title:'Existing user storage sentinel',
 description:null,createdAt:timestamp,updatedAt:timestamp,
 groups:[{id:'g',title:'Old Group',order:0,collapsed:false}],
 references:[{id:'r',type:'ITEM',label:'Stage1 Furniture',entityId:'40000048',
  groupIds:['g'],createdAt:timestamp,note:null,url:null}]}]});
const oldBackup='{"QA_Old_Moodboard_Backup":"must-not-change"}';
const synthetic={
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{platform:'synthetic',gameVersion:'1.25.0',areaKey:'qa-postint869-detached'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
 {editorId:'qa869-a',itemId:40000049,layer:'furniture',x:4,y:5,orientation:0,
  footprint:[{x:0,y:0},{x:1,y:0}],source:null,portableState:null,
  dependencyIds:[],editability:'editable',metadata:{displayName:'QA only A',worldClass:'FurnitureItemData'}},
 {editorId:'qa869-b',itemId:40000050,layer:'furniture',x:8,y:7,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,
  dependencyIds:[],editability:'editable',metadata:{displayName:'QA only B',worldClass:'FurnitureItemData'}}
 ]};
const oldState=p=>p.evaluate(([k,b])=>
 ({primary:localStorage.getItem(k),backup:localStorage.getItem(b)}),[OLD_KEY,OLD_BACKUP]);
const sceneRow=p=>p.evaluate(async name=>{
 const req=indexedDB.open(name,1);
 const db=await new Promise((resolve,reject)=>{
  req.onupgradeneeded=()=>{req.transaction.abort();reject(Error('QA_CANNOT_CREATE_SCENE_DB'));};
  req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
 });
 try{
  const tx=db.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').get('library');
  return await new Promise((resolve,reject)=>{
   tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error);
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close();}
},dbName);
const sceneDBs=p=>p.evaluate(async name=> (await indexedDB.databases())
 .filter(d=>d.name===name),dbName);
async function clickKeyboard(p,selector){
 const l=p.locator(selector);
 await l.focus();
 assert.equal(await l.evaluate(el=>el===document.activeElement),true,'Keyboard focus '+selector);
 await p.keyboard.press('Enter');
}
async function editorViaMoodboard(){
 const p=await context.newPage();attach(p);
 const r=await p.goto(route('/moodboards/'),{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(r.status(),200);
 await p.evaluate(([k,b,v,w])=>{
  if(localStorage.getItem(k)==null)localStorage.setItem(k,v);
  if(localStorage.getItem(b)==null)localStorage.setItem(b,w);
 },[OLD_KEY,OLD_BACKUP,oldPrimary,oldBackup]);
 await p.reload({waitUntil:'domcontentloaded',timeout:45000});
 await p.getByRole('button',{name:'Open in World Editor'}).click();
 await p.waitForURL(/\/web\/editor\/world\/?$/,{timeout:45000});
 await p.locator('[data-wep-decorate-stage1] .reference-main')
  .filter({hasText:'Stage1 Furniture'}).click();
 await p.locator('.load-panel input[type=file]').setInputFiles({
  name:'qrw869-synthetic-editor-only.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(synthetic))
 });
 await p.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:45000});
 return p;
}
async function importSynthetic(p){
 await p.locator('.load-panel input[type=file]').setInputFiles({
  name:'qrw869-manual-session-reentry.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(synthetic))});
 await p.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:45000});
}
async function captureSave(p,id,title){
 await p.locator('[data-editor-object-id="'+id+'"]').click();
 await p.locator('.capture-panel input').first().fill(title);
 await p.getByRole('button',{name:'Capture Preview'}).click();
 await p.locator('[data-wep-local-scene-save]:not([disabled])').waitFor({timeout:28000});
 await clickKeyboard(p,'[data-wep-local-scene-save]');
 await p.locator('[data-wep-local-scene-status]')
  .filter({hasText:'saved and independently reopened'}).waitFor({timeout:35000});
}
async function selectLocal(p,index=0){
 await clickKeyboard(p,'[data-wep-local-scene-reopen]');
 await p.locator('[data-wep-local-scene-read]').nth(index).waitFor({timeout:24000});
 await clickKeyboard(p,'[data-wep-local-scene-read]:nth-child(1)').catch(async()=>{
  await p.locator('[data-wep-local-scene-read]').nth(index).click();
 });
 await p.locator('[data-wep-local-scene-reuse]').waitFor({timeout:28000});
}
async function corruptPrimary(p,raw){
 await p.evaluate(async({name,raw})=>{
  const req=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   req.onupgradeneeded=()=>{req.transaction.abort();reject(Error('QA_SCENE_DB_MISSING'));};
   req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
  });
  try{
   const tx=db.transaction('snapshots','readwrite');
   const obj=tx.objectStore('snapshots'),get=obj.get('library');
   get.onsuccess=()=>obj.put({...get.result,primary:raw},'library');
   await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
    tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },{name:dbName,raw});
}
try{
 const p=await editorViaMoodboard();
 assert.deepEqual(await sceneDBs(p),[],'No precreated Scene DB');
 assert.equal(await p.locator('[data-wep-local-scene-draft]').count(),0,
  'No detached Draft automatically created');
 await captureSave(p,'qa869-a','Hosted detached A');
 const first=await sceneRow(p);
 assert.equal(first.revision,1);
 assert.equal(first.backupRevision,0);
 assert.equal(JSON.parse(first.primary).entries.length,1);
 assert.deepEqual(await oldState(p),{primary:oldPrimary,backup:oldBackup});
 console.log('QRW869_ACTUAL_HTTPS_EXPLICIT_SCENE_SAVE_REV1_BACKUP_AND_NO_AUTODRAFT_PASS');
 const selectionBefore=await p.locator('[data-editor-object-id]').evaluateAll(els=>
  els.map(el=>({id:el.getAttribute('data-editor-object-id'),
   className:el.getAttribute('class'),transform:el.getAttribute('transform')})));
 await p.locator('[data-wep-local-scene-read]').first().click();
 await p.locator('[data-wep-local-scene-reuse]').waitFor({timeout:24000});
 assert.equal(await p.locator('[data-wep-local-scene-draft]').count(),0,
  'Preview selection cannot silently prepare Detached Draft');
 await clickKeyboard(p,'[data-wep-local-scene-reuse]');
 const panel=p.locator('[data-wep-local-scene-draft]');
 await panel.waitFor({timeout:26000});
 assert.equal(await panel.getAttribute('data-apply'),'off');
 assert.equal(await panel.getAttribute('data-editor-mutation'),'off');
 assert.match(await panel.innerText(),/writeReady=false \/ applyReady=false/);
 assert.match(await panel.innerText(),/40000049/);
 // Footprint multi-cell must contribute local visualization bounds (2x1).
 assert.match(await panel.innerText(),/1 objects \/ 2 × 1/);
 assert.match(await panel.innerText(),/\(0, 0\)/);
 assert.deepEqual(await sceneRow(p),first,'Detachment must preserve stored Primary+Backup exactly');
 assert.deepEqual(await oldState(p),{primary:oldPrimary,backup:oldBackup});
 assert.deepEqual(await p.locator('[data-editor-object-id]').evaluateAll(els=>
  els.map(el=>({id:el.getAttribute('data-editor-object-id'),
   className:el.getAttribute('class'),transform:el.getAttribute('transform')}))),selectionBefore,
  'Detached Draft must not alter EditorSession selection or geometry');
 console.log('QRW869_DEPLOYED_DETACHED_DRAFT_LOCAL_BOUNDS_FOOTPRINT_EDITOR_UNMUTATED_PASS');

 for(const lang of LOCAL_SCENE_PRESET_LOCALES){
  await p.evaluate(lang=>{
   const el=document.querySelector('#site-locale');
   if(!el)throw Error('QA_LOCALE_SELECTOR_MISSING');
   el.value=lang;el.dispatchEvent(new Event('change',{bubbles:true}));
  },lang);
  await p.waitForFunction(expected=>
   document.querySelector('[data-wep-local-scene-reuse]')?.textContent?.trim()===expected,
   localScenePresetCopy(lang).reuse,{timeout:16000});
  assert.equal((await panel.getAttribute('aria-label'))?.trim(),localScenePresetCopy(lang).reuseReady);
 }
 await p.evaluate(()=>{
  const el=document.querySelector('#site-locale');
  el.value='en';el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await p.waitForFunction(()=>document.querySelector('[data-wep-local-scene-reuse]')?.textContent?.trim()===
  'Prepare detached read-only draft');
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:900});
  await p.evaluate(zoom=>document.documentElement.style.zoom=zoom,zoom);
  const sz=await p.locator('[data-wep-local-scene]').evaluate(el=>({
   client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(sz.scroll<=sz.client+2,'Hosted new Draft UI overflow '+JSON.stringify({width,zoom,sz}));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 console.log('QRW869_DEPLOYED_EIGHT_LOCALES_320_ZOOM200_KEYBOARD_PASS');

 // New-hosted interaction negative: stale selected Scene must be revalidated on
 // fresh readonly click after an explicit update in a separate Editor tab.
 const stale=await context.newPage();attach(stale);
 await stale.goto(route('/editor/world/'),{waitUntil:'domcontentloaded',timeout:45000});
 await importSynthetic(stale);
 await stale.locator('[data-wep-local-scene-reopen]').click();
 await stale.locator('[data-wep-local-scene-read]').first().waitFor({timeout:24000});
 await stale.locator('[data-wep-local-scene-read]').first().click();
 await stale.locator('[data-wep-local-scene-reuse]').waitFor({timeout:24000});
 await captureSave(p,'qa869-b','Hosted detached B');
 const second=await sceneRow(p);
 assert.equal(second.revision,2);
 assert.equal(second.backupRevision,1);
 assert.equal(second.backup,first.primary,'Backup exact previous Primary bytes');
 assert.equal(JSON.parse(second.primary).entries.length,2);
 await clickKeyboard(stale,'[data-wep-local-scene-reuse]');
 await stale.locator('[data-wep-local-scene-reuse-status]')
  .filter({hasText:localScenePresetCopy('en').reuseBlocked}).waitFor({timeout:22000});
 assert.equal(await stale.locator('[data-wep-local-scene-draft]').count(),0);
 assert.deepEqual(await sceneRow(stale),second,'Stale selected scene cannot mutate CAS');
 await stale.locator('[data-wep-local-scene-reopen]').click();
 await stale.locator('[data-wep-local-scene-read]').nth(1).waitFor({timeout:24000});
 await stale.locator('[data-wep-local-scene-read]').nth(1).click();
 await stale.locator('[data-wep-local-scene-reuse]').waitFor({timeout:24000});
 await clickKeyboard(stale,'[data-wep-local-scene-reuse]');
 await stale.locator('[data-wep-local-scene-draft]').waitFor({timeout:22000});
 assert.deepEqual(await sceneRow(stale),second);
 console.log('QRW869_HOSTED_STALE_SOURCE_REVISION_BLOCKS_DRAFT_FRESH_REOPEN_PRESERVES_BACKUP_PASS');

 // Mutate only the QA-created browser row. These are hostile portable scenes;
 // no additional Source tests are rerun. Current deployed UI must fail closed.
 for(const [name,change] of [
  ['fake Native GridID',a=>{a.entries[0].artifact.objects[0].gridId='FORGED_NATIVE_ID';}],
  ['Footprint exceeds Bounds',a=>{a.entries[0].artifact.objects[0].footprint=[{x:9999,y:0}];}],
  ['Road topology unknown',a=>{a.entries[0].artifact.requirements.roadTopology=true;}],
  ['Fence topology unknown',a=>{a.entries[0].artifact.requirements.fenceTopology=true;}],
  ['Unverified SubGrid',a=>{a.entries[0].artifact.objects[0].portableState={codec:'unknown-native-subgrid'};}]
 ]){
  const mutated=JSON.parse(second.primary);change(mutated);
  await corruptPrimary(p,JSON.stringify(mutated));
  const broken=await sceneRow(p);
  await p.locator('[data-wep-local-scene-reopen]').click();
  await p.locator('[data-wep-local-scene-status]')
   .filter({hasText:localScenePresetCopy('en').blocked}).waitFor({timeout:22000});
  assert.equal(await p.locator('[data-wep-local-scene-draft]').count(),0,
   'Corrupted '+name+' cannot show detached Draft');
  assert.deepEqual(await sceneRow(p),broken,'No auto repair or writer on '+name);
  await corruptPrimary(p,second.primary); // QA synthetic isolated fixture restore.
  assert.deepEqual(await sceneRow(p),second,'QA restored exact primary after '+name);
 }
 assert.deepEqual(await oldState(p),{primary:oldPrimary,backup:oldBackup});
 console.log('QRW869_HOSTED_FORGED_NATIVE_FOOTPRINT_ROAD_FENCE_SUBGRID_FAIL_CLOSED_PASS');

 await p.reload({waitUntil:'domcontentloaded',timeout:45000});
 assert.deepEqual(await sceneRow(p),second,'Actual hosted page reload must preserve Scene row');
 // Accepted EditorSession is ephemeral. Manually reimport on this new session.
 await importSynthetic(p);
 await p.locator('[data-wep-local-scene-reopen]').click();
 await p.locator('[data-wep-local-scene-read]').nth(1).waitFor({timeout:25000});
 await p.locator('[data-wep-local-scene-read]').nth(1).click();
 await p.locator('[data-wep-local-scene-reuse]').waitFor({timeout:22000});
 await clickKeyboard(p,'[data-wep-local-scene-reuse]');
 const newDraft=p.locator('[data-wep-local-scene-draft]');
 await newDraft.waitFor({timeout:22000});
 assert.equal(await newDraft.getAttribute('data-editor-mutation'),'off');
 assert.match(await newDraft.innerText(),/writeReady=false \/ applyReady=false/);
 assert.deepEqual(await sceneRow(p),second);
 assert.deepEqual(await oldState(p),{primary:oldPrimary,backup:oldBackup});
 assert.deepEqual(unsafe,[],'No off-origin GET, POST, Cloud or Native writer network activity');
 assert.deepEqual(errors,[],'No actual deployed Chrome unhandled exception');
 console.log('QRW869_DEPLOYED_HARD_RELOAD_EXPLICIT_SOURCE_REENTRY_DETACHED_READONLY_NO_STORAGE_MUTATION_PASS');
 console.log('QRW869_INDEPENDENT_ACTUAL_DISTRIBUTED_DETACHED_READONLY_E2E_SCOPED_PASS',
  JSON.stringify({fixedMain:MAIN,url:ROOT,syntheticOnly:true,oldAncestorsRerun:false,
   nativeApply:false,writer:false,qaOnly:true}));
}finally{await context.close();await browser.close();}
