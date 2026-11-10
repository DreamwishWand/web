// 04 QR-W independent PR879 NEW original seven only. No accepted ancestor reQA.
// True Switch1250 SHA-pinned static Catalog + Geometry, disposable Chrome Scene.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {loadCollectionRuntime} from '../src/lib/collection/runtime.js';
import {buildSharedCatalogDirectory} from '../src/lib/entity/shared-catalog-directory.mjs';
import {createSwitchWorldReadAdapter} from '../src/lib/wep/world-browser-adapter.ts';
import {validatePublishablePreset} from '../src/lib/wep/scene-preset-runtime.ts';
import {resolveVerifiedSaveFreeSceneItem,buildSaveFreeFirstNonemptyScene,
  SAVEFREE_SCENE_LOCALES,saveFreeSceneCopy,
  WEP_SAVEFREE_FIRST_SCENE_OPERATION} from '../src/lib/wep/savefree-first-scene.ts';
const MAIN='8d6e35adbdedc3b44e1a9a498d65da7af9c3273f';
const SOURCE='d33e52b49857bfea5856698f3f6a5c6b94f52c1c';
const original=new Map([
 ['.github/workflows/wep-savefree-first-scene.yml','d0f53d37099d288a1adf802513fd4b8a808277bf'],
 ['docs/wep/world-editor-localization-inventory-20261002.json','d7d40459af6d4564f61baee68c3a0a59784eb21c'],
 ['scripts/wep-savefree-first-scene-chrome.mjs','20f8ccf845c2b56bd8a3dee07b75b71db206483b'],
 ['src/lib/wep/SaveFreeFirstScene.svelte','b5a3610a1e9950bd5dd5be30960ef8820ff0f66b'],
 ['src/lib/wep/savefree-first-scene.ts','d81f39dd9cfc50bf4360b058f8f605d9056c3845'],
 ['src/routes/editor/world/+page.svelte','fa06ea35ca12973b056887acc28930f3952f3810'],
 ['tests/wep-savefree-first-scene.test.mjs','3dbbf47ab7d855b537ec3c8d3d8eb8b774e4f981']
]);
const audits=[
 '.github/workflows/04qr-w-pr879-savefree-first-nonempty-new7-20261110.yml',
 'scripts/04qr-w-pr879-savefree-first-nonempty-new7-20261110.mjs'
];
const git=(...x)=>execFileSync('git',x,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(MAIN,SOURCE),[...original.keys()].sort());
assert.deepEqual(diff(SOURCE,'HEAD'),audits.sort());
assert.deepEqual(git('diff','--name-status',SOURCE,'HEAD').split('\n').filter(Boolean).sort(),
 audits.map(x=>'A\t'+x).sort());
for(const [p,b] of original){
 assert.equal(git('rev-parse',SOURCE+':'+p),b);
 assert.equal(git('hash-object',p),b);
}
assert.equal(git('rev-parse',MAIN+':docs/wep/world-editor-localization-inventory-20261002.json'),
 'f6dc00a6a835afdf078a2de1c4c98234f270f38b','TRUE main rollback Blob');
assert.equal(git('rev-parse',MAIN+':src/routes/editor/world/+page.svelte'),
 '7c2a0d25aa97588b7753a1231e7627b0489aede7');
assert.equal(git('diff','--name-only',MAIN,SOURCE,'--','src/lib/wep/local-scene-preset-store.mjs',
 'src/lib/wep/scene-preset-runtime.ts','src/lib/wep/scene-capture-runtime.ts',
 'src/lib/collection','src/lib/wep/world-browser-adapter.ts','src/routes/presets',
 'src/lib/wep/local-scene-reuse-readonly.ts','crates','supabase','static'),'');
const manifest=JSON.parse(readFileSync('docs/wep/world-editor-localization-inventory-20261002.json','utf8'));
for(const p of ['src/routes/editor/world/+page.svelte',
 'src/lib/wep/SaveFreeFirstScene.svelte','src/lib/wep/savefree-first-scene.ts'])
 assert.equal(manifest.sourcePins[p],original.get(p));
console.log('QRW879_NEW_SOURCE7_BLOB_PIN_OLD_INVENTORY_ROLLBACK_QA2_ONLY_PASS');

