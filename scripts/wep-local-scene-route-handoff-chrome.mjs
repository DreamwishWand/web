import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const origin=(process.env.WEP_SCENE_ROUTE_ORIGIN||'http://127.0.0.1:4353').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:/);
assert.ok(process.env.CHROME_BIN,'Actual installed Chrome required');
const KEY='dreamwishwand:wep:scene-preset:selected-route:v1';
const SCHEMA='wand.wep.local-scene-route-intent@1';
const ID='scene_11111111-1111-4111-8111-111111111111';
const DB='dreamwishwand:wep:scene-presets:local:v1',STORE='snapshots';
const now='2026-11-09T01:20:00.000Z';
const artifact={schema:'dreamwish-wand-preset',artifactVersion:1,type:'scene',
 title:'Selected device local Scene',source:{gameVersion:null,platform:null,areaKey:null},
 bounds:{w:2,h:1},originPolicy:'capture-region-top-left',
 objects:[{artifactObjectId:'o0',itemId:40000048,layer:'furniture',
   localX:0,localY:0,orientation:0,footprint:[{x:0,y:0}],
   portableState:null,dependencyIds:[]}],
 networks:{roads:null,fences:null},
 requirements:{itemQuantities:{'40000048':1},roadTopology:false,fenceTopology:false},
 normalization:{sourceGridIdsRemoved:true,sourceGridObjectIdsRemoved:true,dependencyClosureIncluded:true}};
