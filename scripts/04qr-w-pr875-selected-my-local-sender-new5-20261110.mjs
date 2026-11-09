// 04 QR-W independent changed-only QA for 08 WEB Source PR875.
// Only new sender Source 1MOD+4ADD; accepted receiver #871/QA872/#873 and
// hosted receiver QA874 are reused as ancestors, NOT re-tested.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {
 WEP_LOCAL_SCENE_ROUTE_INTENT_KEY as KEY,
 WEP_LOCAL_SCENE_ROUTE_INTENT_SCHEMA as SCHEMA,
 WEP_LOCAL_SCENE_ROUTE_INTENT_MAX_AGE_MS as TTL,
 localSceneRouteCopy
} from '../src/lib/wep/local-scene-route-handoff.mjs';
import {stageVerifiedMyLocalSceneRoute} from '../src/lib/presets/my-local-scene-route-sender.mjs';

const MAIN='475b6768031e34d91baed456446af91f376839db';
const SOURCE='423379f0e191e72a7dc129acd9cebfd816d1a8b4';
const original=new Map([
 ['.github/workflows/web-my-presets-selected-scene-sender.yml','f21e338203adc898bc5521343a61f28eb5b44b24'],
 ['scripts/web-my-presets-selected-scene-sender-chrome.mjs','d7a3a789c18ec66ccc2c411a955863759d2d00b5'],
 ['src/lib/presets/my-local-scene-route-sender.mjs','4ff70198e36f0e0f2fad5c0324349ab7e6f5a412'],
 ['src/routes/presets/+page.svelte','a31375a64c543a44e3c6e6d3b84378a53a06f464'],
 ['tests/web-my-presets-selected-scene-sender.test.mjs','924b7023f8c3d72f60e2177d78e98a5d81bf1fd1']
]);
const audits=[
 '.github/workflows/04qr-w-pr875-selected-my-local-sender-new5-20261110.yml',
 'scripts/04qr-w-pr875-selected-my-local-sender-new5-20261110.mjs'
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const delta=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN,'Source must be from actual protected main');
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE,'QA head must descend exact source');
assert.deepEqual(delta(MAIN,SOURCE),[...original.keys()].sort(),'exact Source5 not earlier accepted descendants');
assert.deepEqual(delta(SOURCE,'HEAD'),audits.sort(),'exact 2 audit-only ADD from Source');
assert.deepEqual(git('diff','--name-status',SOURCE,'HEAD').split('\n').filter(Boolean).sort(),
 audits.map(v=>'A\t'+v).sort(),'no product Source modified by QA');
assert.equal(git('diff','--name-status',MAIN,SOURCE,'--','src/routes/presets/+page.svelte')
 .split('\t')[0],'M');
for(const [path,sha] of original){
 assert.equal(git('rev-parse',SOURCE+':'+path),sha,'Source blob pin '+path);
 assert.equal(git('hash-object',path),sha,'QA cannot mutate Source blob '+path);
}
assert.equal(git('diff','--name-only',MAIN,SOURCE,'--',
 'src/lib/wep','src/routes/editor','src/routes/moodboards','src/lib/community',
 'src/lib/presets/my-presets-router.mjs','src/lib/wep/local-scene-preset-store.mjs',
 'crates','supabase','static','.github/workflows/pages.yml'),'',
 'No accepted receiver, Stage1, Native, migration or public Pages edits');
console.log('QRW875_ORIGINAL_SOURCE5_BLOBS_QA2_ISOLATED_ANCESTORS_UNCHANGED_PASS');

