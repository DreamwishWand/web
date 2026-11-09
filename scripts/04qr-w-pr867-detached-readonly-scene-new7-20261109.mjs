// 04 QR-W F-P04 / R10 R11 R13: independent changed-only Source PR867 validation.
// Ancestors Source859/QA860, Source862/QA864, hosted QAW866 accepted, NOT re-QA.
// New Operation: verified stored portable Scene -> explicit detached local-only readonly Draft.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {captureScenePreset} from '../src/lib/wep/scene-capture-runtime.ts';
import {validatePublishablePreset} from '../src/lib/wep/scene-preset-runtime.ts';
import {buildReadonlyLocalSceneReuseDraft,WEP_LOCAL_SCENE_REUSE_OPERATION}
 from '../src/lib/wep/local-scene-reuse-readonly.ts';
import {localScenePresetCopy,LOCAL_SCENE_PRESET_LOCALES}
 from '../src/lib/wep/local-scene-preset-copy.js';
const SOURCE='9f5d1e442922eb1d82c717d3cb0e7b9d9c3e2e42';
const MAIN='f4ae5c8e84ccf37dcf0e89d6c45a2d8e61479922';
const orig=new Map([
 ['.github/workflows/wep-local-scene-reuse-readonly.yml','44a4b4fe624783e7a03b193947e1f6096f2ec2b2'],
 ['docs/wep/world-editor-localization-inventory-20261002.json','b0a690a9c6bd083cb2ca8cac8ac5c550dbf809ca'],
 ['scripts/wep-local-scene-reuse-readonly-chrome.mjs','b17733d8a27d0b379f2b38c6a85cc191375307af'],
 ['src/lib/wep/local-scene-preset-copy.js','00c5b6612142d2331f4c36f6d229a672d94550d2'],
 ['src/lib/wep/local-scene-reuse-readonly.ts','4b29eaae67d975f076c2bca71fe3aecb57aa060a'],
 ['src/routes/editor/world/+page.svelte','20e007ed9f0504a0743645f5eeb4983ad36859a6'],
 ['tests/wep-local-scene-reuse-readonly.test.mjs','1b3d992879a6d1d79a1d0fb94921c28ce181b4ae']
]);
const audit=[
 '.github/workflows/04qr-w-pr867-detached-readonly-scene-new7-20261109.yml',
 'scripts/04qr-w-pr867-detached-readonly-scene-new7-20261109.mjs'
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(MAIN,SOURCE),[...orig.keys()].sort(),
 'Source PR867 seven original files, not outdated PR description six');
assert.deepEqual(diff(SOURCE,'HEAD'),audit.sort(),'QA-only two audit ADD');
assert.equal(git('diff','--name-status',MAIN,SOURCE,'--','docs/wep/world-editor-localization-inventory-20261002.json').split('\t')[0],'M');
for(const [file,blob] of orig){
 assert.equal(git('rev-parse',SOURCE+':'+file),blob,'Fixed original blob '+file);
 assert.equal(git('hash-object',file),blob,'Never modified original Source '+file);
}
assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/lib/wep/local-scene-preset-store.mjs',
 'src/lib/wep/scene-capture-runtime.ts','src/lib/wep/scene-preset-runtime.ts',
 'src/routes/presets','src/routes/moodboards','src/lib/community','src/lib/presets',
 'crates','supabase','static','.github/workflows/pages.yml'),'',
 'No changes to accepted Store/Reader, account, Native or public Pages');
const route=readFileSync('src/routes/editor/world/+page.svelte','utf8');
assert.match(route,/const fresh = await readLocalSceneById\(String\(selected\.id\)\)/);
assert.match(route,/fresh\.revision !== localSceneRevision/);
assert.match(route,/JSON\.stringify\(fresh\.entry\.artifact\) !== JSON\.stringify\(selected\.artifact\)/);
assert.match(route,/data-wep-local-scene-reuse/);
assert.match(route,/data-wep-local-scene-draft data-apply="off" data-editor-mutation="off"/);
assert.match(route,/on:click=\{prepareLocalSceneReuseDraft\}/);
assert.match(route,/writeReady=false \/ applyReady=false/);
const inventory=JSON.parse(readFileSync('docs/wep/world-editor-localization-inventory-20261002.json','utf8'));
assert.equal(inventory.sourcePins['src/routes/editor/world/+page.svelte'],
 orig.get('src/routes/editor/world/+page.svelte'));
console.log('QRW867_ORIGINAL7_BLOBS_AUDIT_ONLY2_INVENTORY_PIN_MAIN_BASED_PASS');

