// 04 QR-W F-P04 independent QA of WEP PR871's new selected Scene RECEIVER.
// Distinct from accepted PR859/QA860, PR862/QA864, PR867/QA868, deployed QA870.
// This tests one-shot same-tab UX/read-only receipt boundary, not Native Apply.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {
 WEP_LOCAL_SCENE_ROUTE_INTENT_KEY as KEY,
 WEP_LOCAL_SCENE_ROUTE_INTENT_SCHEMA as SCHEMA,
 WEP_LOCAL_SCENE_ROUTE_INTENT_MAX_AGE_MS as TTL,
 WEP_LOCAL_SCENE_ROUTE_LOCALES,localSceneRouteCopy,
 stageLocalSceneRouteIntent,peekLocalSceneRouteIntent,takeLocalSceneRouteIntent
} from '../src/lib/wep/local-scene-route-handoff.mjs';
const MAIN='e82d55981c371979cfdad2262ede1949d50f5e9d';
const SOURCE='2ab1f526b38e2aa9f7262a428f268c794f933f3e';
const original=new Map([
 ['.github/workflows/wep-local-scene-route-handoff.yml','78f03f2c43b142a44c8c114807bc4f260f016e08'],
 ['docs/wep/world-editor-localization-inventory-20261002.json','f6dc00a6a835afdf078a2de1c4c98234f270f38b'],
 ['scripts/wep-local-scene-route-handoff-chrome.mjs','3f52f28a986b7c186c99263ef619001e99db90bf'],
 ['src/lib/wep/local-scene-route-handoff.mjs','9114d537d5afee718db5240d538b4203546a591f'],
 ['src/routes/editor/world/+page.svelte','7c2a0d25aa97588b7753a1231e7627b0489aede7'],
 ['tests/wep-local-scene-route-handoff.test.mjs','278f9105349a9e2b9a248d785d78668e27baf342']
]);
const audit=[
 '.github/workflows/04qr-w-pr871-selected-scene-receiver-new6-20261109.yml',
 'scripts/04qr-w-pr871-selected-scene-receiver-new6-20261109.mjs'
];
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN,'fixed canonical latest protected main is ancestor');
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE,'QA descends from exact Source');
assert.deepEqual(diff(MAIN,SOURCE),[...original.keys()].sort(),'Source original SIX only');
assert.deepEqual(diff(SOURCE,'HEAD'),audit.sort(),'QA two ADD only');
for(const [path,blob] of original){
 assert.equal(git('rev-parse',SOURCE+':'+path),blob,'fixed original git blob '+path);
 assert.equal(git('hash-object',path),blob,'no modifications to Source '+path);
}
assert.equal(git('diff','--name-only',MAIN,SOURCE,'--',
 'src/lib/wep/local-scene-preset-store.mjs','src/lib/wep/local-scene-reuse-readonly.ts',
 'src/routes/presets','src/routes/moodboards','src/lib/wep/scene-preset-runtime.ts',
 'src/lib/community','supabase','crates','static','.github/workflows/pages.yml'),'',
 'accepted portable Scene and Presets/Native/Community/Pages unchanged');
const route=readFileSync('src/routes/editor/world/+page.svelte','utf8');
const inventory=JSON.parse(readFileSync('docs/wep/world-editor-localization-inventory-20261002.json','utf8'));
assert.equal(inventory.sourcePins['src/routes/editor/world/+page.svelte'],
 original.get('src/routes/editor/world/+page.svelte'));
assert.equal(inventory.sourcePins['src/lib/wep/local-scene-route-handoff.mjs'],
 original.get('src/lib/wep/local-scene-route-handoff.mjs'));