// Independent real Catalog/Geometry source verification without fake Item data.
const root=new URL('../',import.meta.url);
const staticFetch=async url=>{
 const path=new URL(String(url),'https://wand.invalid').pathname;
 return new Response(await readFile(new URL('./static'+path,root)),{status:200});
};
const [catalog,binding]=await Promise.all([
 loadCollectionRuntime('',staticFetch),
 createSwitchWorldReadAdapter({basePath:'',fetchImpl:staticFetch})
]);
const dir=buildSharedCatalogDirectory(catalog.index,catalog.rows,'en');
assert.equal(catalog.index.t.buildID,'52BD625D9B4E0053');
assert.equal(catalog.rows.length,12552);
assert.equal(dir.status,'READY');
assert.equal(binding.source.gameVersion,'1.25.0');
assert.equal(binding.source.profileSchemaVersion,624);
const item=resolveVerifiedSaveFreeSceneItem(dir,binding,40000047);
assert.deepEqual(item.bounds,{w:3,h:2});
assert.deepEqual(Array.from(item.footprint).sort((a,b)=>a.y-b.y||a.x-b.x),
 Array.from({length:6},(_,i)=>({x:i%3,y:Math.floor(i/3)})));
assert.equal(item.inventoryVerified,false);
assert.equal(item.writeReady,false);
assert.equal(item.applyReady,false);
const built=buildSaveFreeFirstNonemptyScene({
 directory:dir,binding,itemId:40000047,title:'Independent new first Scene'
});
assert.equal(built.operation,WEP_SAVEFREE_FIRST_SCENE_OPERATION);
assert.deepEqual(built.artifact.bounds,{w:3,h:2});
assert.equal(built.artifact.objects.length,1);
assert.equal(built.artifact.objects[0].itemId,40000047);
assert.equal(built.artifact.source.platform,'synthetic');
assert.equal(built.artifact.networks.roads,null);
assert.equal(built.artifact.networks.fences,null);
assert.equal(built.artifact.objects[0].portableState,null);
assert.equal(built.editorSessionCreated,false);
assert.equal(built.nativePlacementAuthorized,false);
const empty=structuredClone(built.artifact);empty.objects=[];
assert.equal(validatePublishablePreset(empty).ok,false,'empty Scene stays invalid');
for(const id of [0,-1,999999999,40003102])
 assert.throws(()=>resolveVerifiedSaveFreeSceneItem(dir,binding,id),/WEP_SAVEFREE_SCENE_/);
const duplicate={...dir,entries:[...dir.entries,...dir.entries.filter(x=>x.itemId===40000047)]};
assert.throws(()=>resolveVerifiedSaveFreeSceneItem(duplicate,binding,40000047),
 /CATALOG_ITEM_NOT_ELIGIBLE/);
for(const fake of [
 {...binding,source:{...binding.source,gameVersion:'1.25.3'}},
 {...binding,source:{...binding.source,profileSchemaVersion:626}},
 {...binding,provenance:{...binding.provenance,readDataSha256:'0'.repeat(64)}},
 {...binding,provenance:{...binding.provenance,readDataBuildID:'9A239D3DB569756D'}}
])assert.throws(()=>resolveVerifiedSaveFreeSceneItem(dir,fake,40000047),
 /SOURCE_UNVERIFIED/);
const fakeFoot={...binding,resolveDraftPlacementSource(id){
 const x=binding.resolveDraftPlacementSource(id,1);
 return {...x,footprint:[...x.footprint.slice(0,5),x.footprint[0]]};
}};
assert.throws(()=>resolveVerifiedSaveFreeSceneItem(dir,fakeFoot,40000047),
 /FOOTPRINT_UNVERIFIED/);
const nativeGrant={...binding,resolveDraftPlacementSource(id){
 const x=binding.resolveDraftPlacementSource(id,1);return {...x,productApplyAuthorized:true};
}};
assert.throws(()=>resolveVerifiedSaveFreeSceneItem(dir,nativeGrant,40000047),
 /GEOMETRY_OR_POLICY_UNVERIFIED/);
assert.throws(()=>resolveVerifiedSaveFreeSceneItem(
 {...dir,source:{...dir.source,buildID:'FAKE'}},binding,40000047),/SOURCE_UNVERIFIED/);
for(const title of ['', 'x'.repeat(121)])
 assert.throws(()=>buildSaveFreeFirstNonemptyScene({
 directory:dir,binding,itemId:40000047,title}),/TITLE_INVALID/);
const artifactJSON=JSON.stringify(built.artifact);
for(const key of ['nativeGrid','gridId','sourceGridId','gridObjectId','editorId',
 'inventoryOwned','ownership','entitlement','saveBytes'])
 assert.equal(artifactJSON.includes('"'+key+'":'),false,'forbidden '+key);
assert.equal(SAVEFREE_SCENE_LOCALES.length,8);
console.log('QRW879_TRUE_CATALOG12552_SWITCH1250_SHA_BID_ITEM40000047_FOOTPRINT3X2_NEGATIVE_PASS');