// Independent adapter negative: invalidating previous pending sender hint
// before a failed *new* explicit selection, even if the UI previously staged.
const SID='scene_11111111-1111-4111-8111-111111111111';
const oldPending='{"stale":"not-authorized-previous-selection"}';
const pending=new Map([[KEY,oldPending]]);
const storage={
 getItem:k=>pending.get(k)??null,setItem:(k,v)=>pending.set(k,String(v)),
 removeItem:k=>pending.delete(k)
};
const picked={id:SID,title:'QA selected Scene',createdAt:'2026-11-10T00:00:00.000Z',objectCount:1};
for(const rejected of [
 {readScene:async()=>{throw Error('MISSING_DB_NO_CREATE');}},
 {readScene:async()=>({revision:2,entry:{...picked,artifact:{objects:[{}]}}})}
]){
 pending.set(KEY,oldPending);
 await assert.rejects(
  stageVerifiedMyLocalSceneRoute({
   selected:picked,expectedRevision:1,storage,...rejected
  }),
  /WEB_MYLOCAL_SCENE_ROUTE_NOT_VERIFIED/
 );
 assert.equal(pending.has(KEY),false,'Old intent may not survive a newly denied sender click');
}
console.log('QRW875_NEW_SENDER_CLEAR_PREVIOUS_PENDING_HINT_ON_FAILED_VALIDATION_PASS');

const origin=process.env.QRW875_ORIGIN;
assert.match(origin??'',/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'REAL_INSTALLED_CHROME_REQUIRED');
assert.ok(!process.env.DDV_PRIVATE_SAVE_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.P1G_PATH,
 'PRIVATE_SAVE_NOT_ALLOWED');
