// 04 QR-W: new public Pages post-PR873 RECEIVER-only hosted E2E.
// Fixed deployed protected main 475b676; accepted PR871/QA872 and prior hosted
// QA870 are reused, not rerun. No 08 WEB sender exists: test stages a bounded
// four-key hint in a disposable same-tab browser only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {WEP_LOCAL_SCENE_ROUTE_LOCALES,localSceneRouteCopy}
 from '../src/lib/wep/local-scene-route-handoff.mjs';

const MAIN='475b6768031e34d91baed456446af91f376839db';
const HOST='https://dreamwishwand.github.io';
const ROOT=HOST+'/web/';
const url=path=>HOST+'/web'+path;
const KEY='dreamwishwand:wep:scene-preset:selected-route:v1';
const SCHEMA='wand.wep.local-scene-route-intent@1';
const TTL=180000;
const ID='scene_11111111-1111-4111-8111-111111111111';
const DB='dreamwishwand:wep:scene-presets:local:v1';
const OLDP='dreamwishwand:moodboards:v1';
const OLDB='dreamwishwand:moodboards:v1:backup';
const legacyPrimary='{"qa-host475b":"original-moodboard-immutable"}';
const legacyBackup='{"qa-host475b":"original-backup-immutable"}';
assert.equal(process.env.QRW475_MAIN,MAIN);
assert.equal(process.env.QRW475_URL,ROOT);
assert.ok(process.env.CHROME_BIN,'REAL_CHROME_REQUIRED');
assert.ok(process.env.QRW_GITHUB_TOKEN,'PAGES_DEPLOYMENT_TOKEN_REQUIRED');
assert.ok(!process.env.DDV_PRIVATE_SAVE_PATH&&!process.env.WEP_PRIVATE_P1G_PATH
 &&!process.env.P1G_PATH,'NO_PRIVATE_REAL_SAVE');

const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN,'QA branch from pinned main');
assert.deepEqual(git('diff','--name-status',MAIN,'HEAD').split('\n').filter(Boolean).sort(),
 [
 'A\t.github/workflows/04qr-w-main475b-deployed-selected-receiver-20261110.yml',
 'A\tscripts/04qr-w-main475b-deployed-selected-receiver-20261110.mjs'
 ]);
console.log('QRW873_FIXED_MAIN475B_QA_ONLY_2_ADD_NO_PRODUCT_SOURCE_REQA_PASS');

async function github(path){
 const r=await fetch('https://api.github.com'+path,{
  headers:{Authorization:'Bearer '+process.env.QRW_GITHUB_TOKEN,
   Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28'},
  redirect:'manual',signal:AbortSignal.timeout(22000)});
 assert.equal(r.status,200,'GITHUB_API_PAGES '+path);
 return r.json();
}
const pages=await github('/repos/DreamwishWand/web/pages');
assert.equal(pages.html_url.replace(/\/?$/,'/'),ROOT);
const deployments=await github('/repos/DreamwishWand/web/deployments?environment=github-pages&per_page=25');
const exact=deployments.filter(d=>d.sha===MAIN);
assert.ok(exact.length>0,'NO_EXACT_MAIN_GITHUB_PAGES_DEPLOYMENT');
for(const path of ['/','/presets/','/editor/world/']){
 const r=await fetch(url(path),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(18000)});
 assert.equal(r.status,200,'REAL_HTTPS_ROUTE_NOT_200 '+path);
 assert.equal(r.headers.get('location'),null,'DO_NOT_INFER_REDIRECT '+path);
 assert.match(r.headers.get('content-type')??'',/text\/html/);
 await r.body?.cancel();
}
console.log('QRW873_REAL_PUBLIC_PAGES_MAIN475B_EXACT_DEPLOYMENT_HTTP200_PASS',
 JSON.stringify({url:ROOT,ids:exact.map(d=>d.id)}));

const ts='2026-11-10T00:05:00.000Z';
const artifact={
 schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',
 title:'Hosted one-shot selected Scene QA only',
 source:{gameVersion:null,platform:null,areaKey:null},
 bounds:{w:2,h:1},originPolicy:'capture-region-top-left',
 objects:[{artifactObjectId:'o0',itemId:40000049,layer:'furniture',
  localX:0,localY:0,orientation:0,footprint:[{x:0,y:0},{x:1,y:0}],
  portableState:null,dependencyIds:[]}],
 networks:{roads:null,fences:null},
 requirements:{itemQuantities:{'40000049':1},roadTopology:false,fenceTopology:false},
 normalization:{sourceGridIdsRemoved:true,sourceGridObjectIdsRemoved:true,
  dependencyClosureIncluded:true}};