assert.match(route,/routeSceneIntent = peekLocalSceneRouteIntent\(sessionStorage\)/);
assert.match(route,/takeLocalSceneRouteIntent\(sessionStorage, shown\)/);
assert.match(route,/const fresh = await readLocalSceneById\(chosen.sceneId\)/);
assert.match(route,/fresh\.revision !== chosen\.expectedRevision/);
assert.match(route,/data-wep-selected-scene-route-draft data-apply="off"/);
assert.doesNotMatch(route,/stageLocalSceneRouteIntent\(/,'WEP receiver must not be sender');
console.log('QRW871_FROZEN_SOURCE6_QA_ONLY2_INVENTORY_AND_CONTRACT_BOUNDARY_PASS');

// Independently verify new receiver one-shot contract's strict storage interface.
function fakeStore(){
 const m=new Map();
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),
  removeItem:k=>m.delete(k),keys:()=>[...m.keys()]};
}
const sid='scene_11111111-1111-4111-8111-111111111111';
const now=1794231000000;
const s=fakeStore();
const staged=stageLocalSceneRouteIntent(s,{sceneId:sid,expectedRevision:4},now);
const literal=s.getItem(KEY);
assert.deepEqual(Object.keys(JSON.parse(literal)),['schema','sceneId','expectedRevision','issuedAt']);
assert.equal(JSON.stringify(staged).includes('editorId'),false);
assert.equal(JSON.stringify(staged).includes('GridID'),false);
assert.equal(JSON.stringify(staged).includes('Save'),false);
const shown=peekLocalSceneRouteIntent(s,now);
assert.equal(shown.expectedRevision,4);
const cloned=fakeStore();
assert.equal(takeLocalSceneRouteIntent(cloned,shown,now),null,'other-tab lacks one-shot hint');
assert.deepEqual(takeLocalSceneRouteIntent(s,shown,now),shown);
assert.equal(takeLocalSceneRouteIntent(s,shown,now),null,'replay denied');
stageLocalSceneRouteIntent(s,{sceneId:sid,expectedRevision:4},now);
const seen=peekLocalSceneRouteIntent(s,now);
stageLocalSceneRouteIntent(s,{sceneId:sid,expectedRevision:5},now+1);
assert.equal(takeLocalSceneRouteIntent(s,seen,now+1),null,'rendered hint must match taken hint');
assert.equal(s.getItem(KEY),null,'mutated hint consumed and not retained');
stageLocalSceneRouteIntent(s,{sceneId:sid,expectedRevision:1},now);
assert.equal(peekLocalSceneRouteIntent(s,now+TTL+1),null,'expired not displayed');
assert.equal(WEP_LOCAL_SCENE_ROUTE_LOCALES.length,8);
for(const locale of WEP_LOCAL_SCENE_ROUTE_LOCALES){
 const c=localSceneRouteCopy(locale);
 for(const key of ['title','notice','action','ready','blocked'])
  assert.ok(typeof c[key]==='string'&&c[key].length>5,locale+'/'+key);
}
console.log('QRW871_NEW_ONESHOT_SAME_TAB_TOCTOU_EXPIRE_REPLAY_EIGHT_LOCALES_NODE_PASS');

const origin=process.env.QRW871_ORIGIN;
assert.match(origin??'',/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'ACTUAL_CHROME_INSTALLED');
assert.ok(!process.env.DDV_PRIVATE_SAVE_PATH&&!process.env.WEP_PRIVATE_P1G_PATH,
 'PRIVATE_SAVE_FORBIDDEN');
