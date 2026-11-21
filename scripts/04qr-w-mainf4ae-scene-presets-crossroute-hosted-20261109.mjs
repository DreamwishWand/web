// 04 QR-W hosted-only NEW combined-operation QA on integrated main f4ae5c8e.
// No re-QA of Source859/QA860, Source862/QA864 or old hosted QA863.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const MAIN='f4ae5c8e84ccf37dcf0e89d6c45a2d8e61479922';
const HOST='https://dreamwishwand.github.io';
const ROOT=HOST+'/web/';
const route=s=>HOST+'/web'+s;
assert.equal(process.env.QRW_CROSS_MAIN,MAIN);
assert.equal(process.env.QRW_CROSS_URL,ROOT);
assert.ok(process.env.CHROME_BIN,'ACTUAL_INSTALLED_CHROME_REQUIRED');
assert.ok(process.env.QRW_GITHUB_TOKEN,'GITHUB_DEPLOYMENT_READ_TOKEN_REQUIRED');
assert.ok(!process.env.DDV_PRIVATE_SAVE_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.P1G_PATH);
async function gh(path){
 const r=await fetch('https://api.github.com'+path,{
  headers:{Authorization:'Bearer '+process.env.QRW_GITHUB_TOKEN,
   Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
  signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200,'GITHUB_DEPLOYMENT_API_READ '+path);
 return r.json();
}
const pages=await gh('/repos/DreamwishWand/web/pages');
assert.equal(pages.html_url.replace(/\/?$/,'/'),ROOT);
const deployments=await gh('/repos/DreamwishWand/web/deployments?environment=github-pages&per_page=15');
const exact=deployments.filter(x=>x.sha===MAIN);
assert.ok(exact.length,'THIS_PROTECTED_MAIN_NOT_ACTUALLY_DEPLOYED');
for(const path of ['/','/moodboards/','/editor/world/','/presets/']){
 const r=await fetch(route(path),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200,'ACTUAL_HTTPS_ROUTE '+path);
 assert.equal(r.headers.get('location'),null,'NO_FABRICATED_REDIRECT');
 if(r.body)await r.body.cancel();
}
console.log('QRW865_GENUINE_PAGES_DEPLOYMENT_MAINF4AE_AND_CROSSROUTE_HTTPS200_PASS',
 JSON.stringify({page:ROOT,deployments:exact.map(x=>x.id)}));

const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:900},
 serviceWorkers:'block',ignoreHTTPSErrors:false});
const errors=[],outbound=[];
ctx.on('request',r=>{
 const u=new URL(r.url());
 if(u.origin!==HOST||!['GET','HEAD'].includes(r.method()))
  outbound.push({method:r.method(),url:r.url()});
});
function attach(p){p.on('pageerror',e=>errors.push(String(e)));}
const oldKeys=['dreamwishwand:moodboards:v1','dreamwishwand:moodboards:v1:backup'];
const oldTime='2026-11-09T00:00:00.000Z';
const oldPrimary=JSON.stringify({schema:'wand.moodboards.local@1',version:2,updatedAt:oldTime,
 boards:[{id:'host-crossroute-synthetic-old',title:'Cross-route QA Legacy Only',
 description:null,createdAt:oldTime,updatedAt:oldTime,
 groups:[{id:'g',title:'Group',order:0,collapsed:false}],
 references:[{id:'r',type:'ITEM',label:'Stage1 Furniture',entityId:'40000048',
 groupIds:['g'],createdAt:oldTime,note:null,url:null}]}]});
const oldBackup='{"crossRoute":"old-backup-unmodified-sentinel"}';
const doc={schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'crossroute-hosted-qa'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
 {editorId:'host-cross-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],
  editability:'editable',metadata:{displayName:'QA Scene A',worldClass:'FurnitureItemData'}},
 {editorId:'host-cross-b',itemId:40000050,layer:'furniture',x:3,y:2,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],
  editability:'editable',metadata:{displayName:'QA Scene B',worldClass:'FurnitureItemData'}}
 ]};
const dbName='dreamwishwand:wep:scene-presets:local:v1';
const oldState=async p=>p.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),oldKeys);
const dbList=async p=>p.evaluate(async name=>
 (await indexedDB.databases()).filter(x=>x.name===name),dbName);
