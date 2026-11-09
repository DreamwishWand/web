// 04 QR-W PR859 independent changed-7 QA (not accepted Capture/Atomic Board regression).
// New scope: local Scene Preset user-only IDB create/CAS/Backup/independent readonly reopen.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {localScenePresetCopy,LOCAL_SCENE_PRESET_LOCALES} from '../src/lib/wep/local-scene-preset-copy.js';
import {saveLocalScene,reopenLocalScenes,readLocalSceneById,
 WEP_LOCAL_SCENE_DB,WEP_LOCAL_SCENE_STORE,WEP_LOCAL_SCENE_OPERATION}
 from '../src/lib/wep/local-scene-preset-store.mjs';
import {captureScenePreset} from '../src/lib/wep/scene-capture-runtime.ts';
import {validatePublishablePreset,preflightScene} from '../src/lib/wep/scene-preset-runtime.ts';
const SOURCE='fccfe620867688c9e90ace46b5746746a3583793';
const MAIN='340461f4a2960f8033fc13be9d5eaef8554d252d';
const own=new Map([
 ['.github/workflows/wep-local-scene-preset.yml','8e78636963b6a34db77fb25a15d1b241c98549dd'],
 ['docs/wep/world-editor-localization-inventory-20261002.json','1fb1d6c4bf29131ba65555725baadec67c8a4739'],
 ['scripts/wep-local-scene-preset-chrome.mjs','aa4c7a3243ddf9e41272e77d980b5bf9e1faf70d'],
 ['src/lib/wep/local-scene-preset-copy.js','458c6afd1071f9628ae739b0b189dbdaec807df2'],
 ['src/lib/wep/local-scene-preset-store.mjs','1a467715b7a81475d52cb6e7336eaec9c46f4c78'],
 ['src/routes/editor/world/+page.svelte','577aa886e3ff89066b4b38e38193aa27e4dc3028'],
 ['tests/wep-local-scene-preset-cas.test.mjs','7c455f822cfd945d922ef80f6ec58b3a65f92184']
]);
const audits=[
 '.github/workflows/04qr-w-pr859-local-scene-newonly-20261109.yml',
 'scripts/04qr-w-pr859-local-scene-newonly-20261109.mjs'
];
const git=(...x)=>execFileSync('git',x,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(MAIN,SOURCE),[...own.keys()].sort());
assert.deepEqual(diff(SOURCE,'HEAD'),audits.sort());
for(const [file,blob] of own){
 assert.equal(git('rev-parse',SOURCE+':'+file),blob,'SOURCE BLOB '+file);
 assert.equal(git('hash-object',file),blob,'UNMODIFIED SOURCE '+file);
}
assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/lib/moodboards','src/lib/collection',
 'src/lib/wep/scene-capture-runtime.ts','src/lib/wep/scene-preset-runtime.ts',
 'src/routes/presets','src/routes/moodboards','src/lib/wep/world-editor-atomic-board-guard.mjs',
 'crates','supabase','static','.github/workflows/pages.yml'),'');
const pageSrc=readFileSync('src/routes/editor/world/+page.svelte','utf8');
assert.match(pageSrc,/on:click=\{saveLocalSceneCapture\}/);
assert.match(pageSrc,/on:click=\{reopenLocalSceneLibrary\}/);
assert.match(pageSrc,/on:click=\{\(\) => previewLocalScene\(savedScene\.id\)\}/);
assert.match(pageSrc,/expectedRevision: localSceneRevision/);
assert.match(pageSrc,/await verifiedReopenLocalScene\(receipt\)/);
assert.match(pageSrc,/data-wep-local-scene.*data-save-writer="off"/s);
assert.equal(WEP_LOCAL_SCENE_OPERATION,'WEP_SCENE_PRESET_LOCAL_IDB_CAS_BACKUP_REOPEN_READONLY');
assert.equal(WEP_LOCAL_SCENE_DB,'dreamwishwand:wep:scene-presets:local:v1');
assert.equal(WEP_LOCAL_SCENE_STORE,'snapshots');
assert.deepEqual([...LOCAL_SCENE_PRESET_LOCALES],['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']);
console.log('QRW859_FROZEN_SOURCE7_QA_ONLY2_NO_ACCEPTED_ANCESTOR_DIFF_PASS');