const empty={schema:'wand.wep.scene-library@1',version:1,entries:[]};
const document={...empty,entries:[{id:ID,title:'Synthetic selected Scene',createdAt:ts,artifact}]};
const primary=JSON.stringify(document);
const row1={schema:'wand.wep.scene-library-snapshot@1',
 revision:1,backupRevision:0,primary,backup:JSON.stringify(empty)};
const row2={...row1,revision:2,backupRevision:1,backup:primary};
const syntheticEditor={
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'qa475b-no-edit'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[{editorId:'qa475b-editor-object-only',itemId:40000049,
  layer:'furniture',x:3,y:5,orientation:0,footprint:[{x:0,y:0}],
  source:null,portableState:null,dependencyIds:[],editability:'editable',
  metadata:{displayName:'QA fixture object',worldClass:'FurnitureItemData'}}]
};

const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:900},
 serviceWorkers:'block',acceptDownloads:false,ignoreHTTPSErrors:false});
const errors=[],unsafe=[];
ctx.on('request',req=>{
 const u=new URL(req.url());
 if(u.origin!==HOST||!['GET','HEAD'].includes(req.method()))
  unsafe.push(req.method()+' '+req.url());
});
const attach=p=>p.on('pageerror',e=>errors.push(String(e)));
const localRaw=async p=>p.evaluate(([a,b])=>[localStorage.getItem(a),localStorage.getItem(b)],[OLDP,OLDB]);
const dbNames=async p=>p.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name).sort());
async function getRow(p){
 return p.evaluate(async name=>{
  const r=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   r.onupgradeneeded=()=>{r.transaction.abort();reject(Error('QA_DID_NOT_AUTHORIZE_DB_CREATE'));};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  try{
   const tx=db.transaction('snapshots','readonly'),get=tx.objectStore('snapshots').get('library');
   return await new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve(get.result);
    tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },DB);
}
async function putRow(p,record,create=false){
 await p.evaluate(async({name,record,create})=>{
  const r=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   r.onupgradeneeded=()=>{
    if(!create){r.transaction.abort();reject(Error('QA_UNEXPECTED_NEW_DB'));}
    else r.result.createObjectStore('snapshots');
   };
   r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);
  });
  try{
   const tx=db.transaction('snapshots','readwrite');
   tx.objectStore('snapshots').put(record,'library');
   await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },{name:DB,record,create});
}
const stage=async(p,{id=ID,revision=1,time=Date.now(),extra={}}={})=>
 p.evaluate(({key,schema,id,revision,time,extra})=>
  sessionStorage.setItem(key,JSON.stringify({
   schema,sceneId:id,expectedRevision:revision,issuedAt:time,...extra
  })),{key:KEY,schema:SCHEMA,id,revision,time,extra});