const readRow=async p=>p.evaluate(async name=>{
 const open=indexedDB.open(name,1);
 const db=await new Promise((resolve,reject)=>{
  open.onupgradeneeded=()=>{open.transaction?.abort();reject(Error('QA_DB_ABSENT_NO_CREATE'));};
  open.onerror=()=>reject(open.error);open.onsuccess=()=>resolve(open.result);
 });
 try{
  const tx=db.transaction('snapshots','readonly'),req=tx.objectStore('snapshots').get('library');
  return await new Promise((resolve,reject)=>{
   tx.oncomplete=()=>resolve(req.result);
   tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close();}
},dbName);
const seedOld=async p=>p.evaluate(([ks,vs])=>{
 for(let i=0;i<ks.length;i++)if(localStorage.getItem(ks[i])===null)
  localStorage.setItem(ks[i],vs[i]);
},[oldKeys,[oldPrimary,oldBackup]]);
async function enterMy(p){
 await p.locator('[data-preset-child="my"]').click();
 await p.locator('[data-my-domain-view="wand"]').waitFor({timeout:30000});
 await p.locator('[data-my-local-scenes]').waitFor();
}
async function importEditor(p){
 await p.locator('.load-panel input[type=file]').setInputFiles({
  name:'04qrw-crossroute-synthetic-only.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(doc))});
 await p.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:45000});
}
async function sceneCapture(p,id,title){
 await p.locator('[data-editor-object-id="'+id+'"]').click();
 await p.locator('.capture-panel input').first().fill(title);
 await p.getByRole('button',{name:'Capture Preview'}).click();
 await p.locator('[data-wep-local-scene-save]:not([disabled])').waitFor({timeout:25000});
}
async function keyboardClick(p,selector){
 const element=p.locator(selector);await element.focus();
 assert.equal(await element.evaluate(el=>el===document.activeElement),true);
 await p.keyboard.press('Enter');
}
const labels={
 en:'Local Scene Presets',fr:'Presets Scene locaux',it:'Preset Scene locali',
 de:'Lokale Scene Presets','es-ES':'Presets Scene locales',
 ja:'ローカルScene Preset','zh-CN':'本地 Scene Preset','pt-BR':'Presets Scene locais'
};
async function corruptRow(p,primary){
 await p.evaluate(async({name,primary})=>{
  const open=indexedDB.open(name,1);
  const db=await new Promise((resolve,reject)=>{
   open.onupgradeneeded=()=>{open.transaction?.abort();reject(Error('SCENE_IDB_MISSING'));};
   open.onerror=()=>reject(open.error);open.onsuccess=()=>resolve(open.result);
  });
  try{
   const tx=db.transaction('snapshots','readwrite'),s=tx.objectStore('snapshots'),g=s.get('library');
   g.onsuccess=()=>s.put({...g.result,primary},'library');
   await new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
   });
  }finally{db.close();}
 },{name:dbName,primary});
}
try{
 const initial=await ctx.newPage();attach(initial);
 let r=await initial.goto(route('/presets/'),{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(r.status(),200);
 await initial.locator('[data-stage1-presets-four-cards]').waitFor();
 await enterMy(initial);
 assert.equal(await initial.locator('[data-device-scene-preview]').count(),0);
 assert.deepEqual(await dbList(initial),[],'passive Presets page must not invent Scene IDB');
 await keyboardClick(initial,'[data-device-scenes-reopen]');
 await initial.locator('[data-device-scenes-status]').waitFor();
 assert.deepEqual(await dbList(initial),[],'explicit readonly empty Scene must not create DB');
 await initial.close();
 console.log('QRW865_HOSTED_PRESETS_ABSENT_SCENE_DB_NO_AUTOCREATE_PASS');

 const p=await ctx.newPage();attach(p);
 r=await p.goto(route('/moodboards/'),{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(r.status(),200);
 await seedOld(p);
 assert.deepEqual(await oldState(p),[oldPrimary,oldBackup]);
 await p.reload({waitUntil:'domcontentloaded'});
 await p.getByRole('button',{name:'Open in World Editor'}).click();
 await p.waitForURL(/\/web\/editor\/world\/?$/,{timeout:45000});
 await p.locator('[data-wep-decorate-stage1] .reference-main')
  .filter({hasText:'Stage1 Furniture'}).click();
 await importEditor(p);
 await sceneCapture(p,'host-cross-a','Cross-route hosted scene one');
 assert.deepEqual(await dbList(p),[],'Capture Preview must not create Scene IDB');
 await keyboardClick(p,'[data-wep-local-scene-save]');
 await p.locator('[data-wep-local-scene-status]').waitFor({timeout:45000});
 const first=await readRow(p);
 assert.equal(first.revision,1);assert.equal(first.backupRevision,0);
 assert.equal(JSON.parse(first.primary).entries.length,1);
 assert.equal(JSON.parse(first.backup).entries.length,0);
 assert.deepEqual(await oldState(p),[oldPrimary,oldBackup]);
 console.log('QRW865_HOSTED_WEP_EXPLICIT_CAPTURE_SAVE_CAS_REV1_BACKUP_AND_LEGACY_INTACT_PASS');

 const a=p.locator('a.preset-link[href="/web/presets/"]');
 assert.equal(await a.count(),1,'World Editor should link to Presets UI');
 await keyboardClick(p,'a.preset-link[href="/web/presets/"]');
 await p.waitForURL(/\/web\/presets\/?$/,{timeout:45000});
 await p.locator('[data-stage1-presets-four-cards]').waitFor();
 await enterMy(p);
 const device=p.locator('[data-my-local-scenes]');
 assert.equal(await device.getAttribute('data-account-created'),'unverified');
 assert.equal(await device.getAttribute('data-account-saved'),'unverified');
 assert.equal(await device.getAttribute('data-device-scene-authority'),'local-only');
 assert.equal(await device.getAttribute('data-local-scene-writer'),'off');
 assert.equal(await device.getAttribute('data-auto-cloud'),'off');
 assert.equal(await p.locator('[data-device-scenes-list]').count(),0,
  'Cross-route UI cannot auto-display local Scene before user asks');
 await keyboardClick(p,'[data-device-scenes-reopen]');
 await p.locator('[data-device-scene-select]').first().waitFor({timeout:25000});
 assert.equal(await p.locator('[data-device-scene-select]').count(),1);
 assert.match(await p.locator('[data-device-scene-select]').first().innerText(),/Cross-route hosted scene one/);
 await keyboardClick(p,'[data-device-scene-select]');
 await p.locator('[data-device-scene-preview]').waitFor({timeout:20000});
 assert.match(await p.locator('[data-device-scene-preview] code').innerText(),/writeReady=false/);
 assert.deepEqual(await readRow(p),first,'crossroute readonly Preview must not mutate Save');
 console.log('QRW865_HOSTED_WORLD_EDITOR_TO_PRESETS_EXPLICIT_SCENE_LIST_READONLY_REV1_PASS');

 for(const [loc,label] of Object.entries(labels)){
  await p.locator('#site-locale').selectOption(loc);
  await p.waitForFunction(label=>
   document.querySelector('#my-device-scenes-title')?.textContent?.trim()===label,
   label,{timeout:18000});
  assert.equal(await p.locator('[data-device-scene-select]').count(),1);
 }
 await p.locator('#site-locale').selectOption('en');
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await p.setViewportSize({width,height:900});
  await p.evaluate(z=>document.documentElement.style.zoom=z,zoom);
  const metrics=await device.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
  assert.ok(metrics.scroll<=metrics.client+2,
   'Hosted crossroute My local Scene panel overflow '+width+' '+zoom+' '+JSON.stringify(metrics));
 }
 await p.evaluate(()=>document.documentElement.style.zoom='1');
 await p.setViewportSize({width:1440,height:900});
 console.log('QRW865_HOSTED_CROSSROUTE_8_LOCALES_320_CSS200_KEYBOARD_PASS');

 // New combined-path concurrency: Presets' visible Rev1 is stale after a
 // different Editor tab returns and explicitly saves Rev2.
 const other=await ctx.newPage();attach(other);
 await other.goto(route('/editor/world/'),{waitUntil:'domcontentloaded',timeout:45000});
 await importEditor(other);
 await other.locator('[data-wep-local-scene-reopen]').click();
 await other.locator('[data-wep-local-scene-entries] [data-wep-local-scene-read]')
  .first().waitFor({timeout:24000});
 await sceneCapture(other,'host-cross-b','Cross-route hosted scene two');
 await keyboardClick(other,'[data-wep-local-scene-save]');
 await other.locator('[data-wep-local-scene-status]').waitFor({timeout:45000});
 const second=await readRow(other);
 assert.equal(second.revision,2);
 assert.equal(second.backupRevision,1);
 assert.equal(second.backup,first.primary,'Prior Primary must survive exactly in Backup');
 assert.equal(JSON.parse(second.primary).entries.length,2);
 await keyboardClick(p,'[data-device-scene-select]');
 await p.locator('[data-device-scenes-status]')
  .filter({hasText:'unavailable or changed'}).waitFor({timeout:20000});
 assert.equal(await p.locator('[data-device-scene-preview]').count(),0);
 assert.deepEqual(await readRow(p),second,'stale UI must not repair or update CAS row');
 await keyboardClick(p,'[data-device-scenes-reopen]');
 await p.locator('[data-device-scene-select]').nth(1).waitFor({timeout:25000});
 await p.locator('[data-device-scene-select]').nth(1).click();
 await p.locator('[data-device-scene-preview]').waitFor({timeout:20000});
 assert.match(await p.locator('[data-device-scene-preview] code').innerText(),/writeReady=false/);
 assert.deepEqual(await readRow(p),second);
 console.log('QRW865_HOSTED_TWO_ROUTE_STALE_REVISION_BLOCKS_UI_SECOND_SCENE_BACKUP_EXACT_PASS');

 // Crossroute negative: a damaged native authority in local Scene must not
 // display or be treated as Creator/SavedItem, and must not be automatically repaired.
 const corruptedDocument=JSON.parse(second.primary);
 corruptedDocument.entries[0].artifact.objects[0].gridId='FAKE_NATIVE_ID_NOT_AUTHORIZED';
 await corruptRow(p,JSON.stringify(corruptedDocument));
 const bad=await readRow(p);
 await keyboardClick(p,'[data-device-scenes-reopen]');
 await p.locator('[data-device-scenes-status]')
  .filter({hasText:'unavailable or changed'}).waitFor({timeout:20000});
 assert.equal(await p.locator('[data-device-scene-preview]').count(),0);
 assert.deepEqual(await readRow(p),bad);
 await corruptRow(p,second.primary); // QA fixture restores exact row.
 assert.deepEqual(await readRow(p),second);
 assert.deepEqual(await oldState(p),[oldPrimary,oldBackup]);
 console.log('QRW865_HOSTED_INVALID_SCENE_LOCALONLY_NO_REPAIR_NO_CREATOR_SAVEDITEM_PASS');

 await keyboardClick(p,'[data-device-scene-world-editor]');
 await p.waitForURL(/\/web\/editor\/world\/?$/,{timeout:45000});
 assert.equal(new URL(p.url()).searchParams.has('sceneId'),false);
 assert.equal(await p.locator('[data-wep-local-scene-preview]').count(),0,
  'Return cannot silently Apply a Scene or claim imported authority');
 await p.reload({waitUntil:'domcontentloaded',timeout:45000});
 assert.deepEqual(await readRow(p),second,
  'Scene primary/backup must persist across route navigation and page reload');
 await importEditor(p); // Required accepted Editor Source re-entry.
 await keyboardClick(p,'[data-wep-local-scene-reopen]');
 await p.locator('[data-wep-local-scene-read]').nth(1).waitFor({timeout:24000});
 await p.locator('[data-wep-local-scene-read]').nth(1).click();
 await p.locator('[data-wep-local-scene-preview]').waitFor({timeout:18000});
 assert.match(await p.locator('[data-wep-local-scene-preview] code').innerText(),/writeReady=false/);
 assert.deepEqual(await readRow(p),second);
 assert.deepEqual(await oldState(p),[oldPrimary,oldBackup]);
 assert.deepEqual(outbound,[],'No outbound POST, external GET, cloud, native network');
 assert.deepEqual(errors,[],'No uncaught errors on deployed crossroute Chrome');
 console.log('QRW865_HOSTED_PRESETS_TO_WORLD_EDITOR_MANUAL_RETURN_RELOAD_EXPLICIT_SOURCE_REOPEN_PASS');
 console.log('QRW865_GENUINE_DEPLOYED_CROSSROUTE_E2E_SCOPED_PASS',
  JSON.stringify({main:MAIN,url:ROOT,syntheticOnly:true,privateSave:false,
   oldAncestorsReQA:false,sessionSourceReentryRequired:true}));
}finally{await ctx.close();await browser.close();}