// Independent negative Node cases: never open/create IDB if artifact not legal.
const syntheticDoc={
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'QA only'},
 objects:[{editorId:'qa-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,
  footprint:[{x:0,y:0}],portableState:null,dependencyIds:[],editability:'editable'}]
};
const good=captureScenePreset(syntheticDoc,{selectionIds:['qa-a'],includeRoads:false,
 includeFences:false,title:'Valid minimal'},validatePublishablePreset);
assert.equal(good.publicationReady,true);
assert.equal(preflightScene(good.artifact).writeReady,false);
for(const [description,mutate] of [
 ['foreign Source EditorID',a=>{a.objects[0].editorId='forged-native-editor-id';}],
 ['forged native GridID',a=>{a.objects[0].gridId=666;}],
 ['untrusted SourceGridID',a=>{a.objects[0].sourceGridId=666;}],
 ['fake SubGridId',a=>{a.objects[0].subGridId=666;}],
 ['unknown SubGrid child codec',a=>{a.objects[0].portableState={codec:'unknown-native-subgrid',child:{}};}],
 ['Road topology requested',a=>{a.requirements.roadTopology=true;}],
 ['Fence topology requested',a=>{a.requirements.fenceTopology=true;}],
 ['unknown Road data',a=>{a.networks.roads={schema:'unknown'};}],
 ['unknown Fence data',a=>{a.networks.fences={schema:'unknown'};}]
]){
 let touched=0;
 const factory={open(){touched++;throw Error('QA_MUST_NOT_OPEN_IDB');}};
 const artifact=structuredClone(good.artifact);mutate(artifact);
 await assert.rejects(saveLocalScene({factory,artifact,title:'Blocked',expectedRevision:0,
  idFactory:()=> '00000000-0000-4000-8000-000000000001'}),error=>{
  if(/QA_MUST_NOT_OPEN_IDB/.test(String(error)))return false;
  return true;
 },'BAD ARTIFACT MUST FAIL BEFORE IDB '+description);
 assert.equal(touched,0,description);
}
console.log('QRW859_FORGED_GRID_EDITOR_SUBGRID_NETWORK_AUTHORITY_DENIED_BEFORE_IDB_PASS');

const origin=process.env.QRW859_ORIGIN||'';
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'INSTALLED_BROWSER_REQUIRED');
assert.ok(!process.env.DDV_PRIVATE_SAVE_PATH&&!process.env.WEP_PRIVATE_P1G_PATH,'NO_PRIVATE_SAVE');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
const errors=[],outbound=[];
context.on('request',request=>{
 const u=new URL(request.url());
 if(u.origin!==origin||!['GET','HEAD'].includes(request.method()))
  outbound.push(request.method()+' '+request.url());
});
const oldKey='dreamwishwand:moodboards:v1',oldBackup='dreamwishwand:moodboards:v1:backup';
const now='2026-11-09T00:00:00.000Z';
const oldPrimary=JSON.stringify({schema:'wand.moodboards.local@1',version:2,updatedAt:now,
 boards:[{id:'qa-preserved-board',title:'No automatic migration',description:null,createdAt:now,updatedAt:now,
  groups:[{id:'g',title:'old group',order:0,collapsed:false}],references:[{id:'r',type:'ITEM',label:'Stage1 Furniture',entityId:'40000048',groupIds:['g'],createdAt:now,note:null,url:null}]}]});
const oldBackupRaw='{"old":"moodboard-backup-sentinel"}';
const fixture={schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'local-qa-only'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
 {editorId:'qa-scene-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',
  metadata:{displayName:'QA A',worldClass:'FurnitureItemData'}},
 {editorId:'qa-scene-b',itemId:40000050,layer:'furniture',x:4,y:2,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',
  metadata:{displayName:'QA B',worldClass:'FurnitureItemData'}}
 ]};
