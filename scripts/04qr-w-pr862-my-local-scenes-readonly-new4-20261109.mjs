// 04 QR-W: independent Source PR862 changed-only My Local Scene UI QA.
// Accepted PR859/QA860 single Scene Reader/Executor used as fixture, not retested.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {LOCAL_SCENE_PRESET_LOCALES,localScenePresetCopy}
 from '../src/lib/wep/local-scene-preset-copy.js';
const MAIN='574f30d554939bf674ad90a16f45b86e775118a1';
const SOURCE='bfc03c57b38920621916f0ce9b84da91138ed579';
const fixed=new Map([
 ['.github/workflows/web-my-presets-local-scene-consumer.yml','02815397de2694a4f56cff23dd8b3b617d329afe'],
 ['scripts/web-my-presets-local-scene-chrome.mjs','af17d6a035798b44ee0bff433b76d79c00dd998c'],
 ['src/routes/presets/+page.svelte','b4dc4e8deb4a28401e4ce4984ebf7e3d926e36d6'],
 ['tests/web-my-presets-local-scene-consumer.test.mjs','9ead2d3ab49964ee6453f7382bac660ca20fba45']
]);
const audit=[
 '.github/workflows/04qr-w-pr862-my-local-scenes-readonly-new4-20261109.yml',
 'scripts/04qr-w-pr862-my-local-scenes-readonly-new4-20261109.mjs'
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN,'Source base main');
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE,'QA is Source descendant');
assert.deepEqual(diff(MAIN,SOURCE),[...fixed.keys()].sort(),'Original Source 1MOD+3ADD');
assert.deepEqual(diff(SOURCE,'HEAD'),audit.sort(),'QA-only two files');
assert.equal(git('diff','--name-status',MAIN,SOURCE,'--','src/routes/presets/+page.svelte').split('\t')[0],'M');
for(const [path,blob] of fixed){
 assert.equal(git('rev-parse',SOURCE+':'+path),blob,'immutable Source blob '+path);
 assert.equal(git('hash-object',path),blob,'No Source edits '+path);
}
assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/lib/wep','src/lib/presets',
 'src/routes/editor','src/lib/community','src/routes/moodboards','src/routes/collection',
 'crates','supabase','static','.github/workflows/pages.yml'),'');
const route=readFileSync('src/routes/presets/+page.svelte','utf8');
assert.match(route,/data-my-local-scenes/);
assert.match(route,/data-account-created="unverified"/);
assert.match(route,/data-account-saved="unverified"/);
assert.match(route,/data-device-scene-authority="local-only"/);
assert.match(route,/data-local-scene-writer="off"/);
assert.match(route,/data-auto-cloud="off"/);
assert.match(route,/const current=await reopenLocalScenes\(\)/);
assert.match(route,/const current=await readLocalSceneById\(id\)/);
assert.match(route,/current\.revision!==deviceScenesRevision/);
assert.match(route,/current\.entry\.createdAt!==expected\.createdAt/);
assert.match(route,/readiness\.writeReady!==false/);
assert.doesNotMatch(route,/localStorage\.(?:setItem|removeItem)|indexedDB\.open|saveLocalScene\(/);
assert.equal(LOCAL_SCENE_PRESET_LOCALES.length,8);
console.log('QRW862_ORIGINAL_SOURCE4_FROZEN_QA2_NO_ACCEPTED_WEP_OR_ACCOUNT_STORE_MUTATION_PASS');

const origin=process.env.QRW862_ORIGIN;
assert.match(origin??'',/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'INSTALLED_CHROME_MISSING');
assert.ok(!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH,
 'PRIVATE_SAVE_FORBIDDEN');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:860},
 serviceWorkers:'block',acceptDownloads:false});
const errors=[],unsafe=[];
ctx.on('request',req=>{
 const u=new URL(req.url());
 if(u.origin!==origin||!['GET','HEAD'].includes(req.method()))
  unsafe.push(req.method()+' '+req.url());
});
const oldKeys=['dreamwishwand:moodboards:v1','dreamwishwand:moodboards:v1:backup'];
const oldData=['QRW-862-old-moodboard-primary-exact','QRW-862-old-moodboard-backup-exact'];
const dbName='dreamwishwand:wep:scene-presets:local:v1';
async function openMy(){
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));
 const res=await p.goto(origin+'/presets/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(res.status(),200);
 await p.locator('[data-stage1-presets-four-cards]').waitFor();
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:18000});
 await p.locator('[data-preset-child="my"]').click();
 await p.locator('[data-my-domain-view="wand"]').waitFor();
 await p.locator('[data-my-local-scenes]').waitFor();
 return p;
}
const dbList=async p=>p.evaluate(async name=>
 (await indexedDB.databases()).filter(x=>x.name===name),dbName);