// Changed-only new TS projector: deliberately varied local geometry and
// untrusted identities, rather than repeating accepted Scene codec/store.
const editor={
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'qaw-readonly'},
 objects:[
 {editorId:'qa-editor-a',itemId:40000049,layer:'furniture',x:4,y:5,orientation:0,
  footprint:[{x:0,y:0},{x:1,y:0}],portableState:null,dependencyIds:[],
  editability:'editable',source:null},
 {editorId:'qa-editor-b',itemId:40000050,layer:'furniture',x:8,y:7,orientation:3,
  footprint:[{x:0,y:0}],portableState:null,dependencyIds:[],
  editability:'editable',source:null}
 ]};
const capture=()=>captureScenePreset(editor,{
 selectionIds:['qa-editor-a','qa-editor-b'],includeRoads:false,includeFences:false,
 title:'New detached QA only'},validatePublishablePreset).artifact;
const sceneId='scene_11111111-1111-4111-8111-111111111111';
const project=artifact=>buildReadonlyLocalSceneReuseDraft({
 sceneId,sourceRevision:7,artifact});
const valid=capture();
const prior=JSON.stringify(valid);
const draft=project(valid);
assert.equal(JSON.stringify(valid),prior,'Projector must not mutate input');
assert.equal(draft.operation,WEP_LOCAL_SCENE_REUSE_OPERATION);
assert.equal(draft.sourceRevision,7);assert.equal(draft.sceneId,sceneId);
assert.equal(draft.objects.length,2);
assert.equal(draft.objects[0].editability,'readonly');
assert.equal(draft.objects[0].x,0);
assert.equal(draft.objects[0].y,0);
assert.equal(draft.objects[1].x,4);
assert.equal(draft.objects[1].y,2);
assert.deepEqual(draft.objects[0].footprint,[{x:0,y:0},{x:1,y:0}]);
for(const k of ['localOnly','detachedFromEditorSession'])assert.equal(draft[k],true,k);
for(const k of ['inventoryVerified','nativePlacementAuthorized','editorMutationAuthorized','writeReady','applyReady'])
 assert.equal(draft[k],false,k);
for(const k of ['destinationGridId','command','editorId','gridId','subGridId','areaId'])
 assert.equal(Object.hasOwn(draft,k),false,k);
assert.equal(JSON.stringify(draft).includes('qa-editor-a'),false);
assert.equal(JSON.stringify(draft).includes('qa-editor-b'),false);
console.log('QRW867_DETACHED_READONLY_LOCAL_BOUNDS_FOOTPRINT_NO_EDITOR_NATIVE_ID_PASS',
 JSON.stringify({bounds:draft.bounds,objects:draft.objects.map(o=>({id:o.artifactObjectId,x:o.x,y:o.y,footprint:o.footprint}))}));
function negative(label,mutate){
 const a=structuredClone(valid);
 mutate(a);
 assert.throws(()=>project(a),/WEP_SCENE_REUSE_|WEP_SCENE_/,'fail closed '+label);
}
for(const [label,mutate] of [
 ['object footprint out of local bounds',a=>{a.objects[0].footprint=[{x:5000,y:0}];}],
 ['negative local coordinate',a=>{a.objects[0].localX=-1;}],
 ['fractional coordinate',a=>{a.objects[0].localY=0.5;}],
 ['oversized local bounds',a=>{a.bounds.w=4097;}],
 ['unexpected Native GridID',a=>{a.objects[0].gridId=412;}],
 ['unknown source object ID',a=>{a.objects[0].sourceGridObjectId='forged-object';}],
 ['unknown SubGrid payload',a=>{a.objects[0].portableState={codec:'unknown.subgrid',payload:{}};}],
 ['Road topology',a=>{a.requirements.roadTopology=true;}],
 ['Fence topology',a=>{a.requirements.fenceTopology=true;}],
 ['unknown Road networks',a=>{a.networks.roads={networks:[{id:'hidden'}]};}],
 ['unknown Fence networks',a=>{a.networks.fences={networks:[{id:'hidden'}]};}],
 ['unknown layer',a=>{a.objects[0].layer='road';}]
])negative(label,mutate);
for(const args of [
 {sceneId:'native:42',sourceRevision:7,artifact:valid},
 {sceneId,sourceRevision:0,artifact:valid},
 {sceneId,sourceRevision:-1,artifact:valid},
 {sceneId,sourceRevision:7.5,artifact:valid}
])assert.throws(()=>buildReadonlyLocalSceneReuseDraft(args),/WEP_SCENE_REUSE_SOURCE_IDENTITY_INVALID/);
for(const loc of LOCAL_SCENE_PRESET_LOCALES){
 const c=localScenePresetCopy(loc);
 for(const field of ['reuse','reuseReady','reuseBlocked'])
 assert.ok(typeof c[field]==='string'&&c[field].length>3,loc+'/'+field);
}
assert.equal(LOCAL_SCENE_PRESET_LOCALES.length,8);
console.log('QRW867_BOUNDS_NATIVE_GRID_SUBGRID_ROAD_FENCE_REVISION_BAD_ID_DENIED_PASS');