async function goto(p,path){
 const r=await p.goto(url(path),{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(r.status(),200,'PUBLIC_PAGES_NAVIGATION '+path);
}
async function stageOnPresetsAndOpenEditor(p,options={}){
 await goto(p,'/presets/');
 await stage(p,options);
 assert.equal(new URL(p.url()).searchParams.has('sceneId'),false);
 await goto(p,'/editor/world/');
}
async function enter(p){
 const action=p.locator('[data-wep-selected-scene-route-confirm]');
 await action.waitFor({timeout:22000});
 await action.focus();
 assert.equal(await action.evaluate(el=>el===document.activeElement),true);
 await p.keyboard.press('Enter');
}
async function blocked(p){
 await p.locator('[data-wep-selected-scene-route-status]')
  .filter({hasText:localSceneRouteCopy('en').blocked}).waitFor({timeout:22000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),KEY),null,'one-shot consumed');
}
async function assertNoChanges(p,row){
 assert.deepEqual(await getRow(p),row,'Scene Primary/Backup unchanged');
 assert.deepEqual(await localRaw(p),[legacyPrimary,legacyBackup],'legacy primary/backup unchanged');
}
try{
 const p=await ctx.newPage();attach(p);
 await goto(p,'/presets/');
 await p.evaluate(([a,b,x,y])=>{localStorage.setItem(a,x);localStorage.setItem(b,y);},
  [OLDP,OLDB,legacyPrimary,legacyBackup]);
 assert.equal((await dbNames(p)).includes(DB),false);
 await stage(p);
 await goto(p,'/editor/world/');
 const panel=p.locator('[data-wep-selected-scene-route]');
 await panel.waitFor({timeout:24000});
 assert.equal(await panel.getAttribute('data-save-writer'),'off');
 assert.equal(await panel.getAttribute('data-native-apply'),'off');
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 assert.equal((await dbNames(p)).includes(DB),false,'Passive receiver cannot open/create Scene DB');
 await enter(p);await blocked(p);
 assert.equal((await dbNames(p)).includes(DB),false,'Explicit missing DB cannot create Scene DB');
 assert.deepEqual(await localRaw(p),[legacyPrimary,legacyBackup]);
 console.log('QRW873_DEPLOYED_PASSIVE_HINT_NO_DB_NO_DRAFT_EXPLICIT_MISSING_DB_DENY_PASS');

 await putRow(p,row1,true); // QA-only browser data, not Owner's Scene
 const expectedDBs=await dbNames(p);
 await stageOnPresetsAndOpenEditor(p);
 await panel.waitFor({timeout:22000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.deepEqual(await getRow(p),row1,'hint does not read/repair Scene on page load');
 await enter(p);
 const draft=p.locator('[data-wep-selected-scene-route-draft]');
 await draft.waitFor({timeout:22000});
 assert.equal(await draft.getAttribute('data-apply'),'off');
 assert.equal(await draft.getAttribute('data-editor-mutation'),'off');
 const txt=await draft.innerText();
 assert.match(txt,/writeReady=false \/ applyReady=false/);
 assert.match(txt,/1 objects \/.*2 × 1/);
 assert.match(txt,/40000049/);
 assert.match(txt,/\(0, 0\)/);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 await assertNoChanges(p,row1);
 assert.deepEqual(await dbNames(p),expectedDBs,'No forked IndexedDB');
 assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),KEY),null,'same tab hint consumed');
 await p.reload({waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(await panel.count(),0,'page reload must not replay consumed hint');
 await assertNoChanges(p,row1);
 console.log('QRW873_DEPLOYED_ACTUAL_RECEIVER_EXPLICIT_KEYBOARD_VALID_LOCAL_DRAFT_ONE_SHOT_PASS');

 // Fresh real deployed receiver, translate all 8 displayed strings and 320/200%:
 await stageOnPresetsAndOpenEditor(p);
 await panel.waitFor({timeout:22000});
 assert.equal(WEP_LOCAL_SCENE_ROUTE_LOCALES.length,8);
 for(const loc of WEP_LOCAL_SCENE_ROUTE_LOCALES){
  await p.evaluate(loc=>{
   const select=document.querySelector('#site-locale');
   if(!select)throw Error('DEPLOYED_SITE_LOCALE_MISSING');
   select.value=loc;select.dispatchEvent(new Event('change',{bubbles:true}));
  },loc);
  const copy=localSceneRouteCopy(loc);
  await p.waitForFunction(expected=>
   document.querySelector('[data-wep-selected-scene-route-confirm]')
    ?.textContent?.trim()===expected,copy.action,{timeout:18000});
  assert.equal(await panel.getAttribute('aria-label'),copy.title);
 }
 await p.evaluate(()=>{
  const select=document.querySelector('#site-locale');
  select.value='en';select.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await p.waitForFunction(()=>document.querySelector('[data-wep-selected-scene-route-confirm]')
  ?.textContent?.trim()==='Reopen selected Scene as read-only draft');
 for(const [w,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width:w,height:900});
  await p.evaluate(z=>document.documentElement.style.zoom=z,zoom);
  const size=await panel.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(size.scroll<=size.client+2,'Deployed new receiver overflow '+w+'/'+zoom+' '+JSON.stringify(size));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 await assertNoChanges(p,row1);
 console.log('QRW873_DEPLOYED_NEW_RECEIVER_8_LOCALES_320_ZOOM200_PASS');

 // Different tab cannot inherit selection from independent no-opener context.
 const another=await ctx.newPage();attach(another);
 await goto(another,'/editor/world/');
 assert.equal(await another.locator('[data-wep-selected-scene-route]').count(),0);
 assert.equal(await another.evaluate(k=>sessionStorage.getItem(k),KEY),null);
 await putRow(another,row2);
 await enter(p);await blocked(p);
 await assertNoChanges(p,row2);
 assert.equal(row2.backup,row1.primary,'old revision exact byte backup preserved');
 console.log('QRW873_DEPLOYED_OTHER_TAB_NO_HINT_AND_STALE_REVISION_DENY_PASS');

 // On a fresh rev2 valid hint, alter the displayed hint prior to click.
 await stageOnPresetsAndOpenEditor(p,{revision:2});
 await panel.waitFor({timeout:23000});
 await p.evaluate(key=>{
  const hint=JSON.parse(sessionStorage.getItem(key));
  hint.expectedRevision=3;
  sessionStorage.setItem(key,JSON.stringify(hint));
 },KEY);
 await enter(p);await blocked(p);
 await assertNoChanges(p,row2);
 console.log('QRW873_DEPLOYED_HINT_TOCTOU_AND_REPLAY_FAIL_CLOSED_PASS');

 // Expired, fake ID and forged 'writer permission' hints never display:
 for(const opt of [
  {revision:2,time:Date.now()-TTL-1000},
  {id:'native:grid:42',revision:2},
  {revision:2,extra:{writeReady:true}}
 ]){
  await stageOnPresetsAndOpenEditor(p,opt);
  assert.equal(await panel.count(),0,'malformed or expired hint may not show receiver');
  assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
  await assertNoChanges(p,row2);
 }
 console.log('QRW873_DEPLOYED_EXPIRED_FAKE_NATIVE_WRITER_HINT_DENY_NO_MUTATION_PASS');

 // The same adopted Scene must be freshly verified upon user's separate click.
 // Changes below are written to disposable QA row ONLY; browser auto-heal forbidden.
 for(const [kind,mutate] of [
  ['nativeGrid',a=>{a.entries[0].artifact.objects[0].sourceGridObjectId='FAKE_NATIVE_GRID42';}],
  ['footprint',a=>{a.entries[0].artifact.objects[0].footprint=[{x:999,y:0}];}],
  ['road',a=>{a.entries[0].artifact.requirements.roadTopology=true;}],
  ['fence',a=>{a.entries[0].artifact.requirements.fenceTopology=true;}],
  ['subgrid',a=>{a.entries[0].artifact.objects[0].portableState={codec:'unverified.subgrid'};}]
 ]){
  const invalid=structuredClone(document);
  mutate(invalid);
  const damaged={...row2,primary:JSON.stringify(invalid)};
  await putRow(p,damaged);
  await stageOnPresetsAndOpenEditor(p,{revision:2});
  await panel.waitFor({timeout:22000});
  await enter(p);await blocked(p);
  await assertNoChanges(p,damaged);
  await putRow(p,row2); // test-only restore, no user data
  await assertNoChanges(p,row2);
  console.log('QRW873_DEPLOYED_INVALID_'+kind.toUpperCase()+'_DENY_NO_AUTOREPAIR_PASS');
 }
 assert.deepEqual(await dbNames(p),expectedDBs,'No new or parallel Scene storage');
 console.log('QRW873_DEPLOYED_FORGED_GRID_FOOTPRINT_ROAD_FENCE_SUBGRID_DENIED_PASS');

 // Verify even with separately loaded synthetic EditorDocument, the chosen hint
 // is not authority to mutate existing EditorSession, geometry or selection.
 await stageOnPresetsAndOpenEditor(p,{revision:2});
 await panel.waitFor({timeout:22000});
 await p.locator('.load-panel input[type=file]').setInputFiles({
  name:'qrw475b-editor-synthetic-only.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(syntheticEditor))
 });
 await p.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:32000});
 const beforeObjects=await p.locator('[data-editor-object-id]').evaluateAll(els=>
  els.map(el=>({id:el.getAttribute('data-editor-object-id'),
   cls:el.getAttribute('class'),transform:el.getAttribute('transform')})));
 await enter(p);
 await p.locator('[data-wep-selected-scene-route-draft]').waitFor({timeout:22000});
 const afterObjects=await p.locator('[data-editor-object-id]').evaluateAll(els=>
  els.map(el=>({id:el.getAttribute('data-editor-object-id'),
   cls:el.getAttribute('class'),transform:el.getAttribute('transform')})));
 assert.deepEqual(afterObjects,beforeObjects,'existing EditorSession selection/layout not changed');
 await assertNoChanges(p,row2);
 assert.deepEqual(await dbNames(p),expectedDBs,'No extraneous Scene DB writes');
 assert.deepEqual(unsafe,[],'No external GET, Cloud, POST or provider request');
 assert.deepEqual(errors,[],'No unhandled deployed browser JS errors');
 console.log('QRW873_DEPLOYED_SYNTHETIC_EDITOR_SESSION_UNCHANGED_READONLY_ONLY_PASS');
 console.log('QRW873_INDEPENDENT_ACTUAL_HOSTED_ONE_SHOT_RECEIVER_E2E_SCOPED_PASS',
  JSON.stringify({main:MAIN,url:ROOT,syntheticOnly:true,
   senderSourceUnimplemented:true,writer:false,nativeApply:false,qaOnly:true}));
}finally{await ctx.close();await browser.close();}
