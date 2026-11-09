// 04 QR-W 2026-11-10 public Pages 8d6e *NEW end-to-end operation*.
// Actual HTTPS: synthetic EditorDocument -> user Capture/Save Scene CAS ->
// My Presets user Scene selection + explicit sender -> same-tab Editor ->
// separate receiver confirmation -> Detached readonly Draft.
// NEVER reruns accepted Source875/QAW876, Source871/QAW872 or previous
// hosted receiver-only QA874. No real Save, provider, Cloud or Writer.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {localSceneRouteCopy} from '../src/lib/wep/local-scene-route-handoff.mjs';

const MAIN='8d6e35adbdedc3b44e1a9a498d65da7af9c3273f';
const HOST='https://dreamwishwand.github.io';
const ROOT=HOST+'/web/';
const u=(path)=>HOST+'/web'+path;
const KEY='dreamwishwand:wep:scene-preset:selected-route:v1';
const SCHEMA='wand.wep.local-scene-route-intent@1';
const DB='dreamwishwand:wep:scene-presets:local:v1';
const TTL=3*60*1000;
const OLDP='dreamwishwand:moodboards:v1',OLDB='dreamwishwand:moodboards:v1:backup';
const OLD_PRIMARY='{"qa_8d6e_old_moodboard_primary":"byte-unchanged"}';
const OLD_BACKUP='{"qa_8d6e_old_moodboard_backup":"byte-unchanged"}';
assert.equal(process.env.QRW8D_MAIN,MAIN);
assert.equal(process.env.QRW8D_HOSTED_URL,ROOT);
assert.ok(process.env.CHROME_BIN,'ACTUAL_CHROME_REQUIRED');
assert.ok(process.env.QRW_GITHUB_TOKEN,'GITHUB_PAGES_DEPLOYMENT_TOKEN_REQUIRED');
assert.ok(!process.env.DDV_PRIVATE_SAVE_PATH &&
 !process.env.WEP_PRIVATE_P1G_PATH && !process.env.P1G_PATH,
 'NEVER_USE_PRIVATE_SAVE');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-status',MAIN,'HEAD').split('\n').filter(Boolean).sort(),
 [
 'A\t.github/workflows/04qr-w-main8d6e-public-full-selected-scene-e2e-20261110.yml',
 'A\tscripts/04qr-w-main8d6e-public-full-selected-scene-e2e-20261110.mjs'
 ]);
console.log('QRW877_FIXED_MAIN_8D6E_QA_ONLY2_NO_PRODUCT_SOURCE_REQA_PASS');

async function github(path) {
 const r=await fetch('https://api.github.com'+path,{
  headers:{Authorization:'Bearer '+process.env.QRW_GITHUB_TOKEN,
   Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
  redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,200,'GITHUB_DEPLOYMENT_VERIFICATION '+path);
 return r.json();
}
const pages=await github('/repos/DreamwishWand/web/pages');
assert.equal(pages.html_url.replace(/\/?$/,'/'),ROOT);
const deploys=await github('/repos/DreamwishWand/web/deployments?environment=github-pages&per_page=25');
const exact=deploys.filter(d=>d.sha===MAIN);
assert.ok(exact.length,'NO_DISTRIBUTED_PAGES_DEPLOYMENT_MATCHING_MAIN');
for(const path of ['/','/editor/world/','/presets/']){
 const r=await fetch(u(path),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,200,'REAL_DISTRIBUTED_HTTPS_200_REQUIRED '+path);
 assert.equal(r.headers.get('location'),null,'NO_GUESSED_REDIRECT '+path);
 assert.match(r.headers.get('content-type')??'',/text\/html/);
 await r.body?.cancel();
}
console.log('QRW877_EXACT_8D6E_DEPLOYMENT_AND_PUBLIC_HTTPS_ROUTES_200_PASS',
 JSON.stringify({deploymentIds:exact.map(d=>d.id),url:ROOT}));

const synthetic={
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'qa8d6e-local-only'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
  {editorId:'qa8d-object-a',itemId:40000049,layer:'furniture',
   x:4,y:5,orientation:0,footprint:[{x:0,y:0},{x:1,y:0}],
   source:null,portableState:null,dependencyIds:[],editability:'editable',
   metadata:{displayName:'Synthetic QA Furniture A',worldClass:'FurnitureItemData'}},
  {editorId:'qa8d-object-b',itemId:40000050,layer:'furniture',
   x:8,y:7,orientation:0,footprint:[{x:0,y:0}],
   source:null,portableState:null,dependencyIds:[],editability:'editable',
   metadata:{displayName:'Synthetic QA Furniture B',worldClass:'FurnitureItemData'}}
 ]
};
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:900},
 serviceWorkers:'block',acceptDownloads:false,ignoreHTTPSErrors:false});