const origin=process.env.QRW867_ORIGIN;
assert.match(origin??'',/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'Installed Chrome required');
assert.ok(!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH,'No Private P1G');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:900},
 serviceWorkers:'block',acceptDownloads:false});
const errors=[],outbound=[];
context.on('request',r=>{
 if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))
  outbound.push(r.method()+' '+r.url());
});
const oldKey='dreamwishwand:moodboards:v1';
const oldBackup='dreamwishwand:moodboards:v1:backup';
const now='2026-11-09T00:00:00Z';
const oldRaw=JSON.stringify({schema:'wand.moodboards.local@1',version:2,updatedAt:now,
 boards:[{id:'qaw-867-old-board',title:'Old untouched board',description:null,
  createdAt:now,updatedAt:now,
  groups:[{id:'g',title:'G',order:0,collapsed:false}],
  references:[{id:'r',type:'ITEM',label:'Stage1 Furniture',entityId:'40000048',
   groupIds:['g'],createdAt:now,note:null,url:null}]}]});
const oldRawBackup='{"previous":"exact-old-legacy-backup"}';
const syntheticDoc={schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'qa-draft-only'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
 {editorId:'ui-a',itemId:40000049,layer:'furniture',x:4,y:5,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',
  metadata:{displayName:'QA A',worldClass:'FurnitureItemData'}},
 {editorId:'ui-b',itemId:40000050,layer:'furniture',x:8,y:7,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',
  metadata:{displayName:'QA B',worldClass:'FurnitureItemData'}}
 ]};
const state=async page=>page.evaluate(([k,b])=>
 ({primary:localStorage.getItem(k),backup:localStorage.getItem(b)}),[oldKey,oldBackup]);