const DB='dreamwishwand:wep:scene-presets:local:v1';
const OLD_KEYS=['dreamwishwand:moodboards:v1','dreamwishwand:moodboards:v1:backup'];
const OLD_VALUES=['QRW875_original_legacy_primary','QRW875_original_legacy_backup'];
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
const errors=[],unsafe=[];
ctx.on('request',r=>{
 if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))
  unsafe.push(r.method()+' '+r.url());
});
const attach=p=>p.on('pageerror',e=>errors.push(String(e)));
const hint=p=>p.evaluate(key=>sessionStorage.getItem(key),KEY);
const dbNames=p=>p.evaluate(async()=> (await indexedDB.databases()).map(x=>x.name).sort());
const legacy=p=>p.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),OLD_KEYS);
async function row(p){
 return p.evaluate(async name=>{
  const r=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   r.onupgradeneeded=()=>{r.transaction?.abort();reject(Error('QA_READER_MUST_NOT_CREATE_DB'));};
   r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);
  });
  try{
   const tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get('library');
   return await new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve(q.result);tx.onabort=()=>reject(tx.error);
    tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },DB);
}
async function writeSynthetic(p,record){
 await p.evaluate(async({name,record})=>{
  const r=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   r.onupgradeneeded=()=>{r.transaction.abort();reject(Error('QA_UNEXPECTED_DB_CREATE'));};
   r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result);
  });
  try{
   const tx=db.transaction('snapshots','readwrite');
   tx.objectStore('snapshots').put(record,'library');
   await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error);
   });
  }finally{db.close();}
 },{name:DB,record});
}
async function saveSynthetic(p,{uuid,title,rev}){
 return p.evaluate(async ({uuid,title,rev})=>{
  const {captureScenePreset}=await import('/src/lib/wep/scene-capture-runtime.ts');
  const {validatePublishablePreset}=await import('/src/lib/wep/scene-preset-runtime.ts');
  const {saveLocalScene}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  const editor={target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'qaw875-disposable'},
   objects:[{editorId:'qaw875-only',itemId:40000049,layer:'furniture',
    x:3,y:4,orientation:0,footprint:[{x:0,y:0},{x:1,y:0}],
    portableState:null,dependencyIds:[],editability:'editable'}]};
  const cap=captureScenePreset(editor,{
   selectionIds:['qaw875-only'],title,includeRoads:false,includeFences:false
  },validatePublishablePreset);
  if(!cap.publicationReady)throw Error('QA_SYNTHETIC_PORTABLE_CAPTURE_INVALID');
  return saveLocalScene({
   artifact:cap.artifact,title,expectedRevision:rev,
   idFactory:()=>uuid,now:'2026-11-10T00:00:00.000Z'
  });
 },{uuid,title,rev});
}
async function openMy(p){
 const r=await p.goto(origin+'/presets/',{waitUntil:'networkidle',timeout:40000});
 assert.equal(r.status(),200);
 await p.locator('[data-stage1-presets-four-cards]').waitFor({timeout:20000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:20000});
 await p.locator('[data-preset-child="my"]').click();
 await p.locator('[data-my-local-scenes]').waitFor({timeout:20000});
}
async function refreshSelect(p,index=0){
 await p.locator('[data-device-scenes-reopen]').click();
 await p.locator('[data-device-scene-select]').nth(index).waitFor({timeout:24000});
 const s=p.locator('[data-device-scene-select]').nth(index);
 await s.focus();assert.equal(await s.evaluate(e=>e===document.activeElement),true);
 await p.keyboard.press('Enter');
 await p.locator('[data-device-scene-world-editor-selected]').waitFor({timeout:22000});
}
async function send(p){
 const s=p.locator('[data-device-scene-world-editor-selected]');
 await s.focus();assert.equal(await s.evaluate(e=>e===document.activeElement),true);
 await p.keyboard.press('Enter');
}
const blocked=async p=>{
 await p.locator('[data-device-scenes-status]')
  .filter({hasText:localSceneRouteCopy('en').blocked}).waitFor({timeout:22000});
 assert.equal(await p.locator('[data-device-scene-world-editor-selected]').count(),0);
 assert.equal(await hint(p),null);
 assert.equal(new URL(p.url()).pathname,'/presets/');
};
try{
 const p=await ctx.newPage();attach(p);
 await openMy(p);
 assert.equal((await dbNames(p)).includes(DB),false);
 assert.equal(await hint(p),null);
 assert.equal(await p.locator('[data-device-scene-world-editor-selected]').count(),0);
 await p.locator('[data-device-scenes-reopen]').click();
 await p.locator('[data-device-scenes-status]').waitFor();
 assert.equal((await dbNames(p)).includes(DB),false,
  'missing DB read-only opt-in may not create Scene IndexedDB');
 assert.equal(await hint(p),null);
 await p.evaluate(({keys,values})=>keys.forEach((k,i)=>localStorage.setItem(k,values[i])),
  {keys:OLD_KEYS,values:OLD_VALUES});
 console.log('QRW875_ABSENT_DB_PASSIVE_OR_EXPLICIT_READ_NO_HINT_NO_CREATE_PASS');

 // Canonical accepted Scene save is merely a synthetic fixture.
 const first=await saveSynthetic(p,{
  uuid:'11111111-1111-4111-8111-111111111111',title:'QA selected local scene 1',rev:0
 });
 assert.equal(first.revision,1);
 const original=await row(p),originalDBs=await dbNames(p);
 const other=await ctx.newPage();attach(other);
 await other.goto(origin+'/presets/',{waitUntil:'domcontentloaded'});
 assert.equal(await hint(other),null,'independent no-opener Chrome tab has no sender hint');
 await refreshSelect(p);
 assert.equal(await hint(p),null,'selection and preview NOT sender');
 const area=p.locator('[data-my-local-scenes]');
 assert.equal(await area.getAttribute('data-account-created'),'unverified');
 assert.equal(await area.getAttribute('data-account-saved'),'unverified');
 assert.equal(await area.getAttribute('data-auto-cloud'),'off');
 assert.equal(await area.getAttribute('data-local-scene-writer'),'off');
 assert.equal(await p.locator('[data-my-wand-view="created"]').count(),1);
 assert.equal(await p.locator('[data-device-scene-world-editor]').count(),1,
  'accepted generic Editor link remains and cannot auto-stage');
 console.log('QRW875_EXPLICIT_DEVICE_SELECTION_NO_AUTOHINT_ACCOUNT_CREATED_SAVED_SEPARATE_PASS');

 // New sender UI 8 locales and accessible keyboard+zoom.
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await p.locator('#site-locale').selectOption(lang);
  await p.waitForFunction(({lang,text})=>
    document.documentElement.dataset.locale===lang &&
    document.querySelector('[data-device-scene-world-editor-selected]')
      ?.textContent?.trim()===text,
    {lang,text:localSceneRouteCopy(lang).action},{timeout:18000});
  assert.equal(await p.locator('[data-my-verified="false"]').count(),1);
  assert.equal(await area.getAttribute('data-account-created'),'unverified');
  assert.equal(await area.getAttribute('data-account-saved'),'unverified');
 }
 await p.locator('#site-locale').selectOption('en');
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:900});
  await p.evaluate(z=>document.documentElement.style.zoom=z,zoom);
  const m=await area.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(m.scroll<=m.client+2,'new sender panel overflow '+width+'/'+zoom+' '+JSON.stringify(m));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 assert.deepEqual(await row(p),original);
 assert.deepEqual(await legacy(p),OLD_VALUES);
 console.log('QRW875_NEW_SENDER_EIGHT_LOCALES_320_CSS200_KEYBOARD_NO_STORAGE_MUTATION_PASS');

 await send(p);
 await p.waitForURL(origin+'/editor/world/',{timeout:40000});
 const h=JSON.parse(await hint(p));
 assert.deepEqual(Object.keys(h),['schema','sceneId','expectedRevision','issuedAt']);
 assert.deepEqual(
  {schema:h.schema,sceneId:h.sceneId,revision:h.expectedRevision},
  {schema:SCHEMA,sceneId:first.id,revision:1});
 assert.ok(Date.now()>=h.issuedAt&&Date.now()-h.issuedAt<=TTL);
 for(const leak of ['artifact','title','creator','native','itemId','ownership','writeReady','gridId'])
  assert.equal(Object.hasOwn(h,leak),false,'untrusted leak '+leak);
 assert.equal(new URL(p.url()).search,'');
 assert.equal(new URL(p.url()).hash,'');
 assert.equal(await hint(other),null,'hint must not leave original tab');
 await p.locator('[data-wep-selected-scene-route-confirm]').waitFor({timeout:25000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0,
  'sender must NOT invoke receiver click automatically');
 assert.deepEqual(await row(p),original,'sender+passive receiver cannot mutate Scene');
 assert.deepEqual(await legacy(p),OLD_VALUES,'sender never touches old Moodboards');
 const confirm=p.locator('[data-wep-selected-scene-route-confirm]');
 await confirm.focus();await p.keyboard.press('Enter');
 const draft=p.locator('[data-wep-selected-scene-route-draft]');
 await draft.waitFor({timeout:25000});
 assert.match(await draft.innerText(),/writeReady=false \/ applyReady=false/);
 assert.match(await draft.innerText(),/40000049/);
 assert.match(await draft.innerText(),/2 × 1/);
 assert.equal(await draft.getAttribute('data-apply'),'off');
 assert.equal(await draft.getAttribute('data-editor-mutation'),'off');
 assert.equal(await hint(p),null);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0,
  'accepted Receiver must not accept sender as EditorSession command');
 assert.deepEqual(await row(p),original);
 assert.deepEqual(await legacy(p),OLD_VALUES);
 await p.reload({waitUntil:'domcontentloaded'});
 assert.equal(await p.locator('[data-wep-selected-scene-route]').count(),0,'one-shot never replays');
 console.log('QRW875_SENDER_TO_EDITOR_TRUE_SAME_TAB_SECOND_USER_CONFIRM_READONLY_DRAFT_PASS');

 // Stale preview selected in tab A; tab B independently saves new Scene rev2.
 const stale=await ctx.newPage();attach(stale);
 await openMy(stale);
 await refreshSelect(stale);
 assert.equal(await hint(stale),null);
 const second=await saveSynthetic(other,{
  uuid:'22222222-2222-4222-8222-222222222222',title:'QA second scene',rev:1
 });
 assert.equal(second.revision,2);
 const updated=await row(other);
 assert.equal(updated.backupRevision,1);
 assert.equal(updated.backup,original.primary,'old Raw Primary retained as Backup');
 await send(stale);
 await blocked(stale);
 assert.deepEqual(await row(stale),updated,'stale source cannot edit store');
 console.log('QRW875_STALE_OTHER_TAB_REVISION_SENDER_FAIL_CLOSED_NO_HINT_NO_OVERWRITE_PASS');

 // Invalid prior intent should be invalidated BEFORE another selected click
 // whose canonical Row is now corrupt, not left as a redirect authorization.
 await stale.locator('[data-device-scenes-reopen]').click();
 await stale.locator('[data-device-scene-select]').first().waitFor({timeout:25000});
 await stale.locator('[data-device-scene-select]').first().click();
 await stale.locator('[data-device-scene-world-editor-selected]').waitFor();
 await stale.evaluate(({key,schema,id})=>{
  sessionStorage.setItem(key,JSON.stringify({
   schema,sceneId:id,expectedRevision:2,issuedAt:Date.now()
  }));
 },{key:KEY,schema:SCHEMA,id:first.id});
 // Changed current underlying artifact without changing UI selection.
 const broken={...updated,primary:'{"corrupt":"synthetic-primary-row"}'};
 await writeSynthetic(other,broken);
 await send(stale);
 await blocked(stale);
 assert.deepEqual(await row(stale),broken,'No repair of invalid synthetic row');
 assert.deepEqual(await legacy(stale),OLD_VALUES);
 await writeSynthetic(other,updated); // QA restores only disposable data.
 assert.deepEqual(await row(other),updated);
 console.log('QRW875_CORRUPT_SCENE_SENDER_INVALIDATES_OLD_HINT_NO_AUTO_REPAIR_PASS');

 // A forged native pointer or another SceneID in a selected UI row is not
 // authorized by sessionStorage. Here we exercise the changed sender helper
 // directly with untrusted selection vs current genuine row.
 const imported=await stale.evaluate(async({id,rev})=>{
  const mod=await import('/src/lib/presets/my-local-scene-route-sender.mjs');
  const fake={id:'native:grid:42',title:'Forged',createdAt:'2026-11-10T00:00:00Z',objectCount:1};
  try {
   await mod.stageVerifiedMyLocalSceneRoute({
    selected:fake,expectedRevision:rev,storage:sessionStorage
   });
   return {accepted:true};
  }catch{return {accepted:false,hint:sessionStorage.getItem('dreamwishwand:wep:scene-preset:selected-route:v1')};}
 },{id:first.id,rev:2});
 assert.equal(imported.accepted,false);
 assert.equal(imported.hint,null);
 assert.deepEqual(await row(other),updated);
 assert.deepEqual(await dbNames(other),originalDBs,
  'No new IDB namespace or duplicate reader spawned by selected sender');
 assert.deepEqual(unsafe,[],'no outbound GET/POST/cloud/provider');
 assert.deepEqual(errors,[],'no Browser page error');
 console.log('QRW875_FORGED_NATIVE_SELECTION_ID_DENY_NO_CLOUD_POST_IDB_INVARIANT_PASS');
 console.log('QRW875_INDEPENDENT_NEW5_SENDER_AND_ACCEPTED_RECEIVER_REAL_CHROME_SCOPED_PASS',
  JSON.stringify({source:SOURCE,main:MAIN,senderNew5:true,syntheticOnly:true,
   realNativeSave:false,community:false,writer:false,apply:false,qaOnly:true}));
}finally{await ctx.close();await browser.close();}
