// 04 QR-W actual distributed GitHub Pages end-to-end, distinct from accepted
// Source PR859 QA860 and previous hosted Atomic Board QA857. No private P1G.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {localScenePresetCopy,LOCAL_SCENE_PRESET_LOCALES}
 from '../src/lib/wep/local-scene-preset-copy.js';
const MAIN='574f30d554939bf674ad90a16f45b86e775118a1';
const HOST='https://dreamwishwand.github.io';
const ROOT=HOST+'/web/';
const pageUrl=path=>HOST+'/web'+path;
const sceneDb='dreamwishwand:wep:scene-presets:local:v1';
const oldKey='dreamwishwand:moodboards:v1',oldBackupKey='dreamwishwand:moodboards:v1:backup';
assert.equal(process.env.QRW_HOSTED_SCENE_MAIN,MAIN);
assert.equal(process.env.QRW_HOSTED_SCENE_DEPLOY_URL,ROOT);
assert.ok(process.env.CHROME_BIN,'REQUIRES_REAL_INSTALLED_CHROME');
assert.ok(!process.env.DDV_PRIVATE_SAVE_PATH&&!process.env.WEP_PRIVATE_P1G_PATH&&!process.env.P1G_PATH,
 'PRIVATE_SAVE_FORBIDDEN');
const token=process.env.QRW_GITHUB_TOKEN;
if(!token)throw Error('GITHUB_AUTH_DEPLOYMENT_PROVENANCE_REQUIRED');
const gh=async url=>{
 const r=await fetch('https://api.github.com'+url,{headers:{
  Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28'},redirect:'manual'});
 assert.equal(r.status,200,'GitHub deployment API '+url);
 return r.json();
};
const pages=await gh('/repos/DreamwishWand/web/pages');
assert.equal((pages.html_url.endsWith('/')?pages.html_url:pages.html_url+'/'),ROOT,
 'Deploy environment public Pages URL cannot be guessed');
const deployments=await gh('/repos/DreamwishWand/web/deployments?environment=github-pages&per_page=15');
assert.ok(deployments.some(x=>x.sha===MAIN),'actual deployed main SHA not found');
console.log('QRW861_HOSTED_PAGES_API_AND_GENUINE_DEPLOYMENT_SHA574F30_MATCH_PASS',
 JSON.stringify({url:ROOT,deployments:deployments.filter(x=>x.sha===MAIN).map(x=>x.id)}));
for(const path of ['/','/editor/world/','/moodboards/']){
 const r=await fetch(pageUrl(path),{method:'GET',redirect:'manual',signal:AbortSignal.timeout(18000)});
 assert.equal(r.status,200,'real hosted HTTPS direct HTTP200 '+path);
 assert.equal(r.headers.get('location'),null,'no fabricated redirect '+path);
 assert.match(r.headers.get('content-type')??'',/text\/html/);
 if(r.body)await r.body.cancel();
}
console.log('QRW861_HOSTED_DIRECT_HTTPS_EDITOR_MOODBOARD_HTTP200_NO_LOCATION_PASS');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1440,height:900},
 serviceWorkers:'block',ignoreHTTPSErrors:false,acceptDownloads:false});
// Disposable per-run context guarantees no actual owner's browser stores are touched.
const errors=[],unexpected=[];
ctx.on('request',r=>{
 const u=new URL(r.url()),method=r.method();
 if(u.origin!==HOST||!['GET','HEAD'].includes(method))
  unexpected.push({method,url:r.url()});
});
const now='2026-11-09T00:00:00.000Z';
const legacy=JSON.stringify({
 schema:'wand.moodboards.local@1',version:2,updatedAt:now,
 boards:[{id:'host-scene-qa-legacy-untouched',title:'Hosted Scene QA Old Board',description:null,
  createdAt:now,updatedAt:now,
  groups:[{id:'g',title:'Item',order:0,collapsed:false}],
  references:[{id:'r',type:'ITEM',label:'Stage1 Furniture',entityId:'40000048',
    groupIds:['g'],createdAt:now,note:null,url:null}]
 }]
});
const oldBackup='{"hosted":"legacy-backup-byte-sentinel"}';
const fixture={
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'hosted-only-qa'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
 {editorId:'host-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',
  metadata:{displayName:'Hosted QA A',worldClass:'FurnitureItemData'}},
 {editorId:'host-b',itemId:40000050,layer:'furniture',x:4,y:2,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',
  metadata:{displayName:'Hosted QA B',worldClass:'FurnitureItemData'}}
]};
const rawOld=async p=>p.evaluate(([k,b])=>({primary:localStorage.getItem(k),
 backup:localStorage.getItem(b)}),[oldKey,oldBackupKey]);
