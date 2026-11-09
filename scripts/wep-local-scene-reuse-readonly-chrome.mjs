import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=(process.env.WEP_SCENE_REUSE_ORIGIN||'http://127.0.0.1:4352').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:/);
assert.ok(process.env.CHROME_BIN,'Actual installed Chrome is required');
const errors=[],unsafe=[];
const boardKey='dreamwishwand:moodboards:v1';
const handoffKey='dreamwishwand:world-editor:handoff:v1';
const now='2026-11-09T00:00:00.000Z';
const legacyRaw=JSON.stringify({schema:'wand.moodboards.local@1',version:2,updatedAt:now,boards:[{
 id:'scene-reuse-fixture',title:'Unchanged Moodboard',description:null,createdAt:now,updatedAt:now,
 groups:[{id:'g',title:'group',order:0,collapsed:false}],
 references:[{id:'r',type:'ITEM',label:'Stage1 Furniture',entityId:'40000048',
  groupIds:['g'],createdAt:now,note:null,url:null}]
}]});
const fixture={schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'local-only-draft'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
 {editorId:'stage-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{}},
 {editorId:'stage-b',itemId:40000050,layer:'furniture',x:4,y:2,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{}}
]};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const attach=page=>{
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{if((r.url().startsWith('http')&&!r.url().startsWith(origin))||
   ['POST','PUT','PATCH','DELETE'].includes(r.method()))unsafe.push(r.method()+' '+r.url());});
 };
 async function editor(){
  const page=await context.newPage();attach(page);
  await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
  await page.evaluate(([key,handoff,raw])=>{
   localStorage.setItem(key,raw);localStorage.removeItem(handoff);
  },[boardKey,handoffKey,legacyRaw]);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open in World Editor'}).click();
  await page.waitForURL(/\/editor\/world\/?$/);
  await page.locator('[data-wep-decorate-stage1] .reference-main')
   .filter({hasText:'Stage1 Furniture'}).click();
  await page.locator('.load-panel input[type=file]').setInputFiles({
   name:'synthetic-draft-only.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(fixture))});
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:30000});
  return page;
 }
 async function capture(page,id,title){
  await page.locator('[data-editor-object-id="'+id+'"]').click();
  await page.locator('.capture-panel input').first().fill(title);
  await page.getByRole('button',{name:'Capture Preview'}).click();
  await page.locator('[data-wep-local-scene-save]:not([disabled])').waitFor();
  await page.locator('[data-wep-local-scene-save]').click();
  await page.locator('[data-wep-local-scene-status]').filter({hasText:'saved and independently reopened'}).waitFor();
 }
 const snapshot=page=>page.evaluate(()=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('dreamwishwand:wep:scene-presets:local:v1',1);
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction('snapshots','readonly'),get=tx.objectStore('snapshots').get('library');
   tx.oncomplete=()=>{db.close();resolve(get.result);};
   tx.onerror=()=>{db.close();reject(tx.error);};
  };
 }));
 const page=await editor();
 await capture(page,'stage-a','Scene Draft One');
 const before=await snapshot(page);
 assert.equal(before.revision,1);
 const row=page.locator('[data-wep-local-scene-read]').first();
 await row.click();
 await page.locator('[data-wep-local-scene-reuse]').click();
 const draft=page.locator('[data-wep-local-scene-draft]');
 await draft.waitFor();
 assert.match(await draft.innerText(),/writeReady=false \/ applyReady=false/);
 assert.match(await draft.innerText(),/40000049/);
 assert.ok(await page.locator('[data-editor-object-id="stage-a"]').count(),'original Editor remains present');
 assert.deepEqual(await snapshot(page),before,'read-only reuse never mutates local Scene primary/Backup');
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),boardKey),legacyRaw,
  'old Moodboard must remain byte identical');
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(z=>document.documentElement.style.zoom=z,zoom);
  const box=await page.locator('[data-wep-local-scene]').evaluate(el=>({
   client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(box.scroll<=box.client+2,'responsive local-scene panel overflow: '+JSON.stringify({width,zoom,box}));
 }
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:1440,height:900});
 const stale=await editor();
 await stale.locator('[data-wep-local-scene-reopen]').click();
 await stale.locator('[data-wep-local-scene-read]').first().click();
 await stale.locator('[data-wep-local-scene-reuse]').waitFor();
 await capture(page,'stage-b','Scene Draft Two');
 const after=await snapshot(page);
 assert.equal(after.revision,2);
 assert.equal(after.backup,before.primary);
 await stale.locator('[data-wep-local-scene-reuse]').click();
 await stale.locator('[data-wep-local-scene-reuse-status]')
  .filter({hasText:'Draft denied'}).waitFor();
 assert.equal(await stale.locator('[data-wep-local-scene-draft]').count(),0,
  'stale revision must not create a detached Draft');
 assert.deepEqual(await snapshot(stale),after,'stale Draft attempt cannot change CAS primary/Backup');
 assert.deepEqual(errors,[]);assert.deepEqual(unsafe,[]);
 console.log(JSON.stringify({operation:'WEP_LOCAL_SCENE_REUSE_DETACHED_READONLY_DRAFT@1',
  evidence:'ACTUAL_INSTALLED_CHROME_SYNTHETIC_ONLY',revision:after.revision,
  assertions:['explicit only','detached local coordinates','Writer Apply false',
   'no session mutation','primary Backup byte exact','cross-tab stale denied',
   '320px CSS200 no inner overflow','no unsafe network or JS error'],
  errors,unsafe}));
 await context.close();
}finally{await browser.close();}