const DB='dreamwishwand:wep:scene-presets:local:v1';
const legacyKey='dreamwishwand:moodboards:v1';
const legacyBackupKey='dreamwishwand:moodboards:v1:backup';
const legacyPrimary='{"qaw":"old-moodboard-raw-unique-receiver"}';
const legacyBackup='{"qaw":"old-backup-raw-unique-receiver"}';
const tstamp='2026-11-09T01:20:00.000Z';
const artifact={
 schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',
 title:'Independent receiver test Scene',
 source:{gameVersion:null,platform:null,areaKey:null},
 bounds:{w:2,h:1},originPolicy:'capture-region-top-left',
 objects:[{artifactObjectId:'o0',itemId:40000049,layer:'furniture',
  localX:0,localY:0,orientation:0,footprint:[{x:0,y:0},{x:1,y:0}],
  portableState:null,dependencyIds:[]}],
 networks:{roads:null,fences:null},
 requirements:{itemQuantities:{'40000049':1},roadTopology:false,fenceTopology:false},
 normalization:{sourceGridIdsRemoved:true,sourceGridObjectIdsRemoved:true,
  dependencyClosureIncluded:true}
};
const empty={schema:'wand.wep.scene-library@1',version:1,entries:[]};
const rowDoc={...empty,entries:[{id:sid,title:'Receiver QA row',createdAt:tstamp,artifact}]};
const initial={schema:'wand.wep.scene-library-snapshot@1',revision:1,backupRevision:0,
 primary:JSON.stringify(rowDoc),backup:JSON.stringify(empty)};
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:900},
 serviceWorkers:'block',acceptDownloads:false});