const errors=[],outside=[];
ctx.on('request',r=>{
 const url=new URL(r.url());
 if(url.origin!==HOST||!['GET','HEAD'].includes(r.method()))
  outside.push(r.method()+' '+r.url());
});
const attach=p=>p.on('pageerror',e=>errors.push(String(e)));
const getHint=p=>p.evaluate(k=>sessionStorage.getItem(k),KEY);
const oldRaw=p=>p.evaluate(([k,b])=>
 [localStorage.getItem(k),localStorage.getItem(b)],[OLDP,OLDB]);
const dbs=p=>p.evaluate(async()=> (await indexedDB.databases()).map(d=>d.name).sort());
async function getScene(p){
 return p.evaluate(async name=>{
  const request=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   request.onupgradeneeded=()=>{request.transaction.abort();reject(Error('QA_READ_MUST_NOT_CREATE_DB'));};
   request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);
  });
  try{
   const tx=db.transaction('snapshots','readonly');
   const v=tx.objectStore('snapshots').get('library');
   return await new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve(v.result);tx.onabort=()=>reject(tx.error);
    tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },DB);
}
async function putSynthetic(p,record){
 // Only modify rows in the deliberately disposable Chrome context, never Owner data.
 await p.evaluate(async({name,record})=>{
  const req=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   req.onupgradeneeded=()=>{req.transaction.abort();reject(Error('NO_QA_DB_AUTO_CREATE'));};
   req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
  });
  try{
   const tx=db.transaction('snapshots','readwrite');
   tx.objectStore('snapshots').put(record,'library');
   await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },{name:DB,record});
}
async function goto(p,path,waitUntil='domcontentloaded'){
 const r=await p.goto(u(path),{waitUntil,timeout:45000});
 assert.equal(r.status(),200,'ACTUAL_HOSTED_ROUTE '+path);
}
async function openMy(p){
 await goto(p,'/presets/','networkidle');
 await p.locator('[data-stage1-presets-four-cards]').waitFor({timeout:20000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:20000});
 await p.locator('[data-preset-child="my"]').click();
 await p.locator('[data-my-local-scenes]').waitFor({timeout:20000});
}
async function enterButton(p,selector){
 const b=p.locator(selector);
 await b.waitFor({timeout:20000});
 await b.focus();
 assert.equal(await b.evaluate(x=>x===document.activeElement),true,
  'Keyboard focus needed '+selector);
 await p.keyboard.press('Enter');
}
async function loadSyntheticEditor(p){
 // Public Pages SSR markup can precede interactive hydration: wait for the
 // real page's JS and locale state before uploading an EditorDocument.
 await p.waitForLoadState('networkidle',{timeout:35000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:25000});
 await p.locator('.load-panel input[type=file]').setInputFiles({
  name:'qaw8d6e-synthetic-authoring-only.json',
  mimeType:'application/json',buffer:Buffer.from(JSON.stringify(synthetic))
 });
 await p.getByText('Synthetic draft authoring',{exact:true})
  .waitFor({timeout:30000});
}
async function captureSave(p,id,title){
 const object=p.locator('[data-editor-object-id="'+id+'"]');
 await object.waitFor({timeout:25000});
 await object.click();
 await p.locator('.capture-panel input').first().fill(title);
 await p.getByRole('button',{name:'Capture Preview'}).click();
 await p.locator('[data-wep-local-scene-save]:not([disabled])').waitFor({timeout:26000});
 await enterButton(p,'[data-wep-local-scene-save]');
 await p.locator('[data-wep-local-scene-status]')
  .filter({hasText:'saved and independently reopened'})
  .waitFor({timeout:30000});
}
async function selectMy(p,index=0){
 await enterButton(p,'[data-device-scenes-reopen]');
 const b=p.locator('[data-device-scene-select]').nth(index);
 await b.waitFor({timeout:23000});await b.focus();await p.keyboard.press('Enter');
 await p.locator('[data-device-scene-world-editor-selected]').waitFor({timeout:23000});
}
async function send(p){
 await enterButton(p,'[data-device-scene-world-editor-selected]');
}
async function rejectedSender(p){
 await p.locator('[data-device-scenes-status]')
  .filter({hasText:localSceneRouteCopy('en').blocked})
  .waitFor({timeout:22000});
 assert.equal(await getHint(p),null,'sender may not stage invalid Scene');
 assert.equal(new URL(p.url()).pathname,'/web/presets/');
}
async function rejectedReceiver(p){
 await p.locator('[data-wep-selected-scene-route-status]')
  .filter({hasText:localSceneRouteCopy('en').blocked})
  .waitFor({timeout:22000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.equal(await getHint(p),null,'bad one shot hint consumed');
}
async function assertOriginal(p,scene){
 assert.deepEqual(await getScene(p),scene,'Scene primary/backup and CAS must remain exact');
 assert.deepEqual(await oldRaw(p),[OLD_PRIMARY,OLD_BACKUP],
  'existing legacy Moodboard and Backup raw byte exact');
}
try{
 const p=await ctx.newPage();attach(p);
 await openMy(p);
 assert.equal((await dbs(p)).includes(DB),false,'first MyLocal visit cannot auto-create Scene DB');
 assert.equal(await getHint(p),null,'passive MyLocal must not stage');
 assert.equal(await p.locator('[data-device-scene-world-editor-selected]').count(),0);
 await enterButton(p,'[data-device-scenes-reopen]');
 await p.locator('[data-device-scenes-status]').waitFor({timeout:18000});
 assert.equal((await dbs(p)).includes(DB),false,'read of nonexistent library cannot auto-create');
 assert.equal(await getHint(p),null);
 await p.evaluate(([k,b,x,y])=>{
  localStorage.setItem(k,x);localStorage.setItem(b,y);
 },[OLDP,OLDB,OLD_PRIMARY,OLD_BACKUP]);
 console.log('QRW877_HOSTED_MYLOCAL_ABSENT_DB_PASSIVE_AND_EXPLICIT_NO_CREATE_PASS');

 // Genuine UI workflow: manual upload EditorDocument, select synthetic object,
 // click Capture Preview and Scene Save. No test injected save IDB fixture.
 await goto(p,'/editor/world/');
 await loadSyntheticEditor(p);
 await captureSave(p,'qa8d-object-a','Host E2E Scene Alpha');
 const initial=await getScene(p);
 assert.equal(initial.revision,1);
 assert.equal(initial.backupRevision,0);
 const entries1=JSON.parse(initial.primary).entries;
 assert.equal(entries1.length,1);
 assert.equal(entries1[0].artifact.objects.length,1);
 assert.equal(entries1[0].artifact.objects[0].footprint.length,2);
 const selectedId=entries1[0].id;
 const savedDBs=await dbs(p);
 assert.deepEqual(await oldRaw(p),[OLD_PRIMARY,OLD_BACKUP]);
 console.log('QRW877_DEPLOYED_REAL_EDITOR_UI_CAPTURE_SAVE_CAS_REV1_BACKUP0_PASS',
  JSON.stringify({sceneId:selectedId,revision:initial.revision,backup:initial.backupRevision}));

 // Separate tab has no pending hint, even though Scene IDB is shared same-origin.
 const other=await ctx.newPage();attach(other);
 await goto(other,'/editor/world/');
 assert.equal(await getHint(other),null);
 await openMy(p);
 await selectMy(p);
 assert.equal(await getHint(p),null,'selection preview does not send anything');
 const selected=p.locator('[data-device-scene-preview]');
 assert.match(await selected.innerText(),/Host E2E Scene Alpha/);
 assert.equal(await p.locator('[data-my-wand-view="created"]').count(),1);
 const local=p.locator('[data-my-local-scenes]');
 for(const k of ['data-account-created','data-account-saved'])
  assert.equal(await local.getAttribute(k),'unverified','no assumed account Creator ownership');
 assert.equal(await local.getAttribute('data-auto-cloud'),'off');
 assert.equal(await local.getAttribute('data-local-scene-writer'),'off');
 assert.equal(await p.locator('[data-device-scene-world-editor]').count(),1,
  'old generic Editor link preserved');
 console.log('QRW877_HOSTED_SELECTED_MYLOCAL_PREVIEW_ONLY_UNVERIFIED_ACCOUNT_NO_AUTO_SEND_PASS');

 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await p.locator('#site-locale').selectOption(lang);
  await p.waitForFunction(({lang,action})=>
   document.documentElement.dataset.locale===lang &&
   document.querySelector('[data-device-scene-world-editor-selected]')
    ?.textContent?.trim()===action,
   {lang,action:localSceneRouteCopy(lang).action},{timeout:16000});
  assert.equal(await local.getAttribute('data-account-created'),'unverified');
  assert.equal(await local.getAttribute('data-account-saved'),'unverified');
 }
 await p.locator('#site-locale').selectOption('en');
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:900});
  await p.evaluate(v=>document.documentElement.style.zoom=v,zoom);
  const x=await local.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(x.scroll<=x.client+2,'Sender UI inner overflow '+width+' CSSzoom'+zoom+' '+JSON.stringify(x));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 await assertOriginal(p,initial);
 console.log('QRW877_HOSTED_NEW_SENDER_8_LOCALE_320_CSS200_KEYBOARD_PASS');

 // Actual new user sender -> *same tab* public Editor page.
 await send(p);
 await p.waitForURL(u('/editor/world/'),{timeout:35000});
 const raw=await getHint(p);
 assert.ok(raw&&raw.length<=256,'bounded hint required');
 const hint=JSON.parse(raw);
 assert.deepEqual(Object.keys(hint),['schema','sceneId','expectedRevision','issuedAt']);
 assert.equal(hint.schema,SCHEMA);
 assert.equal(hint.sceneId,selectedId);
 assert.equal(hint.expectedRevision,1);
 assert.ok(Number.isSafeInteger(hint.issuedAt)&&
  Date.now()>=hint.issuedAt&&Date.now()-hint.issuedAt<=TTL,
  'issuedAt must be current short-lived hint');
 assert.equal(new URL(p.url()).search,'');
 assert.equal(new URL(p.url()).hash,'');
 assert.equal(await getHint(other),null,'No transfer to separate tab');
 await p.locator('[data-wep-selected-scene-route-confirm]').waitFor({timeout:23000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0,
  'automatic receiver Draft forbidden');
 await assertOriginal(p,initial);
 console.log('QRW877_HOSTED_EXPLICIT_SENDER_FOUR_FIELD_TTL_SAMETAB_URL_CLEAN_PASS');

 // Load a distinct synthetic EditorSession before confirming receiver.
 // Detached Draft must not mutate its objects or selection.
 await loadSyntheticEditor(p);
 const before=await p.locator('[data-editor-object-id]').evaluateAll(els=>
  els.map(el=>({id:el.getAttribute('data-editor-object-id'),
   cls:el.getAttribute('class'),transform:el.getAttribute('transform')})));
 assert.equal(before.length,2);
 await enterButton(p,'[data-wep-selected-scene-route-confirm]');
 const draft=p.locator('[data-wep-selected-scene-route-draft]');
 await draft.waitFor({timeout:25000});
 assert.equal(await draft.getAttribute('data-apply'),'off');
 assert.equal(await draft.getAttribute('data-editor-mutation'),'off');
 const txt=await draft.innerText();
 assert.match(txt,/writeReady=false \/ applyReady=false/);
 assert.match(txt,/40000049/);
 assert.match(txt,/1 objects \/.*2 × 1/);
 assert.match(txt,/\(0, 0\)/);
 assert.deepEqual(await p.locator('[data-editor-object-id]').evaluateAll(els=>
  els.map(el=>({id:el.getAttribute('data-editor-object-id'),
   cls:el.getAttribute('class'),transform:el.getAttribute('transform')}))),before,
  'native EditorSession and selected geometry must not change');
 assert.equal(await getHint(p),null,'receiver consumes one-shot');
 await assertOriginal(p,initial);
 await p.reload({waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(await p.locator('[data-wep-selected-scene-route]').count(),0,
  'page reload cannot replay consumed route intent');
 await assertOriginal(p,initial);
 console.log('QRW877_HOSTED_COMPLETE_SEND_RECEIVE_SEPARATE_CONFIRM_DETACHED_DRAFT_REPLAY_DENY_PASS');

 // New Scene created via *actual hosted Editor UI* in independent tab, Rev2.
 // This must invalidate the first tab's previously selected Rev1 Scene.
 await openMy(p);
 await selectMy(p);
 assert.equal(await getHint(p),null);
 // The second tab was opened before Rev1 existed. User must explicitly
 // Reopen the current library to acquire CAS Revision1 before saving Rev2.
 // Otherwise the Core correctly rejects a stale Revision0 write.
 await loadSyntheticEditor(other);
 await other.locator('[data-editor-object-id="qa8d-object-b"]').click();
 await other.locator('.capture-panel input').first().fill('Host E2E Scene Beta');
 await other.getByRole('button',{name:'Capture Preview'}).click();
 await enterButton(other,'[data-wep-local-scene-reopen]');
 await other.locator('[data-wep-local-scene-entries] [data-wep-local-scene-read]')
  .first().waitFor({timeout:24000});
 await enterButton(other,'[data-wep-local-scene-save]');
 await other.locator('[data-wep-local-scene-status]').filter({hasText:'saved and independently reopened'}).waitFor({timeout:30000});
 const newRow=await getScene(other);
 assert.equal(newRow.revision,2);
 assert.equal(newRow.backupRevision,1);
 assert.equal(newRow.backup,initial.primary,'backup must be exact Rev1 Primary byte string');
 assert.equal(JSON.parse(newRow.primary).entries.length,2);
 await send(p);
 await rejectedSender(p);
 await assertOriginal(p,newRow);
 console.log('QRW877_HOSTED_REAL_SECOND_TAB_EDITOR_SAVE_REV2_STALE_SENDER_BLOCK_BACKUP_PRESERVED_PASS');

 // BAD recipient stage: expired / forged Scene ID and extra Writer flag must
 // not authorize a Draft in the same tab, after a fresh user sender action.
 await selectMy(p,1);
 await send(p);
 await p.waitForURL(u('/editor/world/'),{timeout:30000});
 await p.locator('[data-wep-selected-scene-route-confirm]').waitFor({timeout:22000});
 const current=JSON.parse(await getHint(p));
 const expired={...current,issuedAt:Date.now()-TTL-500};
 await p.evaluate(({k,v})=>sessionStorage.setItem(k,JSON.stringify(v)),{k:KEY,v:expired});
 await enterButton(p,'[data-wep-selected-scene-route-confirm]');
 await rejectedReceiver(p);
 await assertOriginal(p,newRow);
 console.log('QRW877_HOSTED_SENDER_TO_RECEIVER_EXPIRED_INTENT_NO_DRAFT_PASS');

 // Newly staged valid selection, then tamper Scene ID as Native pointer.
 await openMy(p);await selectMy(p,1);await send(p);
 await p.waitForURL(u('/editor/world/'),{timeout:30000});
 await p.locator('[data-wep-selected-scene-route-confirm]').waitFor();
 const actual=JSON.parse(await getHint(p));
 await p.evaluate(({key,v})=>sessionStorage.setItem(key,JSON.stringify(v)),
  {key:KEY,v:{...actual,sceneId:'native:grid:42'}});
 await enterButton(p,'[data-wep-selected-scene-route-confirm]');
 await rejectedReceiver(p);
 await assertOriginal(p,newRow);
 console.log('QRW877_HOSTED_FORGED_NATIVE_ID_TOCTOU_CANNOT_AUTHORIZE_DRAFT_PASS');

 // Hostile portable data intentionally injected only into disposable local
 // QA browser. On the next real user send click, the *new sender* must
 // reject each unsupported stored Scene without self-heal or hint emission.
 for(const [kind,change] of [
  ['FOOTPRINT',doc=>{doc.entries[1].artifact.objects[0].footprint=[{x:9000,y:0}];}],
  ['ROAD',doc=>{doc.entries[1].artifact.requirements.roadTopology=true;}],
  ['FENCE',doc=>{doc.entries[1].artifact.requirements.fenceTopology=true;}],
  ['SUBGRID',doc=>{doc.entries[1].artifact.objects[0].portableState={codec:'unknown.subgrid'};}],
  ['NATIVE_GRID',doc=>{doc.entries[1].artifact.objects[0].sourceGridObjectId='g42:o7';}]
 ]){
  await openMy(p);await selectMy(p,1);
  const hostile=JSON.parse(newRow.primary);change(hostile);
  const damaged={...newRow,primary:JSON.stringify(hostile)};
  await putSynthetic(other,damaged);
  await send(p);
  await rejectedSender(p);
  assert.deepEqual(await getScene(p),damaged,'Rejected Scene must not self repair '+kind);
  assert.deepEqual(await oldRaw(p),[OLD_PRIMARY,OLD_BACKUP]);
  await putSynthetic(other,newRow);
  await assertOriginal(p,newRow);
  console.log('QRW877_HOSTED_COMBINED_INVALID_'+kind+'_NO_SEND_NO_AUTO_REPAIR_PASS');
 }
 assert.deepEqual(await dbs(p),savedDBs,'No double Reader or second Scene namespace');
 assert.deepEqual(outside,[],'no external GET, POST, Native writer, Cloud or Provider');
 assert.deepEqual(errors,[],'no actual browser JS page errors');
 console.log('QRW877_HOSTED_FULL_SEND_RECEIVE_NO_DATA_CORRUPTION_NO_EXTERNAL_NETWORK_PASS');
 console.log('QRW877_ACTUAL_DISTRIBUTED_SENDER_TO_RECEIVER_SYNTHETIC_E2E_SCOPED_PASS',
  JSON.stringify({fixedMain:MAIN,url:ROOT,syntheticOnly:true,
   oldSourceOrAncestorReQA:false,writeReady:false,applyReady:false,
   nativeV3:false,cloud:false,community:false,qaOnly:true}));
}finally{await ctx.close();await browser.close();}