const dbs=async p=>p.evaluate(async name=>{
 if(!indexedDB.databases)throw Error('INDEXEDDB_DATABASES_NOT_SUPPORTED');
 return (await indexedDB.databases()).filter(x=>x.name===name);
},sceneDb);
const row=async p=>p.evaluate(async name=>{
 const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,1);
  req.onupgradeneeded=()=>{req.transaction.abort();reject(Error('QA_MUST_NOT_CREATE_DB'));};
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>resolve(req.result);
 });
 try{
  const tx=db.transaction('snapshots','readonly'),req=tx.objectStore('snapshots').get('library');
  return await new Promise((resolve,reject)=>{
   tx.oncomplete=()=>resolve(req.result);
   tx.onabort=()=>reject(tx.error);
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close();}
},sceneDb);
const seed=async p=>p.evaluate(([key,backup,a,b])=>{
 if(localStorage.getItem(key)===null)localStorage.setItem(key,a);
 if(localStorage.getItem(backup)===null)localStorage.setItem(backup,b);
},[oldKey,oldBackupKey,legacy,oldBackup]);
async function visitEditor(){
 const p=await ctx.newPage();
 p.on('pageerror',e=>errors.push(String(e)));
 const r=await p.goto(pageUrl('/moodboards/'),{waitUntil:'domcontentloaded',timeout:50000});
 assert.equal(r.status(),200);
 await seed(p);
 await p.reload({waitUntil:'domcontentloaded'});
 await p.getByRole('button',{name:'Open in World Editor'}).click();
 await p.waitForURL(pageUrl('/editor/world/'),{timeout:45000});
 await p.locator('[data-wep-decorate-stage1] .reference-main')
  .filter({hasText:'Stage1 Furniture'}).click();
 await p.locator('.load-panel input[type=file]').setInputFiles({
  name:'qrw-hosted-synthetic-only.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(fixture))});
 await p.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:45000});
 return p;
}
const capture=async(p,id,title)=>{
 await p.locator('[data-editor-object-id="'+id+'"]').click();
 await p.locator('.capture-panel input').first().fill(title);
 await p.getByRole('button',{name:'Capture Preview'}).click();
 await p.locator('[data-wep-local-scene-save]:not([disabled])').waitFor({timeout:25000});
};
const patchPrimary=async(p,value)=>p.evaluate(async({name,value})=>{
 const db=await new Promise((resolve,reject)=>{
  const req=indexedDB.open(name,1);
  req.onupgradeneeded=()=>{req.transaction.abort();reject(Error('DB_MUST_EXIST'));};
  req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);
 });
 try{
  const tx=db.transaction('snapshots','readwrite'),st=tx.objectStore('snapshots'),get=st.get('library');
  get.onsuccess=()=>st.put({...get.result,primary:value},'library');
  await new Promise((resolve,reject)=>{
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
 }finally{db.close();}
},{name:sceneDb,value});
try{
 const first=await visitEditor();
 assert.equal(await first.locator('[data-wep-local-scene]').count(),1,
  'deployed code must contain new Scene panel');
 assert.deepEqual(await dbs(first),[]);
 await first.locator('[data-wep-local-scene-reopen]').click();
 await first.locator('[data-wep-local-scene-status]').filter({hasText:'No local Scene Presets'}).waitFor();
 assert.deepEqual(await dbs(first),[],'readonly nonexistent DB must not migrate');
 console.log('QRW861_DEPLOYED_SCENE_UI_PRESENT_ABSENT_DB_NO_AUTOCREATE_PASS');

 const stale=await visitEditor(); // stale tab session predates first write
 await capture(first,'host-a','Hosted scene first capture');
 assert.deepEqual(await dbs(first),[],'Preview is not Save');
 for(const lang of LOCAL_SCENE_PRESET_LOCALES){
  await first.evaluate(l=>{const el=document.querySelector('#site-locale');
   if(!el)throw Error('LANGUAGE_SELECT_MISSING');
   el.value=l;el.dispatchEvent(new Event('change',{bubbles:true}));},lang);
  await first.waitForFunction(title=>
    document.querySelector('#wep-local-scene-title')?.textContent?.trim()===title,
    localScenePresetCopy(lang).title);
  assert.equal((await first.locator('[data-wep-local-scene-save]').textContent()).trim(),
   localScenePresetCopy(lang).save);
 }
 await first.evaluate(()=>{const el=document.querySelector('#site-locale');
  el.value='en';el.dispatchEvent(new Event('change',{bubbles:true}));});
 await first.waitForFunction(()=>document.querySelector('#wep-local-scene-title')?.textContent?.trim()==='Local Scene Presets');
 await first.setViewportSize({width:320,height:850});
 let dimensions=await first.locator('[data-wep-local-scene]')
  .evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
 assert.ok(dimensions.scroll<=dimensions.client+2,'hosted 320px Scene panel overflow '+JSON.stringify(dimensions));
 await first.setViewportSize({width:640,height:850});
 await first.evaluate(()=>{document.documentElement.style.zoom='2';});
 dimensions=await first.locator('[data-wep-local-scene]')
  .evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
 assert.ok(dimensions.scroll<=dimensions.client+2,'hosted zoom200 Scene panel overflow '+JSON.stringify(dimensions));
 await first.evaluate(()=>{document.documentElement.style.zoom='1';});
 await first.setViewportSize({width:1440,height:900});
 console.log('QRW861_DEPLOYED_SCENE_8_LOCALES_320_ZOOM200_PRESENT_PASS');

 const save=first.locator('[data-wep-local-scene-save]');
 await save.focus();assert.equal(await save.evaluate(el=>el===document.activeElement),true);
 await first.keyboard.press('Enter');
 await first.locator('[data-wep-local-scene-status]')
  .filter({hasText:'saved and independently reopened'}).waitFor({timeout:45000});
 const one=await row(first);
 assert.equal(one.revision,1);assert.equal(one.backupRevision,0);
 assert.equal(JSON.parse(one.primary).entries.length,1);
 assert.equal(JSON.parse(one.backup).entries.length,0);
 assert.equal(JSON.parse(one.primary).entries[0].artifact.type,'scene');
 assert.equal(JSON.stringify(one.primary).includes('host-a'),false);
 assert.deepEqual(await rawOld(first),{primary:legacy,backup:oldBackup});
 console.log('QRW861_DEPLOYED_EXPLICIT_KEYBOARD_SCENE_CAS_REV1_OLD_BACKUP_PASS');

 await capture(stale,'host-a','Hosted stale tab');
 await stale.locator('[data-wep-local-scene-save]').click();
 await stale.locator('[data-wep-local-scene-status]')
  .filter({hasText:'unavailable or changed'}).waitFor({timeout:35000});
 assert.deepEqual(await row(first),one,'stale expectedRevision0 cannot overwrite');
 await capture(first,'host-b','Hosted scene second capture');
 await first.locator('[data-wep-local-scene-save]').click();
 await first.locator('[data-wep-local-scene-status]')
  .filter({hasText:'saved and independently reopened'}).waitFor({timeout:35000});
 const two=await row(first);
 assert.equal(two.revision,2);assert.equal(two.backupRevision,1);
 assert.equal(two.backup,one.primary,'Backup must preserve exact previous primary');
 assert.equal(JSON.parse(two.primary).entries.length,2);
 console.log('QRW861_DEPLOYED_STALE_SECOND_TAB_DENY_CAS_REV2_BACKUP_EXACT_PASS');

 // Distinct HOSTED-ONLY acceptance: hard reload of deployed page, then explicitly
 // reenter synthetic Editor session if the existing Scene UI is session-bound.
 await first.reload({waitUntil:'domcontentloaded',timeout:50000});
 const panelAfterRefresh=await first.locator('[data-wep-local-scene-reopen]').count();
 if(panelAfterRefresh===0){
  // Recreate only synthetic Editor view to access accepted local library;
  // the actual persistent data must remain from before reload.
  await first.locator('[data-wep-decorate-stage1] .reference-main')
   .filter({hasText:'Stage1 Furniture'}).click();
  await first.locator('.load-panel input[type=file]').setInputFiles({
   name:'qrw-hosted-synthetic-reentry.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(fixture))});
  await first.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:45000});
 }
 assert.deepEqual(await row(first),two,'page reload must preserve Scene IDB raw');
 await first.locator('[data-wep-local-scene-reopen]').click();
 await first.locator('[data-wep-local-scene-read]').first().waitFor({timeout:45000});
 assert.equal(await first.locator('[data-wep-local-scene-read]').count(),2);
 await first.locator('[data-wep-local-scene-read]').first().click();
 await first.locator('[data-wep-local-scene-preview]').waitFor({timeout:16000});
 assert.match(await first.locator('[data-wep-local-scene-preview] code').innerText(),/writeReady=false/);
 assert.deepEqual(await row(first),two);
 assert.deepEqual(await rawOld(first),{primary:legacy,backup:oldBackup});
 console.log('QRW861_HOSTED_PAGE_HARD_RELOAD_READONLY_REOPEN_REV2_NO_STORE_MUTATION_PASS',
  JSON.stringify({sessionBoundReentryRequired:panelAfterRefresh===0}));

 // Malformed portable Scene in disposable IDB: readonly Reopen rejects without
 // writing. Audit restores the exact known good row afterward.
 const badDoc=JSON.parse(two.primary);
 badDoc.entries[0].artifact.objects[0].gridId='FORGED_NATIVE_GRID';
 await patchPrimary(first,JSON.stringify(badDoc));
 const corrupt=await row(first);
 assert.notEqual(corrupt.primary,two.primary);
 await first.locator('[data-wep-local-scene-reopen]').click();
 await first.locator('[data-wep-local-scene-status]')
  .filter({hasText:'unavailable or changed'}).waitFor({timeout:20000});
 assert.deepEqual(await row(first),corrupt,'invalid Scene may not be auto repaired');
 await patchPrimary(first,two.primary);
 assert.deepEqual(await row(first),two);
 await first.locator('[data-wep-local-scene-reopen]').click();
 await first.locator('[data-wep-local-scene-read]').first().waitFor({timeout:24000});
 assert.deepEqual(await rawOld(first),{primary:legacy,backup:oldBackup});
 assert.deepEqual(unexpected,[],'no external GET and no POST/Cloud');
 assert.deepEqual(errors,[],'no uncaught browser JS exceptions');
 console.log('QRW861_HOSTED_INVALID_SCENE_READONLY_FAILCLOSED_RESTORE_QA_ONLY_NO_EXTERNAL_POST_PASS');
 console.log('QRW861_HOSTED_DEPLOYED_SCENE_LOCAL_ONLY_E2E_SCOPED_PASS',
  JSON.stringify({fixedMain:MAIN,url:ROOT,synthetic:true,sourceReQA:false,qaOnly:true}));
}finally{await ctx.close();await browser.close();}