const oldState=async p=>p.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),oldKeys);
const raw=async p=>p.evaluate(async name=>{
 const r=indexedDB.open(name,1);
 const db=await new Promise((resolve,reject)=>{
  r.onupgradeneeded=()=>{r.transaction?.abort();reject(Error('QA_NO_DB_CREATE'));};
  r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);
 });
 try{
  const tx=db.transaction('snapshots','readonly'),get=tx.objectStore('snapshots').get('library');
  return await new Promise((resolve,reject)=>{
   tx.oncomplete=()=>resolve(get.result);
   tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close();}
},dbName);
async function seed(p,input){
 return await p.evaluate(async input=>{
  const {captureScenePreset}=await import('/src/lib/wep/scene-capture-runtime.ts');
  const {validatePublishablePreset}=await import('/src/lib/wep/scene-preset-runtime.ts');
  const {saveLocalScene}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const document={target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'qa-local-scene'},
   objects:[{editorId:'synthetic-qa-local-1',itemId:40000047,layer:'furniture',
    x:1,y:2,orientation:0,footprint:[{x:0,y:0}],portableState:null,
    dependencyIds:[],editability:'editable'}]};
  const result=captureScenePreset(document,{selectionIds:['synthetic-qa-local-1'],
   includeRoads:false,includeFences:false,title:input.title},validatePublishablePreset);
  if(!result.publicationReady)throw Error('SYNTHETIC_TEST_SETUP_NOT_PORTABLE');
  return await saveLocalScene({artifact:result.artifact,title:input.title,
   expectedRevision:input.revision,idFactory:()=>input.uuid,now:input.now});
 },input);
}
async function corrupt(p,value){
 return await p.evaluate(async({name,value})=>{
  const r=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   r.onupgradeneeded=()=>{r.transaction?.abort();reject(Error('QA_DB_MISSING'));};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  try{
   const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
   const get=store.get('library');
   get.onsuccess=()=>store.put({...get.result,primary:value},'library');
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
    tx.onerror=()=>reject(tx.error);});
  }finally{db.close();}
 },{name:dbName,value});
}
try{
 const p=await openMy();
 const pane=p.locator('[data-my-local-scenes]');
 assert.equal(await pane.getAttribute('data-device-scene-authority'),'local-only');
 assert.equal(await pane.getAttribute('data-account-created'),'unverified');
 assert.equal(await pane.getAttribute('data-account-saved'),'unverified');
 assert.equal(await pane.getAttribute('data-local-scene-writer'),'off');
 assert.equal(await pane.getAttribute('data-auto-cloud'),'off');
 assert.equal(await p.locator('[data-my-wand-view="created"]').count(),1);
 assert.equal(await p.locator('[data-device-scene-preview]').count(),0);
 assert.deepEqual(await dbList(p),[],'passive My page must not open Local Scene DB');
 await p.evaluate(([keys,values])=>keys.forEach((k,i)=>localStorage.setItem(k,values[i])),
  [oldKeys,oldData]);
 await p.locator('[data-device-scenes-reopen]').focus();
 await p.keyboard.press('Enter');
 await p.locator('[data-device-scenes-status]')
  .filter({hasText:localScenePresetCopy('en').empty}).waitFor({timeout:18000});
 assert.deepEqual(await dbList(p),[],'explicit missing DB readonly open cannot create');
 assert.deepEqual(await oldState(p),oldData);
 console.log('QRW862_EXPLICIT_EMPTY_DB_KEYBOARD_NO_CREATE_CREATED_SAVED_UNVERIFIED_PASS');

 const receipt=await seed(p,{title:'QA local scene one',revision:0,
  uuid:'11111111-1111-4111-8111-111111111111',now:'2026-11-09T10:02:00Z'});
 assert.equal(receipt.revision,1);
 const before=await raw(p);
 assert.equal(JSON.parse(before.primary).entries.length,1);
 assert.equal(JSON.parse(before.backup).entries.length,0);
 assert.equal(await p.locator('[data-device-scene-select]').count(),0,
  'no passive list until explicit opt-in refresh');
 await p.locator('[data-device-scenes-reopen]').click();
 await p.locator('[data-device-scene-select]').first().waitFor({timeout:19000});
 assert.equal(await p.locator('[data-device-scene-select]').count(),1);
 assert.equal(await p.locator('[data-my-wand-view="created"]').count(),1);
 await p.locator('[data-my-view-button="saved"]').click();
 assert.equal(await p.locator('[data-my-wand-view="saved"]').count(),1);
 assert.equal(await p.locator('[data-device-scene-select]').count(),1);
 assert.equal(await p.locator('[data-my-local-scenes]').count(),1);
 await p.locator('[data-my-view-button="created"]').click();
 for(const loc of LOCAL_SCENE_PRESET_LOCALES){
  await p.locator('#site-locale').selectOption(loc);
  await p.waitForFunction(expected=>
   document.querySelector('#my-device-scenes-title')?.textContent?.trim()===expected,
   localScenePresetCopy(loc).title);
  assert.equal((await p.locator('[data-device-scenes-reopen]').innerText()).trim(),
   localScenePresetCopy(loc).reopen);
  assert.equal(await p.locator('[data-device-scene-select]').count(),1);
  assert.equal(await p.locator('[data-my-local-scenes]').getAttribute('data-account-saved'),
   'unverified');
 }
 console.log('QRW862_EIGHT_LOCALE_LOCAL_SCENE_SEPARATE_CREATED_SAVED_CONSUMER_PASS');

 await p.locator('#site-locale').selectOption('en');
 const button=p.locator('[data-device-scene-select]').first();
 await button.focus();assert.equal(await button.evaluate(el=>el===document.activeElement),true);
 await p.keyboard.press('Enter');
 await p.locator('[data-device-scene-preview]').waitFor({timeout:20000});
 assert.match(await p.locator('[data-device-scene-preview]').innerText(),/QA local scene one/);
 assert.equal(await p.locator('[data-device-scene-preview]').getAttribute('data-scene-write-ready'),'false');
 assert.match(await p.locator('[data-device-scene-preview] code').innerText(),/writeReady=false/);
 assert.deepEqual(await raw(p),before,'read-only preview cannot change primary/backup');
 for(const [w,z] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width:w,height:860});
  await p.evaluate(v=>{document.documentElement.style.zoom=v;},z);
  const box=await pane.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
  assert.ok(box.scroll<=box.client+2,'new local Scene panel horizontal overflow '+w+' '+z+' '+JSON.stringify(box));
 }
 await p.evaluate(()=>{document.documentElement.style.zoom='1';});
 await p.setViewportSize({width:1280,height:860});
 console.log('QRW862_LOCAL_SCENE_KEYBOARD_320_CSS200_READONLY_SNAPSHOT_BYTE_NEUTRAL_PASS');

 // UI-specific stale list: a second tab displays snapshot1, while original tab's
 // fixture commits an explicit second Scene. No source Store CAS reQA.
 const stale=await openMy();
 await stale.locator('[data-device-scenes-reopen]').click();
 await stale.locator('[data-device-scene-select]').first().waitFor({timeout:20000});
 await seed(p,{title:'QA local scene second',revision:1,
  uuid:'22222222-2222-4222-8222-222222222222',now:'2026-11-09T10:03:00Z'});
 const updated=await raw(p);
 assert.equal(updated.revision,2);
 await stale.locator('[data-device-scene-select]').first().click();
 await stale.locator('[data-device-scenes-status]')
  .filter({hasText:localScenePresetCopy('en').blocked}).waitFor({timeout:20000});
 assert.equal(await stale.locator('[data-device-scene-preview]').count(),0);
 assert.deepEqual(await raw(stale),updated,'stale UI cannot mutate stored primary/backup');
 await stale.locator('[data-device-scenes-reopen]').click();
 await stale.locator('[data-device-scene-select]').nth(1).waitFor({timeout:20000});
 await stale.locator('[data-device-scene-select]').nth(1).click();
 await stale.locator('[data-device-scene-preview]').waitFor({timeout:20000});
 assert.deepEqual(await raw(stale),updated);
 console.log('QRW862_STALE_LIST_REVISION_DENIES_PREVIEW_NO_IDB_MUTATION_PASS');

 // Additional separate changed-UI scope: tamper stored portable scene while its
 // formerly valid listing remains visible; new selection must failclosed.
 const illegal=structuredClone(JSON.parse(updated.primary));
 illegal.entries[0].artifact.objects[0].gridId='UNVERIFIED_NATIVE_GRID';
 await corrupt(stale,JSON.stringify(illegal));
 const forged=await raw(stale);
 await stale.locator('[data-device-scenes-reopen]').click();
 await stale.locator('[data-device-scenes-status]')
  .filter({hasText:localScenePresetCopy('en').blocked}).waitFor({timeout:20000});
 assert.equal(await stale.locator('[data-device-scene-preview]').count(),0);
 assert.deepEqual(await raw(stale),forged,'corrupted local Scene never auto-healed by UI');
 // Audit restore synthetic row only, no real user data touched.
 await corrupt(stale,updated.primary);
 assert.deepEqual(await raw(stale),updated);
 assert.deepEqual(await oldState(stale),oldData);
 console.log('QRW862_INVALID_NATIVE_SCENE_UI_DENY_NO_REPAIR_NO_FORKED_STORAGE_PASS');

 const link=p.locator('[data-device-scene-world-editor]');
 assert.equal(await link.getAttribute('href'),'/editor/world/');
 await link.focus();assert.equal(await link.evaluate(el=>el===document.activeElement),true);
 await p.keyboard.press('Enter');
 await p.waitForURL(origin+'/editor/world/',{timeout:35000});
 assert.equal(new URL(p.url()).searchParams.has('sceneId'),false,
  'World Editor link cannot invent trusted selected Scene authorization');
 assert.equal(await p.locator('[data-wep-local-scene-preview]').count(),0,
  'navigating Editor must not apply a Scene');
 assert.deepEqual(unsafe,[],'no POST / offorigin / unexpected methods');
 assert.deepEqual(errors,[],'no uncaught Chrome page errors');
 console.log('QRW862_WORLD_EDITOR_KEYBOARD_MANUAL_NAV_NO_SELECTED_APPLY_NO_CLOUD_POST_PASS');
 console.log('QRW862_INDEPENDENT_NEW_SOURCE4_INSTALLED_CHROME_NODE_SCOPED_PASS');
}finally{await ctx.close();await browser.close();}