const empty={schema:'wand.wep.scene-library@1',version:1,entries:[]};
const sceneDoc={...empty,entries:[{id:ID,title:'Selected scene',createdAt:now,artifact}]};
const makeRow=(revision=1,backupDoc=empty)=>({
 schema:'wand.wep.scene-library-snapshot@1',revision,backupRevision:revision-1,
 primary:JSON.stringify(sceneDoc),backup:JSON.stringify(backupDoc)
});
const errors=[],unsafe=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const attach=page=>{
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{if((r.url().startsWith('http')&&!r.url().startsWith(origin))||
   ['POST','PUT','PATCH','DELETE'].includes(r.method()))unsafe.push(r.method()+' '+r.url());});
 };
 const seed=async(page,row)=>page.evaluate(async({row,dbName,storeName})=>{
  const db=await new Promise((res,rej)=>{
   const request=indexedDB.open(dbName,1);
   request.onupgradeneeded=()=>request.result.createObjectStore(storeName);
   request.onsuccess=()=>res(request.result);
   request.onerror=()=>rej(request.error);
  });
  await new Promise((res,rej)=>{
   const tx=db.transaction(storeName,'readwrite');
   tx.objectStore(storeName).put(row,'library');
   tx.oncomplete=res;tx.onerror=()=>rej(tx.error);
  });
  db.close();
 },{row,dbName:DB,storeName:STORE});
 const raw=async page=>page.evaluate(async({dbName,storeName})=>{
  const db=await new Promise((res,rej)=>{
   const request=indexedDB.open(dbName,1);
   request.onsuccess=()=>res(request.result);
   request.onerror=()=>rej(request.error);
  });
  const row=await new Promise((res,rej)=>{
   const tx=db.transaction(storeName,'readonly'),request=tx.objectStore(storeName).get('library');
   request.onsuccess=()=>res(request.result);
   request.onerror=()=>rej(request.error);
  });
  db.close();return row;
 },{dbName:DB,storeName:STORE});
 const stage=async(page,revision=1,issuedAt=Date.now())=>
  page.evaluate(({key,schema,id,revision,issuedAt})=>
   sessionStorage.setItem(key,JSON.stringify({schema,sceneId:id,expectedRevision:revision,issuedAt})),
   {key:KEY,schema:SCHEMA,id:ID,revision,issuedAt});
 const editor=async()=>{
  const page=await context.newPage();attach(page);
  await page.goto(origin+'/editor/world/',{waitUntil:'domcontentloaded'});return page;
 };
 const page=await editor();
 await seed(page,makeRow());
 const before=await raw(page);
 await stage(page,1);
 await page.reload({waitUntil:'domcontentloaded'});
 const hint=page.locator('[data-wep-selected-scene-route]');
 await hint.waitFor({timeout:30000});
 assert.equal(await page.locator('[data-wep-selected-scene-route-draft]').count(),0,
  'route never auto-reads Scene or prepares Draft');
 assert.equal(await page.locator('[data-editor-object-id]').count(),0,
  'no new EditorSession from route hint');
 const confirm=page.locator('[data-wep-selected-scene-route-confirm]');
 await confirm.focus();await page.keyboard.press('Enter');
 await page.locator('[data-wep-selected-scene-route-draft]').waitFor();
 const receipt=await page.locator('[data-wep-selected-scene-route-draft]').innerText();
 assert.match(receipt,/40000048/);
 assert.match(receipt,/writeReady=false \/ applyReady=false/);
 assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),KEY),null,'one-shot consume');
 assert.deepEqual(await raw(page),before,'readonly Draft cannot write Scene primary or backup');
 assert.equal(await page.locator('[data-editor-object-id]').count(),0,'no Editor mutation');
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
  const geometry=await hint.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
  assert.ok(geometry.scroll<=geometry.client+2,'320px/CSS200 inner overflow '+JSON.stringify(geometry));
 }
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:1440,height:900});
 // Revision changes in a second tab after user was shown the hint; deny.
 await stage(page,1);await page.reload({waitUntil:'domcontentloaded'});
 await hint.waitFor();
 const other=await editor();
 await seed(other,makeRow(2,sceneDoc));
 const changed=await raw(other);
 await confirm.click();
 await page.locator('[data-wep-selected-scene-route-status]').waitFor();
 assert.equal(await page.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.deepEqual(await raw(page),changed);
 // A forged hint changed after the UI renders is rejected before any IDB read.
 await stage(page,2);await page.reload({waitUntil:'domcontentloaded'});await hint.waitFor();
 await page.evaluate(key=>{
  const o=JSON.parse(sessionStorage.getItem(key));
  o.issuedAt+=1;sessionStorage.setItem(key,JSON.stringify(o));
 },KEY);
 await confirm.click();
 await page.locator('[data-wep-selected-scene-route-status]').waitFor();
 assert.equal(await page.locator('[data-wep-selected-scene-route-draft]').count(),0);
 assert.deepEqual(await raw(page),changed);
 // Invalid ID is rejected passively without opening or repairing IndexedDB.
 await page.evaluate(({key,schema})=>sessionStorage.setItem(key,JSON.stringify({
  schema,sceneId:'native:g42:o7',expectedRevision:2,issuedAt:Date.now()
 })),{key:KEY,schema:SCHEMA});
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('[data-wep-selected-scene-route]').count(),0);
 assert.deepEqual(await raw(page),changed);
 // Unavailable scene database on a fresh origin context: denied after explicit
 // action; accepted reader must not create a new Scene store.
 const freshCtx=await browser.newContext({viewport:{width:320,height:900},serviceWorkers:'block'});
 const missing=await freshCtx.newPage();attach(missing);
 await missing.goto(origin+'/editor/world/',{waitUntil:'domcontentloaded'});
 await stage(missing,1);await missing.reload({waitUntil:'domcontentloaded'});
 await missing.locator('[data-wep-selected-scene-route-confirm]').click();
 await missing.locator('[data-wep-selected-scene-route-status]').waitFor();
 assert.equal(await missing.locator('[data-wep-selected-scene-route-draft]').count(),0);
 const databases=await missing.evaluate(async()=>indexedDB.databases());
 assert.equal(databases.some(x=>x.name===DB),false,'readonly missing DB never creates a Scene store');
 await freshCtx.close();
 assert.deepEqual(errors,[],'JS errors');assert.deepEqual(unsafe,[],'off-origin or mutation HTTP');
 console.log(JSON.stringify({operation:'WEP_LOCAL_SCENE_ROUTE_INTENT_RECEIVER@1',
  evidence:'ACTUAL_INSTALLED_CHROME_SYNTHETIC_ONLY',checks:[
  'same-tab selected ID+Revision hint', 'no passive scene read or auto draft',
  'explicit keyboard Enter', 'local IDB type+CAS verified',
  'detached read-only geometry', 'unchanged EditorSession and original IDB',
  'stale second-tab Revision denied','changed hint TOCTOU denied',
  'forged Native hint denied', 'missing DB denied without creation',
  '320px CSS200 panel', 'no POST/offhost'],errors,unsafe}));
 await context.close();
}finally{await browser.close();}