const rawScene=async page=>page.evaluate(async()=>{
 const request=indexedDB.open('dreamwishwand:wep:scene-presets:local:v1',1);
 const db=await new Promise((resolve,reject)=>{
  request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('NO_QA_DB_CREATION'));};
  request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);
 });
 try{
  const tx=db.transaction('snapshots','readonly'),r=tx.objectStore('snapshots').get('library');
  return await new Promise((resolve,reject)=>{
   tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close();}
});
async function openEditor(){
 const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
 const response=await p.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded',timeout:40000});
 assert.equal(response.status(),200);
 await p.evaluate(([k,b,x,y])=>{
  if(!localStorage.getItem(k))localStorage.setItem(k,x);
  if(!localStorage.getItem(b))localStorage.setItem(b,y);
 },[oldKey,oldBackup,oldRaw,oldRawBackup]);
 await p.reload({waitUntil:'domcontentloaded'});
 await p.getByRole('button',{name:'Open in World Editor'}).click();
 await p.waitForURL(/\/editor\/world\/?$/,{timeout:32000});
 await p.locator('[data-wep-decorate-stage1] .reference-main')
  .filter({hasText:'Stage1 Furniture'}).click();
 await p.locator('.load-panel input[type=file]').setInputFiles({
  name:'qa867-synthetic-only.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(syntheticDoc))
 });
 await p.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:32000});
 return p;
}
async function captureSave(p,id,title){
 await p.locator('[data-editor-object-id="'+id+'"]').click();
 await p.locator('.capture-panel input').first().fill(title);
 await p.getByRole('button',{name:'Capture Preview'}).click();
 await p.locator('[data-wep-local-scene-save]:not([disabled])').waitFor({timeout:25000});
 await p.locator('[data-wep-local-scene-save]').click();
 await p.locator('[data-wep-local-scene-status]')
 .filter({hasText:'saved and independently reopened'}).waitFor({timeout:26000});
}
try{
 const p=await openEditor();
 // Accepted underlying Save/Read provides fixture only; new assertions start at
 // user click prepare detached reuse, NOT a repeated old Save/CAS acceptance.
 await captureSave(p,'ui-a','Detached QA First');
 const before=await rawScene(p);
 const editorBefore=await p.locator('[data-editor-object-id]').evaluateAll(e=>
  e.map(x=>({id:x.getAttribute('data-editor-object-id'),
             selected:x.classList.contains('selected')})));
 await p.locator('[data-wep-local-scene-read]').first().click();
 assert.equal(await p.locator('[data-wep-local-scene-draft]').count(),0,
  'passive row selection cannot auto create Draft');
 const reuse=p.locator('[data-wep-local-scene-reuse]');
 await reuse.focus();assert.equal(await reuse.evaluate(x=>x===document.activeElement),true);
 await p.keyboard.press('Enter');
 const draftPanel=p.locator('[data-wep-local-scene-draft]');
 await draftPanel.waitFor({timeout:26000});
 assert.equal(await draftPanel.getAttribute('data-apply'),'off');
 assert.equal(await draftPanel.getAttribute('data-editor-mutation'),'off');
 assert.match(await draftPanel.innerText(),/writeReady=false \/ applyReady=false/);
 assert.match(await draftPanel.innerText(),/40000049/);
 assert.deepEqual(await rawScene(p),before,'new detached readonly Draft cannot write IDB');
 assert.deepEqual(await state(p),{primary:oldRaw,backup:oldRawBackup});
 assert.deepEqual(await p.locator('[data-editor-object-id]').evaluateAll(e=>
  e.map(x=>({id:x.getAttribute('data-editor-object-id'),
             selected:x.classList.contains('selected')}))),editorBefore,
  'detached Draft must not mutate real Editor selection/objects');
 console.log('QRW867_EXPLICIT_KEYBOARD_DETACHED_DRAFT_LOCAL_ONLY_EDITOR_AND_IDB_INTACT_PASS');
 for(const loc of LOCAL_SCENE_PRESET_LOCALES){
  await p.locator('#site-locale').selectOption(loc);
  await p.waitForFunction(text=>document.querySelector('[data-wep-local-scene-reuse]')?.textContent?.trim()===text,
   localScenePresetCopy(loc).reuse);
  assert.ok((await p.locator('[data-wep-local-scene-draft]').getAttribute('aria-label'))?.length>0);
 }
 await p.locator('#site-locale').selectOption('en');
 for(const [w,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width:w,height:900});
  await p.evaluate(z=>document.documentElement.style.zoom=z,zoom);
  const m=await p.locator('[data-wep-local-scene]').evaluate(el=>
   ({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(m.scroll<=m.client+2,'new F-P04 UI horizontal overflow '+w+' '+zoom+' '+JSON.stringify(m));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 console.log('QRW867_REUSE_DRAFT_EIGHT_LOCALES_320_CSS200_RESPONSIVE_PASS');

 const stale=await openEditor();
 await stale.locator('[data-wep-local-scene-reopen]').click();
 await stale.locator('[data-wep-local-scene-read]').first().waitFor({timeout:26000});
 await stale.locator('[data-wep-local-scene-read]').first().click();
 assert.equal(await stale.locator('[data-wep-local-scene-reuse]').count(),1);
 await captureSave(p,'ui-b','Detached QA Second');
 const after=await rawScene(p);
 assert.equal(after.revision,2);
 assert.equal(after.backup,before.primary);
 await stale.locator('[data-wep-local-scene-reuse]').click();
 await stale.locator('[data-wep-local-scene-reuse-status]').filter({hasText:'Draft denied'})
  .waitFor({timeout:26000});
 assert.equal(await stale.locator('[data-wep-local-scene-draft]').count(),0);
 assert.deepEqual(await rawScene(stale),after,'stale new Draft must never overwrite Store');
 await stale.locator('[data-wep-local-scene-reopen]').click();
 await stale.locator('[data-wep-local-scene-read]').nth(1).waitFor({timeout:18000});
 await stale.locator('[data-wep-local-scene-read]').nth(1).click();
 await stale.locator('[data-wep-local-scene-reuse]').click();
 await stale.locator('[data-wep-local-scene-draft]').waitFor({timeout:26000});
 assert.deepEqual(await rawScene(stale),after,'fresh new Draft read only');
 console.log('QRW867_STALE_SOURCE_REVISION_DENY_FRESH_REOPEN_ALLOW_NO_STORAGE_WRITE_PASS');

 assert.deepEqual(await state(p),{primary:oldRaw,backup:oldRawBackup});
 assert.deepEqual(outbound,[],'No Native Apply/POST/offorigin requests');
 assert.deepEqual(errors,[],'No unhandled Chrome page errors');
 console.log('QRW867_INDEPENDENT_SOURCE7_CHANGED_ONLY_NODE_CHROME_SCOPED_PASS');
}finally{await context.close();await browser.close();}