const origin=process.env.QRW879_ORIGIN;
assert.match(origin??'',/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN);
assert.ok(!process.env.P1G_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.DDV_PRIVATE_SAVE_PATH);
const DB='dreamwishwand:wep:scene-presets:local:v1';
const oldKeys=['dreamwishwand:moodboards:v1','dreamwishwand:moodboards:v1:backup'];
const oldVals=['QRW879_ORIGINAL_MOODBOARD','QRW879_ORIGINAL_MOODBOARD_BACKUP'];
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
const errors=[],unsafe=[];
ctx.on('request',req=>{
 if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))
  unsafe.push(req.method()+' '+req.url());
});
async function raw(p){
 return p.evaluate(async name=>{
  const req=indexedDB.open(name,1);
  const db=await new Promise((res,rej)=>{
   req.onupgradeneeded=()=>{req.transaction.abort();rej(Error('READ_NO_DB_CREATE'));};
   req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);
  });
  try{
   const tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get('library');
   return await new Promise((res,rej)=>{
    tx.oncomplete=()=>res(q.result);tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error);
   });
  }finally{db.close();}
 },DB);
}
async function putRaw(p,record){
 await p.evaluate(async({name,record})=>{
  const req=indexedDB.open(name,1);
  const db=await new Promise((res,rej)=>{
   req.onupgradeneeded=()=>{req.transaction.abort();rej(Error('NO_QA_DB_CREATE'));};
   req.onerror=()=>rej(req.error);req.onsuccess=()=>res(req.result);
  });
  try{
   const tx=db.transaction('snapshots','readwrite');
   tx.objectStore('snapshots').put(record,'library');
   await new Promise((res,rej)=>{
    tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error);
   });
  }finally{db.close();}
 },{name:DB,record});
}
const dbs=p=>p.evaluate(async()=> (await indexedDB.databases()).map(d=>d.name).sort());
const old=p=>p.evaluate(k=>k.map(v=>localStorage.getItem(v)),oldKeys);
async function enter(p,sel){
 const b=p.locator(sel);await b.waitFor({timeout:30000});
 await b.focus();assert.equal(await b.evaluate(el=>el===document.activeElement),true);
 await p.keyboard.press('Enter');
}
async function preview(p,title){
 await p.locator('[data-wep-savefree-title]').fill(title);
 await enter(p,'[data-wep-savefree-preview]');
 await p.locator('[data-wep-savefree-artifact]').waitFor({timeout:16000});
}
try{
 const p=await ctx.newPage();
 p.on('pageerror',e=>errors.push(String(e)));
 const r=await p.goto(origin+'/editor/world/',{waitUntil:'networkidle',timeout:60000});
 assert.equal(r.status(),200);
 const panel=p.locator('[data-wep-savefree-first-scene]');
 await panel.waitFor({timeout:35000});
 await p.waitForFunction(()=>Boolean(document.documentElement.dataset.locale),null,{timeout:20000});
 assert.equal((await dbs(p)).includes(DB),false);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 for(const [k,v] of [['data-save-writer','off'],['data-native-apply','off'],
 ['data-cloud','off'],['data-editor-session','untouched']])
  assert.equal(await panel.getAttribute(k),v);
 await p.evaluate(({k,v})=>k.forEach((key,i)=>localStorage.setItem(key,v[i])),
  {k:oldKeys,v:oldVals});
 await enter(p,'[data-wep-savefree-load]');
 await p.locator('[data-wep-savefree-search]').waitFor({timeout:60000});
 assert.equal((await dbs(p)).includes(DB),false);
 await p.locator('[data-wep-savefree-search]').fill('999999999');
 assert.equal(await p.locator('[data-wep-savefree-choose="999999999"]').count(),0);
 await p.locator('[data-wep-savefree-search]').fill('40000047');
 await enter(p,'[data-wep-savefree-choose="40000047"]');
 await p.locator('[data-wep-savefree-selection]').waitFor({timeout:20000});
 assert.match(await p.locator('[data-wep-savefree-selection]').innerText(),/3 × 2/);
 assert.equal(await p.locator('[data-wep-savefree-save]:not([disabled])').count(),0);
 await preview(p,'QRW879 first nonempty real furniture');
 const description=await p.locator('[data-wep-savefree-artifact]').innerText();
 assert.match(description,/1 objects/);assert.match(description,/3 × 2/);
 assert.match(description,/writeReady=false \/ applyReady=false/);
 assert.equal((await dbs(p)).includes(DB),false,'preview must not create IDB');
 await p.locator('[data-wep-savefree-title]').fill('Changed after preview');
 assert.equal(await p.locator('[data-wep-savefree-save]:not([disabled])').count(),0);
 await preview(p,'QRW879 first nonempty real furniture');
 console.log('QRW879_CHROME_NO_PASSIVE_DB_VERIFIED_CATALOG_EXPLICIT_NONEMPTY_PREVIEW_PASS');

 await enter(p,'[data-wep-savefree-save]');
 const saved=p.locator('[data-wep-savefree-saved]');
 await saved.waitFor({timeout:27000});
 assert.equal(await saved.getAttribute('data-apply'),'off');
 assert.equal(await saved.getAttribute('data-native-writer'),'off');
 let current=await raw(p);
 assert.equal(current.revision,1);
 assert.equal(current.backupRevision,0);
 assert.equal(JSON.parse(current.backup).entries.length,0);
 const entry=JSON.parse(current.primary).entries[0];
 assert.equal(JSON.parse(current.primary).entries.length,1);
 assert.equal(entry.artifact.objects.length,1);
 assert.equal(entry.artifact.objects[0].itemId,40000047);
 assert.equal(entry.artifact.objects[0].footprint.length,6);
 assert.deepEqual(entry.artifact.bounds,{w:3,h:2});
 assert.equal(entry.artifact.source.platform,'synthetic');
 assert.equal(entry.artifact.networks.roads,null);
 assert.equal(entry.artifact.networks.fences,null);
 assert.equal(entry.artifact.objects[0].portableState,null);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 assert.deepEqual(await old(p),oldVals);
 const row1=structuredClone(current), initialDBs=await dbs(p);
 console.log('QRW879_CHROME_EXPLICIT_SAVE_REAL_ITEM40000047_FIRST_CAS1_BACKUP0_REOPEN_PASS');

 for(const lang of SAVEFREE_SCENE_LOCALES){
  await p.locator('#site-locale').selectOption(lang,{force:true});
  const copy=saveFreeSceneCopy(lang);
  await p.waitForFunction(expected=>
   document.querySelector('[data-wep-savefree-first-scene] h2')?.textContent?.trim()===expected,
   copy.title,{timeout:23000});
  assert.ok((await panel.innerText()).includes(copy.off));
 }
 await p.locator('#site-locale').selectOption('en',{force:true});
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:860});
  await p.evaluate(v=>document.documentElement.style.zoom=v,zoom);
  const size=await panel.evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(size.scroll<=size.client+2,'New panel overflow '+JSON.stringify({width,zoom,size}));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 assert.deepEqual(await raw(p),row1);
 console.log('QRW879_CHROME_NEW_PANEL_8_LANG_320_CSS200_KEYBOARD_NO_STORAGE_WRITE_PASS');

 const stale=await p.evaluate(async artifact=>{
  const {saveLocalScene}=await import('/src/lib/wep/local-scene-preset-store.mjs');
  try{await saveLocalScene({artifact,title:'Stale CAS DENY',expectedRevision:0});return 'BAD_ACCEPT';}
  catch(e){return String(e);}
 },entry.artifact);
 assert.match(stale,/STALE_REVISION/);
 assert.deepEqual(await raw(p),row1);
 await preview(p,'QRW879 damaged DB explicit save must deny');
 const damaged={...row1,primary:'{"malformed":"synthetic disposable test"}'};
 await putRaw(p,damaged);
 await enter(p,'[data-wep-savefree-save]');
 await p.locator('[data-wep-savefree-status]')
  .filter({hasText:saveFreeSceneCopy('en').blocked}).waitFor({timeout:26000});
 assert.equal(await saved.count(),0);
 assert.deepEqual(await raw(p),damaged,'no silent repair on existing DB');
 await putRaw(p,row1);
 assert.deepEqual(await raw(p),row1);
 console.log('QRW879_CHROME_STALE_REVISION_BAD_EXISTING_IDB_FAIL_CLOSED_NO_AUTOREPAIR_PASS');

 await preview(p,'QRW879 second explicit Scene');
 await enter(p,'[data-wep-savefree-save]');
 await saved.waitFor({timeout:26000});
 current=await raw(p);
 assert.equal(current.revision,2);
 assert.equal(current.backupRevision,1);
 assert.equal(current.backup,row1.primary,'Backup exact previous CAS primary bytes');
 assert.equal(JSON.parse(current.primary).entries.length,2);
 assert.deepEqual(await old(p),oldVals);
 assert.deepEqual(await dbs(p),initialDBs);
 assert.equal(await p.locator('[data-editor-object-id]').count(),0);
 assert.deepEqual(unsafe,[],'no outgoing Cloud/Provider/POST');
 assert.deepEqual(errors,[],'no unhandled Chrome error');
 console.log('QRW879_CHROME_SECOND_NEW_EXPLICIT_SAVE_CAS2_BACKUP1_EXACT_REOPEN_PASS');
 console.log('QRW879_INDEPENDENT_NEW7_REAL_NODE_CHROME_SCOPED_PASS',
  JSON.stringify({main:MAIN,source:SOURCE,itemId:40000047,footprint:'3x2',
   SwitchBID:'52BD625D9B4E0053',firstRevision:1,secondRevision:2,
   localSynthetic:true,Writer:false,Apply:false,Cloud:false,Provider:false}));
}finally{await ctx.close();await browser.close();}