function attach(page){page.on('pageerror',e=>errors.push(String(e)));}
const dbStatus=async page=>page.evaluate(async name=>{
 const l=await indexedDB.databases();
 return l.filter(x=>x.name===name).map(x=>({name:x.name,version:x.version}));
},WEP_LOCAL_SCENE_DB);
const readRaw=async page=>page.evaluate(async([dbName,store,key])=>{
 const db=await new Promise((resolve,reject)=>{
  const request=indexedDB.open(dbName,1);
  request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('NO_QA_DB_CREATED'));};
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>resolve(request.result);
 });
 try{
  const tx=db.transaction(store,'readonly'),get=tx.objectStore(store).get(key);
  return await new Promise((resolve,reject)=>{
   tx.oncomplete=()=>resolve(get.result);
   tx.onabort=()=>reject(tx.error);
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close();}
},[WEP_LOCAL_SCENE_DB,WEP_LOCAL_SCENE_STORE,'library']);
const oldRaw=async page=>page.evaluate(([key,backup])=>({
 primary:localStorage.getItem(key),backup:localStorage.getItem(backup)
}),[oldKey,oldBackup]);
async function openEditor(){
 const p=await context.newPage();attach(p);
 let res=await p.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);
 await p.evaluate(([k,b,v,w])=>{if(localStorage.getItem(k)==null)localStorage.setItem(k,v);
  if(localStorage.getItem(b)==null)localStorage.setItem(b,w);
 },[oldKey,oldBackup,oldPrimary,oldBackupRaw]);
 await p.reload({waitUntil:'domcontentloaded'});
 await p.getByRole('button',{name:'Open in World Editor'}).click();
 await p.waitForURL(/\/editor\/world\/?$/);
 await p.locator('[data-wep-decorate-stage1] .reference-main').filter({hasText:'Stage1 Furniture'}).click();
 await p.locator('.load-panel input[type=file]').setInputFiles({
  name:'wep-qrw859-synthetic-local.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(fixture))
 });
 await p.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:32000});
 return p;
}
const idbPatch=async(page,key,raw)=>page.evaluate(async({name,storeName,key,value})=>{
 const db=await new Promise((resolve,reject)=>{
  const open=indexedDB.open(name,1);
  open.onupgradeneeded=()=>{open.transaction?.abort();reject(Error('QA_UNEXPECTED_IDB_CREATION'));};
  open.onerror=()=>reject(open.error);open.onsuccess=()=>resolve(open.result);
 });
 try{
  const tx=db.transaction(storeName,'readwrite'),object=tx.objectStore(storeName),req=object.get('library');
  req.onsuccess=()=>{const existing=req.result;if(!existing)throw Error('QA_MISSING_EXISTING_ROW');
   object.put({...existing,[key]:value},'library');
  };
  await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});
 }finally{db.close();}
}, {name:WEP_LOCAL_SCENE_DB,storeName:WEP_LOCAL_SCENE_STORE,key,value:raw});
try {
 const a=await openEditor();
 assert.deepEqual(await dbStatus(a),[],'Scene namespace absent before user Save');
 await a.locator('[data-wep-local-scene-reopen]').click();
 await a.locator('[data-wep-local-scene-status]').filter({hasText:'No local Scene Presets'}).waitFor({timeout:18000});
 assert.deepEqual(await dbStatus(a),[],'read-only Reopen must not create IndexedDB when absent');
 assert.deepEqual(await oldRaw(a),{primary:oldPrimary,backup:oldBackupRaw});
 console.log('QRW859_ABSENT_IDB_READONLY_REOPEN_NO_DB_CREATION_NO_LEGACY_MIGRATION_PASS');
 const b=await openEditor(); // second tab starts at revision0; no implicit Reopen authority.
 const capture=async(page,id,title)=>{
  await page.locator('[data-editor-object-id="'+id+'"]').click();
  await page.locator('.capture-panel input').first().fill(title);
  await page.getByRole('button',{name:'Capture Preview'}).click();
  await page.locator('[data-wep-local-scene-save]:not([disabled])').waitFor({timeout:24000});
 };
 await capture(a,'qa-scene-a','Independent first');
 assert.deepEqual(await dbStatus(a),[],'Capture Preview must not create Scene IDB');
 assert.equal(await a.locator('[data-wep-local-scene]').getAttribute('data-save-writer'),'off');
 assert.equal(await a.locator('[data-wep-local-scene]').getAttribute('data-cloud'),'off');
 for(const loc of LOCAL_SCENE_PRESET_LOCALES){
  await a.evaluate(l=>{const el=document.querySelector('#site-locale');
   if(!el)throw Error('LOCALE_SELECTOR_MISSING');
   el.value=l;el.dispatchEvent(new Event('change',{bubbles:true}));},loc);
  await a.waitForFunction(title=>
   document.querySelector('#wep-local-scene-title')?.textContent?.trim()===title,
   localScenePresetCopy(loc).title);
  assert.equal((await a.locator('[data-wep-local-scene-save]').textContent()).trim(),
   localScenePresetCopy(loc).save);
  assert.match((await a.locator('[data-wep-local-scene] p').first().textContent()).trim(),
   /IndexedDB/);
 }
 await a.evaluate(()=>{const el=document.querySelector('#site-locale');
  el.value='en';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await a.waitForFunction(()=>document.querySelector('#wep-local-scene-title')?.textContent==='Local Scene Presets');
 await a.setViewportSize({width:320,height:850});
 let layout=await a.locator('[data-wep-local-scene]').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
 assert.ok(layout.scroll<=layout.client+2,'new Scene UI 320px overflow '+JSON.stringify(layout));
 await a.setViewportSize({width:640,height:850});
 await a.evaluate(()=>{document.documentElement.style.zoom='2';});
 layout=await a.locator('[data-wep-local-scene]').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
 assert.ok(layout.scroll<=layout.client+2,'new Scene UI zoom200 overflow '+JSON.stringify(layout));
 await a.evaluate(()=>{document.documentElement.style.zoom='1';});
 await a.setViewportSize({width:1440,height:900});
 console.log('QRW859_EIGHT_LOCALE_320_ZOOM200_EXPLICIT_CAPTURE_NO_AUTO_DB_PASS');
 const save=a.locator('[data-wep-local-scene-save]');
 await save.focus();assert.equal(await save.evaluate(el=>el===document.activeElement),true);
 await a.keyboard.press('Enter');
 await a.locator('[data-wep-local-scene-status]').filter({hasText:'saved and independently reopened'}).waitFor({timeout:30000});
 const one=await readRaw(a);
 assert.equal(one.revision,1);assert.equal(one.backupRevision,0);
 const doc=JSON.parse(one.primary),before=JSON.parse(one.backup);
 assert.equal(doc.entries.length,1);assert.equal(before.entries.length,0);
 assert.equal(doc.entries[0].artifact.type,'scene');
 assert.equal(doc.entries[0].artifact.objects[0].artifactObjectId,'o0');
 assert.equal(JSON.stringify(doc).includes('qa-scene-a'),false,'Native-like EditorID never stored');
 assert.deepEqual(await oldRaw(a),{primary:oldPrimary,backup:oldBackupRaw});
 console.log('QRW859_EXPLICIT_KEYBOARD_ONE_ATOMIC_PRIMARY_BACKUP_NO_NATIVE_ID_PASS');

 await capture(b,'qa-scene-a','stale concurrent tab');
 await b.locator('[data-wep-local-scene-save]').click();
 await b.locator('[data-wep-local-scene-status]').filter({hasText:'unavailable or changed'}).waitFor({timeout:24000});
 assert.deepEqual(await readRaw(a),one,'stale tab must not overwrite both row values');
 await capture(a,'qa-scene-b','Independent second');
 await a.locator('[data-wep-local-scene-save]').click();
 await a.locator('[data-wep-local-scene-status]').filter({hasText:'saved and independently reopened'}).waitFor({timeout:30000});
 const two=await readRaw(a);
 assert.equal(two.revision,2);assert.equal(two.backupRevision,1);
 assert.equal(two.backup,one.primary,'CAS Backup exact previous primary bytes');
 assert.equal(JSON.parse(two.primary).entries.length,2);
 await b.locator('[data-wep-local-scene-reopen]').click();
 await b.locator('[data-wep-local-scene-read]').first().waitFor({timeout:30000});
 assert.equal(await b.locator('[data-wep-local-scene-read]').count(),2);
 await b.locator('[data-wep-local-scene-read]').first().click();
 await b.locator('[data-wep-local-scene-preview]').waitFor();
 assert.match(await b.locator('[data-wep-local-scene-preview] code').innerText(),/writeReady=false/);
 assert.deepEqual(await readRaw(b),two);
 console.log('QRW859_TWO_TAB_STALE_CAS_EXACT_BACKUP_SECOND_TRANSACTION_READONLY_PASS');

 // Separate readonly reopen on a third tab and fresh reader. No native placement.
 const fresh=await openEditor();
 await fresh.locator('[data-wep-local-scene-reopen]').click();
 await fresh.locator('[data-wep-local-scene-read]').first().waitFor({timeout:30000});
 await fresh.locator('[data-wep-local-scene-read]').first().click();
 await fresh.locator('[data-wep-local-scene-preview]').waitFor({timeout:18000});
 assert.match(await fresh.locator('[data-wep-local-scene-preview] code').innerText(),/writeReady=false/);
 assert.deepEqual(await readRaw(fresh),two);
 assert.deepEqual(await oldRaw(fresh),{primary:oldPrimary,backup:oldBackupRaw});
 console.log('QRW859_FRESH_TAB_SEPARATE_READONLY_REOPEN_NO_STORE_MUTATION_PASS');

 // New negative: deliberate corrupted PRIMARY & then BACKUP, preserving exact bytes.
 // The accepted feature must block reads, never heal, auto overwrite or claim Saved.
 await idbPatch(a,'primary','{BROKEN_PRIMARY');
 let broken=await readRaw(a);assert.equal(broken.primary,'{BROKEN_PRIMARY');
 await fresh.locator('[data-wep-local-scene-reopen]').click();
 await fresh.locator('[data-wep-local-scene-status]').filter({hasText:'unavailable or changed'}).waitFor({timeout:21000});
 assert.deepEqual(await readRaw(a),broken,'read-only corrupt primary must not mutate');
 await idbPatch(a,'primary',two.primary);
 assert.deepEqual(await readRaw(a),two,'QA restored exact prior snapshot before next negative');
 await idbPatch(a,'backup','{BROKEN_BACKUP');
 broken=await readRaw(a);assert.equal(broken.backup,'{BROKEN_BACKUP');
 await fresh.locator('[data-wep-local-scene-reopen]').click();
 await fresh.locator('[data-wep-local-scene-status]').filter({hasText:'unavailable or changed'}).waitFor({timeout:21000});
 assert.deepEqual(await readRaw(a),broken,'read-only corrupt backup must not mutate');
 await idbPatch(a,'backup',two.backup);
 assert.deepEqual(await readRaw(a),two,'QA restore original row after corruption experiments');
 assert.equal((await fresh.locator('[data-wep-local-scene-preview]').count()),0,'no corrupted Scene preview');
 assert.deepEqual(await oldRaw(a),{primary:oldPrimary,backup:oldBackupRaw});
 assert.deepEqual(await oldRaw(fresh),{primary:oldPrimary,backup:oldBackupRaw});
 assert.deepEqual(outbound,[],'no offorigin/POST');
 assert.deepEqual(errors,[],'no uncaught browser page errors');
 console.log('QRW859_PRIMARY_BACKUP_CORRUPTION_READONLY_FAILCLOSED_NO_REPAIR_NO_OUTBOUND_PASS');
 console.log('QRW859_INDEPENDENT_SOURCE7_NODE_AND_INSTALLED_CHROME_SCOPED_PASS');
}finally{await context.close();await browser.close();}