const errors=[],unsafe=[];
ctx.on('request',r=>{
 if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))
  unsafe.push(r.method()+' '+r.url());
});
const attach=p=>p.on('pageerror',e=>errors.push(String(e)));
async function getDBs(p){return p.evaluate(async()=>indexedDB.databases());}
async function raw(p){
 return p.evaluate(async name=>{
  const req=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   req.onupgradeneeded=()=>{req.transaction?.abort();reject(Error('TEST_MUST_NOT_CREATE_DB'));};
   req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
  });
  try{
   const tx=db.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').get('library');
   return await new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve(r.result);
    tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },DB);
}
async function put(p,record){
 await p.evaluate(async({name,record})=>{
  const req=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   req.onupgradeneeded=()=>req.result.createObjectStore('snapshots');
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
async function state(p){
 return p.evaluate(([k,b])=>[localStorage.getItem(k),localStorage.getItem(b)],
  [legacyKey,legacyBackupKey]);
}
async function hint(p,expected=1,at=Date.now()){
 // Use the new canonical WEP helper as future-sender contract fixture, not
 // WEB Source. No Product sender exists at this time.
 return p.evaluate(async({id,expected,at})=>{
  const mod=await import('/src/lib/wep/local-scene-route-handoff.mjs');
  return mod.stageLocalSceneRouteIntent(sessionStorage,{
   sceneId:id,expectedRevision:expected},at);
 },{id:sid,expected,at});
}
async function editor(p){
 const r=await p.goto(origin+'/editor/world/',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(r.status(),200);
}
async function confirm(p){
 const button=p.locator('[data-wep-selected-scene-route-confirm]');
 await button.waitFor({timeout:20000});
 await button.focus();assert.equal(await button.evaluate(el=>el===document.activeElement),true);
 await p.keyboard.press('Enter');
}
try{
 const p=await ctx.newPage();attach(p);
 await p.goto(origin+'/presets/',{waitUntil:'domcontentloaded',timeout:45000});
 await p.evaluate(([k,b,a,z])=>{localStorage.setItem(k,a);localStorage.setItem(b,z);},
  [legacyKey,legacyBackupKey,legacyPrimary,legacyBackup]);
 assert.equal((await getDBs(p)).filter(d=>d.name===DB).length,0,'no Scene DB before staging');
 // Explicit sender-simulation requires an independent user choice, not
 // spontaneous Preview. Stage only ID+Revision in same tab.
 await hint(p,1);
 assert.equal(new URL(p.url()).searchParams.has('sceneId'),false);
 await editor(p);
 await p.locator('[data-wep-selected-scene-route]').waitFor({timeout:20000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 assert.equal((await getDBs(p)).filter(d=>d.name===DB).length,0,
  'passive rendered hint must not open or create Scene DB');
 await confirm(p);
 await p.locator('[data-wep-selected-scene-route-status]').waitFor({timeout:22000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0,
  'missing Scene DB must fail closed');
 assert.equal((await getDBs(p)).filter(d=>d.name===DB).length,0,
  'explicit bad hint may not create Scene DB');
 assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),KEY),null);
 assert.deepEqual(await state(p),[legacyPrimary,legacyBackup]);
 console.log('QRW871_REAL_CHROME_MISSING_DB_PASSIVE_NO_OPEN_EXPLICIT_DENY_NO_DB_CREATE_PASS');

 await put(p,initial); // only synthetic QA-owned IDB fixture
 assert.deepEqual(await raw(p),initial);
 await p.goto(origin+'/presets/',{waitUntil:'domcontentloaded'});
 await hint(p,1);
 await editor(p);
 const panel=p.locator('[data-wep-selected-scene-route]');
 await panel.waitFor({timeout:22000});
 assert.equal(await panel.getAttribute('data-save-writer'),'off');
 assert.equal(await panel.getAttribute('data-native-apply'),'off');
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.deepEqual(await raw(p),initial,'navigation should not write Scene primary/backup');
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 await confirm(p);
 const draft=p.locator('[data-wep-selected-scene-route-draft]');
 await draft.waitFor({timeout:22000});
 assert.equal(await draft.getAttribute('data-apply'),'off');
 assert.equal(await draft.getAttribute('data-editor-mutation'),'off');
 assert.match(await draft.innerText(),/1 objects \/.*2 × 1/);
 assert.match(await draft.innerText(),/40000049/);
 assert.match(await draft.innerText(),/\(0, 0\)/);
 assert.match(await draft.innerText(),/writeReady=false \/ applyReady=false/);
 assert.deepEqual(await raw(p),initial);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),KEY),null,'one-shot cleared');
 await p.reload({waitUntil:'domcontentloaded'});
 assert.equal(await p.locator('[data-wep-selected-scene-route]').count(),0,
  'consumed route hint cannot replay across reload');
 assert.deepEqual(await raw(p),initial);
 console.log('QRW871_EXPLICIT_SAME_TAB_SELECTED_SCENE_RECEIVER_READONLY_DRAFT_NONMUTATING_ONE_SHOT_PASS');

 // Locale and responsiveness on a brand-new hint, before user confirmation.
 await p.goto(origin+'/presets/',{waitUntil:'domcontentloaded'});
 await hint(p,1);
 await editor(p);
 await panel.waitFor({timeout:22000});
 for(const loc of WEP_LOCAL_SCENE_ROUTE_LOCALES){
  await p.evaluate(loc=>{
   const el=document.querySelector('#site-locale');
   if(!el)throw Error('SITE_LOCALE_MISSING');
   el.value=loc;el.dispatchEvent(new Event('change',{bubbles:true}));
  },loc);
  await p.waitForFunction(expected=>
   document.querySelector('[data-wep-selected-scene-route-confirm]')?.textContent?.trim()===expected,
   localSceneRouteCopy(loc).action,{timeout:16000});
  assert.equal(await panel.getAttribute('aria-label'),localSceneRouteCopy(loc).title);
 }
 await p.evaluate(()=>{
  const el=document.querySelector('#site-locale');
  el.value='en';el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await p.waitForFunction(()=>document.querySelector('[data-wep-selected-scene-route-confirm]')
  ?.textContent?.trim()==='Reopen selected Scene as read-only draft');
 for(const [width,z] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:850});
  await p.evaluate(z=>document.documentElement.style.zoom=z,z);
  const b=await panel.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(b.scroll<=b.client+2,'new Receiver panel overflow '+width+'/'+z+' '+JSON.stringify(b));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 assert.deepEqual(await raw(p),initial);
 console.log('QRW871_NEW_RECEIVER_EIGHT_LOCALES_320_CSS200_KBD_PASS');

 // After a rendered Rev1 hint but before explicit user confirmation, another
 // tab changes the real Library. Receiver must compare CURRENT version.
 const other=await ctx.newPage();attach(other);
 await other.goto(origin+'/editor/world/',{waitUntil:'domcontentloaded'});
 const version2={...initial,revision:2,backupRevision:1,backup:initial.primary};
 await put(other,version2);
 const updated=await raw(other);
 assert.equal(updated.revision,2);
 await confirm(p);
 await p.locator('[data-wep-selected-scene-route-status]')
  .filter({hasText:localSceneRouteCopy('en').blocked}).waitFor({timeout:20000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),KEY),null);
 assert.deepEqual(await raw(p),updated);
 console.log('QRW871_OTHER_TAB_STALE_EXPECTED_REVISION_DENY_NO_STORAGE_WRITE_PASS');

 // TOCTOU: after UI rendered on passively shown selected Rev2, the tab's
 // untrusted sessionStorage changes before confirm. No upgrade to new revision.
 await p.goto(origin+'/presets/',{waitUntil:'domcontentloaded'});
 await hint(p,2);
 await editor(p);
 await panel.waitFor({timeout:20000});
 await p.evaluate(({key,schema,id})=>{
  sessionStorage.setItem(key,JSON.stringify({
   schema,sceneId:id,expectedRevision:3,issuedAt:Date.now()
  }));
 },{key:KEY,schema:SCHEMA,id:sid});
 await confirm(p);
 await p.locator('[data-wep-selected-scene-route-status]')
  .filter({hasText:localSceneRouteCopy('en').blocked}).waitFor({timeout:20000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),KEY),null);
 assert.deepEqual(await raw(p),updated);
 console.log('QRW871_CHANGED_HINT_TOCTOU_AND_REPLAY_DENY_PASS');

 // Expired and malicious extra ownership/native authority data never display
 // the receiver. No accidental Scene or Editor mutation on bad hints.
 for(const payload of [
  {schema:SCHEMA,sceneId:sid,expectedRevision:2,issuedAt:Date.now()-TTL-100},
  {schema:SCHEMA,sceneId:'native:grid:42',expectedRevision:2,issuedAt:Date.now()},
  {schema:SCHEMA,sceneId:sid,expectedRevision:2,issuedAt:Date.now(),writeReady:true}
 ]){
  await p.evaluate(({key,payload})=>sessionStorage.setItem(key,JSON.stringify(payload)),
   {key:KEY,payload});
  await p.reload({waitUntil:'domcontentloaded'});
  assert.equal(await p.locator('[data-wep-selected-scene-route]').count(),0);
  assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
  assert.deepEqual(await raw(p),updated);
 }
 // Revised valid hint but corrupted portable artifact on accepted Library:
 // new receiver must use canonical read/projection guard (not hint content).
 const unsafeDoc=structuredClone(rowDoc);
 unsafeDoc.entries[0].artifact.objects[0].sourceGridObjectId='native-grid-fraud';
 const tampered={...updated,primary:JSON.stringify(unsafeDoc)};
 await put(p,tampered);
 await p.goto(origin+'/presets/',{waitUntil:'domcontentloaded'});
 await hint(p,2);
 await editor(p);
 await panel.waitFor({timeout:18000});
 await confirm(p);
 await p.locator('[data-wep-selected-scene-route-status]')
  .filter({hasText:localSceneRouteCopy('en').blocked}).waitFor({timeout:20000});
 assert.equal(await p.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.deepEqual(await raw(p),tampered,'no auto repair of forged Scene');
 await put(p,updated); // QA-owned data only, exact fixture restore.
 assert.deepEqual(await raw(p),updated);
 assert.deepEqual(await state(p),[legacyPrimary,legacyBackup]);
 assert.deepEqual(unsafe,[],'no POST/off-origin request or external leak');
 assert.deepEqual(errors,[],'no uncaught browser error');
 console.log('QRW871_INVALID_NATIVE_HINT_AND_CORRUPT_SCENE_FALL_CLOSED_NO_MOODBOARD_MUTATION_PASS');
 console.log('QRW871_INDEPENDENT_RECEIVER_SOURCE6_NODE_INSTALLED_CHROME_SCOPED_PASS',
  JSON.stringify({source:SOURCE,main:MAIN,synthetic:true,senderSourceNotYetBuilt:true,
   writer:false,nativeApply:false,qaOnly:true}));
}finally{await ctx.close();await browser.close();}
