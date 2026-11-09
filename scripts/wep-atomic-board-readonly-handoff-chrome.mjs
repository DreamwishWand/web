import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=(process.env.WEP_ATOMIC_HANDOFF_ORIGIN||'http://127.0.0.1:4312').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:/);
assert.ok(process.env.CHROME_BIN,'NOT_RUN: actual system Chrome required');
for(const key of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH'])
 assert.ok(!process.env[key],'Private Save forbidden in browser CI');
const fixture={
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'atomic-board-readonly'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
  {editorId:'stage-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage A',worldClass:'FurnitureItemData'}},
  {editorId:'stage-b',itemId:40000050,layer:'furniture',x:4,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage B',worldClass:'FurnitureItemData'}},
  {editorId:'stage-c',itemId:40000052,layer:'furniture',x:10,y:4,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage C',worldClass:'FurnitureItemData'}},
  {editorId:'stage-road',itemId:30000001,layer:'road',x:14,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Road',worldClass:'FenceAndRoadItemData'}}
 ]
};
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:640,height:900}});
 const page=await context.newPage(),errors=[],unsafe=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{
  if((r.url().startsWith('http')&&!r.url().startsWith(origin))||r.method()==='POST')
    unsafe.push(r.method()+' '+r.url());
 });
 await page.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-atomic-ready="true"]').waitFor();
 await page.locator('[data-atomic-catalog="ready"]').waitFor();
 // Deliberately corrupt old Store. Atomic IDB receiver MUST NOT parse/migrate it.
 await page.evaluate(()=>localStorage.setItem('dreamwishwand:moodboards:v1','{legacy-corrupt'));
 await page.locator('[data-atomic-title]').fill('WEP read-only local IDB');
 await page.locator('[data-atomic-create]').click();
 await page.locator('[data-atomic-board]').waitFor();
 await page.locator('[data-atomic-item-id]').fill('40000048');
 await page.locator('[data-atomic-save-item]').click();
 await page.locator('[data-atomic-item="40000048"]').waitFor();
 const revision=Number(await page.locator('[data-atomic-first-board]').getAttribute('data-atomic-revision'));
 assert.equal(revision,2);
 const oldBefore=await page.evaluate(()=>({
  main:localStorage.getItem('dreamwishwand:moodboards:v1'),
  backup:localStorage.getItem('dreamwishwand:moodboards:v1:backup')
 }));
 const hint=await page.evaluate(async()=>{
  const open=indexedDB.open('dreamwishwand:moodboards:atomic-first:v1',1);
  const db=await new Promise((resolve,reject)=>{
   open.onsuccess=()=>resolve(open.result);
   open.onerror=()=>reject(open.error);
  });
  const row=await new Promise((resolve,reject)=>{
   const tx=db.transaction('snapshots','readonly');
   const request=tx.objectStore('snapshots').get('first');
   tx.oncomplete=()=>resolve(request.result);
   tx.onerror=()=>reject(tx.error);
  });
  db.close();
  const board=JSON.parse(row.primary).boards[0];
  return {schema:'dreamwish-wand-world-editor-handoff@1',version:1,
   sourceSurface:'atomic-moodboard',intent:'ATOMIC_MOODBOARD',
   boardId:row.boardId,revision:row.revision,referenceId:board.references[0].id,
   createdAt:'2026-11-09T00:00:00.000Z',
   persistentWriteAuthorized:false,productApplyAuthorized:false,
   directSourceReplacementAuthorized:false};
 });
 await page.evaluate(hint=>localStorage.setItem('dreamwishwand:world-editor:handoff:v1',JSON.stringify(hint)),hint);
 await page.goto(origin+'/editor/world/',{waitUntil:'domcontentloaded'});
 // The explicit IDB Handoff causes a hydrated pre-source panel; unlike SSR
 // file input visibility alone, this proves the Svelte handler is bound.
 await page.locator('[data-wep-pre-source-stage1] [data-wep-atomic-revision]').waitFor({timeout:30000});
 await page.locator('.load-panel input[type=file]').setInputFiles({
  name:'wep-atomic-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))
 });
 try {
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:30000});
 } catch (error) {
  console.error('SYNTHETIC_IMPORT_STATUS',JSON.stringify(await page.locator('.status').allTextContents()));
  console.error('SYNTHETIC_IMPORT_BODY',String(await page.locator('body').innerText()).slice(-3500));
  throw error;
 }
 const panel=page.locator('[data-wep-decorate-stage1]');
 await panel.locator('[data-wep-atomic-open]:not([disabled])').click();
 await panel.locator('[data-wep-atomic-revision]').waitFor();
 await panel.locator('[data-wep-atomic-select]').filter({hasText:'40000048'}).click();
 const pending=panel.locator('.pending-card');
 await pending.locator('input[type=number]').nth(0).fill('7');
 await pending.locator('input[type=number]').nth(1).fill('7');
 await pending.locator('button').last().click();
 await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').first().waitFor();
 assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),1);
 const observer=await context.newPage();
 await observer.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'});
 await observer.locator('[data-atomic-ready="true"]').waitFor();
 assert.equal(Number(await observer.locator('[data-atomic-first-board]').getAttribute('data-atomic-revision')),revision,
  'WEP local Draft selection must NOT commit IDB');
 // New user selection on WEP, but another tab then changes IDB Revision.
 await panel.locator('[data-wep-atomic-open]').click();
 await panel.locator('[data-wep-atomic-select]').filter({hasText:'40000048'}).click();
 await observer.locator('[data-atomic-item-id]').fill('40000048');
 await observer.locator('[data-atomic-save-item]').click();
 await observer.locator('[data-atomic-items] [data-atomic-item="40000048"]').waitFor({state:'detached'});
 await pending.locator('button').last().click();
 await panel.locator('.stage1-status').filter({hasText:/Board|Revision|Item|ボード|修订/i}).first().waitFor();
 assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),1,
  'newer IDB revision must not add a second Draft command');
 const oldAfter=await page.evaluate(()=>({
  main:localStorage.getItem('dreamwishwand:moodboards:v1'),
  backup:localStorage.getItem('dreamwishwand:moodboards:v1:backup')
 }));
 assert.deepEqual(oldAfter,oldBefore,'legacy old Store and Backup byte invariant');
 await page.setViewportSize({width:320,height:900});
 const metrics=await panel.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
 assert.ok(metrics.scroll<=metrics.client+2,'320px stage1 receiver overflow');
 assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({operation:'WEP_ATOMIC_IDB_BOARD_TO_WORLD_EDITOR_READONLY_DRAFT_HANDOFF',
  cases:['positive verified IDB Item','stale Revision denied','legacy malformed raw unchanged','320px no overflow'],
  source:'SYNTHETIC_ONLY',chrome:'ACTUAL_INSTALLED',unsafe,errors,metrics}));
 await context.close();
}finally{await browser.close();}
