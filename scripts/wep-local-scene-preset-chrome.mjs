import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=(process.env.WEP_LOCAL_SCENE_ORIGIN||'http://127.0.0.1:4347').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:/);
assert.ok(process.env.CHROME_BIN,'Actual installed Chrome required');
const boardKey='dreamwishwand:moodboards:v1',handoffKey='dreamwishwand:world-editor:handoff:v1';
const now='2026-11-09T00:00:00.000Z';
const legacy={schema:'wand.moodboards.local@1',version:2,updatedAt:now,boards:[{
 id:'scene-test-board',title:'Unchanged Old Moodboard',description:null,createdAt:now,updatedAt:now,
 groups:[{id:'g',title:'group',order:0,collapsed:false}],
 references:[{id:'r',type:'ITEM',label:'Stage1 Furniture',entityId:'40000048',
 groupIds:['g'],createdAt:now,note:null,url:null}]
}]};
const legacyRaw=JSON.stringify(legacy);
const fixture={schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'local-scene-only'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
  {editorId:'stage-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'A',worldClass:'FurnitureItemData'}},
  {editorId:'stage-b',itemId:40000050,layer:'furniture',x:4,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'B',worldClass:'FurnitureItemData'}}
 ]};
const errors=[],unsafe=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const attach=page=>{
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{if((r.url().startsWith('http')&&!r.url().startsWith(origin))||r.method()==='POST')
   unsafe.push(r.method()+' '+r.url());});
 };
 async function openEditor(){
  const page=await context.newPage();attach(page);
  await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
  await page.evaluate(([k,h,raw])=>{localStorage.setItem(k,raw);localStorage.removeItem(h);},[boardKey,handoffKey,legacyRaw]);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Open in World Editor'}).click();
  await page.waitForURL(/\/editor\/world\/?$/);
  await page.locator('[data-wep-decorate-stage1] .reference-main').filter({hasText:'Stage1 Furniture'}).click();
  await page.locator('.load-panel input[type=file]').setInputFiles({
   name:'local-scene-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))
  });
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:30000});
  return page;
 }
 const page=await openEditor();
 const staleTab=await openEditor();
 async function capture(page,id,title){
  await page.locator('[data-editor-object-id="'+id+'"]').click();
  await page.locator('.capture-panel input').first().fill(title);
  await page.getByRole('button',{name:'Capture Preview'}).click();
  await page.locator('[data-wep-local-scene-save]:not([disabled])').waitFor();
 }
 await capture(page,'stage-a','Local Scene One');
 await page.locator('[data-wep-local-scene-save]').click();
 await page.locator('[data-wep-local-scene-status]').filter({hasText:'saved and independently reopened'}).waitFor();
 const snapshot=async(page)=>page.evaluate(()=>new Promise((resolve,reject)=>{
  const req=indexedDB.open('dreamwishwand:wep:scene-presets:local:v1',1);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction('snapshots','readonly'),get=tx.objectStore('snapshots').get('library');
   tx.oncomplete=()=>{db.close();resolve(get.result);};
   tx.onerror=()=>{db.close();reject(tx.error);};
  };
 }));
 const first=await snapshot(page);
 assert.equal(first.revision,1);
 const firstDoc=JSON.parse(first.primary);
 assert.equal(firstDoc.entries.length,1);
 assert.equal(JSON.parse(first.backup).entries.length,0);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),legacyRaw);
 // Another tab began before the first commit: stale CAS 0 must fail closed.
 await capture(staleTab,'stage-a','Stale Scene');
 await staleTab.locator('[data-wep-local-scene-save]').click();
 await staleTab.locator('[data-wep-local-scene-status]').filter({hasText:'unavailable or changed'}).waitFor();
 assert.deepEqual(await snapshot(page),first,'stale CAS cannot overwrite primary or Backup');
 // The accepted first tab commits revision 2; Backup must be exact prior primary.
 await capture(page,'stage-b','Local Scene Two');
 await page.locator('[data-wep-local-scene-save]').click();
 await page.locator('[data-wep-local-scene-status]').filter({hasText:'saved and independently reopened'}).waitFor();
 const second=await snapshot(page);
 assert.equal(second.revision,2);
 assert.equal(second.backupRevision,1);
 assert.equal(second.backup,first.primary);
 assert.equal(JSON.parse(second.primary).entries.length,2);
 // Independent second tab Reopen, choose saved Scene in readonly consumer.
 await staleTab.locator('[data-wep-local-scene-reopen]').click();
 await staleTab.locator('[data-wep-local-scene-entries] [data-wep-local-scene-read]').first().waitFor();
 assert.equal(await staleTab.locator('[data-wep-local-scene-read]').count(),2);
 await staleTab.locator('[data-wep-local-scene-read]').first().click();
 await staleTab.locator('[data-wep-local-scene-preview]').waitFor();
 assert.match(await staleTab.locator('[data-wep-local-scene-preview] code').innerText(),/writeReady=false/);
 for(const [width,zoom] of [[320,'1'],[640,'2']]){
  await staleTab.setViewportSize({width,height:900});
  await staleTab.evaluate(z=>{document.documentElement.style.zoom=z;},zoom);
  const m=await staleTab.locator('[data-wep-local-scene]').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  assert.ok(m.scroll<=m.client+2,'local Scene panel inner overflow '+width+' zoom '+zoom+': '+JSON.stringify(m));
 }
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),legacyRaw);
 assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({operation:'WEP_SCENE_PRESET_LOCAL_IDB_CAS_BACKUP_REOPEN_READONLY',
  evidence:'ACTUAL_INSTALLED_CHROME_SYNTHETIC_ONLY',
  assertions:['explicit local capture','primary and backup in one IDB transaction','new tab stale CAS rejected',
   'exact old primary byte preserved as Backup','independent Reopen read-only','legacy Moodboard unchanged',
   '320px and CSS200 panel no inner overflow','no POST/offhost/JS error'],
  revisions:[first.revision,second.revision],unsafe,errors}));
 await context.close();
}finally{await browser.close();}
