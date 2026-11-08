// 04 QR-W changed-only independent QA of Source PR775 stale Moodboard handoff guard.
// Source accepted Stage1 Chrome suite is inherited. This QA uniquely checks that the
// *current handoff ref/group* still equals the pending selected ref/group before Draft insert.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {
 verifyCurrentMoodboardItemPlacement,verifyCurrentMoodboardEditorSession
} from '../src/lib/wep/world-editor-moodboard-placement-guard.mjs';
import {worldEditorStage1Copy,WORLD_EDITOR_STAGE1_LOCALES} from '../src/lib/wep/world-editor-stage1-copy.js';
const MAIN='b7d86d47125f1764919b67898c39badaf35976d8';
const SOURCE='ce0525daf47b49122475027dcc2df175fcc22f11';
const expected=new Map([
 ['docs/wep/world-editor-localization-inventory-20261002.json','8c1433e8ee6bed359624a53d886d418daec2e30d'],
 ['scripts/wep-decorate-stage1-browser-acceptance.mjs','17970ffe3fb61271588e81fdf77ae026a86f9ca3'],
 ['src/lib/wep/WorldEditorStage1DecoratePanel.svelte','0fd1395ae3b67fe6142042bfb041c6e1cd8f85c9'],
 ['src/lib/wep/world-editor-moodboard-placement-guard.mjs','91b6c0fe4dd3b19fd4ccc9e528245859913d24b6'],
 ['src/lib/wep/world-editor-stage1-copy.js','a6e5efd66bcd3dac6cd9608da5592cfac646e0ab'],
 ['tests/wep-moodboard-stale-handoff.test.mjs','fbb5a87c257e9064339b26970275c86be9a67f5d']
]);
const qa=['.github/workflows/04qr-w-pr775-handoff-identity-independent-20261108.yml',
 'scripts/04qr-w-pr775-handoff-identity-independent-20261108.mjs'].sort();
const git=(...s)=>execFileSync('git',s,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
assert.equal(git('rev-list','--count',MAIN+'..'+SOURCE),'9');
assert.deepEqual(diff(MAIN,SOURCE),[...expected.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(SOURCE,'HEAD'),qa);
for(const [p,sha] of expected){
 assert.equal(git('rev-parse',SOURCE+':'+p),sha,'original Source fixed blob '+p);
 assert.equal(git('hash-object',p),sha,'QA cannot change Source '+p);
}
for(const k of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK']){
 assert.ok(!process.env[k],'Owner private file forbidden '+k);
}
console.log('QRW775_FIXED_SOURCE6_AND_QA2_GIT_INVARIANTS_PASS');
const ts='2026-11-08T00:00:00.000Z';
const boardKey='dreamwishwand:moodboards:v1';
const handoffKey='dreamwishwand:world-editor:handoff:v1';
const seed={
 schema:'wand.moodboards.local@1',version:2,updatedAt:ts,
 boards:[{id:'stage1-board',title:'Stage 1 Board',description:'Independent QA',
 createdAt:ts,updatedAt:ts,groups:[{id:'stage1-group',title:'Beach Corner',order:0,collapsed:false}],
 references:[
  {id:'stage1-item',type:'ITEM',label:'Stage 1 Furniture',entityId:'40000048',
   groupIds:['stage1-group'],createdAt:ts,note:null,url:null},
  {id:'stage1-note',type:'NOTE',label:'Other note',entityId:null,groupIds:['stage1-group'],createdAt:ts,note:null,url:null}
 ]}]
};
const unchanged=JSON.stringify(seed);
const synthetic={
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'stage1-browser'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
 {editorId:'stage-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage A',worldClass:'FurnitureItemData'}},
 {editorId:'stage-b',itemId:40000050,layer:'furniture',x:4,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage B',worldClass:'FurnitureItemData'}},
 {editorId:'stage-c',itemId:40000052,layer:'furniture',x:10,y:4,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Stage C',worldClass:'FurnitureItemData'}},
 {editorId:'stage-road',itemId:30000001,layer:'road',x:14,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Road',worldClass:'FenceAndRoadItemData'}}
 ]
};
const verified=new Map([[40000048,{itemId:40000048,label:'Stage 1 Furniture'}]]);
const pending={boardId:'stage1-board',referenceId:'stage1-item',groupId:'stage1-group',itemId:40000048};
const oldStorage={getItem:k=>{assert.equal(k,boardKey);return unchanged;},setItem(){throw Error('forbidden Moodboard write');}};
const res=verifyCurrentMoodboardItemPlacement(oldStorage,pending,verified);
assert.equal(res.persistentWriteAuthorized,false);
assert.equal(res.reference.id,pending.referenceId);
assert.equal(verifyCurrentMoodboardEditorSession({getDocument(){return {target:synthetic.target};}},
 {target:synthetic.target}),true);
for(const lang of WORLD_EDITOR_STAGE1_LOCALES)assert.ok(worldEditorStage1Copy(lang).staleReference?.length>20,lang);
console.log('QRW775_NEW_ONLY_GUARD_SOURCE_READONLY_8_LOCALE_COPY_PASS');

const origin=(process.env.QRW775_LOCAL_ORIGIN||'http://127.0.0.1:4301').replace(/\/$/,'');
assert.match(origin,/^http:\/\/127\.0\.0\.1:/);
assert.ok(process.env.CHROME_BIN,'NOT_RUN: installed Chrome required');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const unsafe=[],jsErrors=[];
page.on('pageerror',e=>jsErrors.push(String(e)));
await page.route('**/*',route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin===origin&&['GET','HEAD'].includes(r.method()))route.continue();
 else {unsafe.push(r.method()+' '+r.url());route.abort('blockedbyclient');}
});
const until=async(f)=>{
 for(let j=0;j<50;j++){if(await f())return;await new Promise(r=>setTimeout(r,160));}
 throw Error('Timed out waiting for independent WEP scene condition');
};
const load=async()=>{
 await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
 await page.evaluate(([b,h,raw])=>{localStorage.setItem(b,raw);localStorage.removeItem(h);},[boardKey,handoffKey,unchanged]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Open in World Editor'}).waitFor({timeout:25000});
 await page.getByRole('button',{name:'Open in World Editor'}).click();
 await page.waitForURL(/\/editor\/world\/?$/,{timeout:25000});
 const p=page.locator('[data-wep-decorate-stage1]');
 await p.locator('.reference-main').filter({hasText:'Stage 1 Furniture'}).click();
 const h=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),handoffKey);
 assert.deepEqual([h.boardId,h.referenceId,h.groupId],['stage1-board','stage1-item','stage1-group']);
 await page.locator('.load-panel input[type="file"]').setInputFiles({
   name:'qrw775-newonly-editor-draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(synthetic))
 });
 await page.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:30000});
 const pendingCard=p.locator('.pending-card').first();
 await pendingCard.locator('input[type="number"]').nth(0).fill('7');
 await pendingCard.locator('input[type="number"]').nth(1).fill('7');
 assert.equal(await page.locator('g[data-editor-object]').count(),4,'no old draft mutations');
 assert.equal(await p.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),0);
 return p;
};
try {
 let p=await load();
 const button=p.locator('.pending-card').first().getByRole('button',{name:'Place'});
 await button.focus();await page.keyboard.press('Enter');
 await until(async()=>await page.locator('g[data-editor-object]').count()===5);
 assert.equal(await p.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),1);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),unchanged);
 console.log('QRW775_VALID_SAME_BOARD_REF_GROUP_ITEM_SESSION_DRAFT_ONLY_ONE_MUTATION_PASS');
 const immersive=page.locator('[data-shared-app-shell][data-shell-presentation="immersive"]');
 const settings=immersive.locator('button.immersive-settings');
 assert.equal(await settings.isVisible(),true,'real WEP immersive settings access');
 await settings.focus();await page.keyboard.press('Enter');
 const localeSelect=page.locator('#site-locale-mobile');
 await localeSelect.waitFor({state:'visible',timeout:12000});
 const beforeLocale=await p.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count();
 for(const lang of WORLD_EDITOR_STAGE1_LOCALES){
   await localeSelect.selectOption(lang);
   await page.waitForFunction(expected=>document.documentElement.lang===expected,lang);
   assert.equal(await p.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),beforeLocale,
     lang+' locale must not mutate Draft');
 }
 await localeSelect.selectOption('en');
 await page.keyboard.press('Escape');
 await localeSelect.waitFor({state:'hidden'});
 console.log('QRW775_REAL_CHROME_8_LOCALE_IMMERSIVE_KEYBOARD_AND_DRAFT_IMMUTABLE_PASS');
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await p.evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth}));
 if(zoom.scroll>zoom.client+2)console.error('QRW775_ZOOM200_WEP_PANEL_OVERFLOW_OBSERVED_EXISTING_LAYOUT_SCOPE_UNCLASSIFIED '+JSON.stringify(zoom));
 else console.log('QRW775_ZOOM200_PANEL_NO_OVERFLOW_PASS');
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:320,height:844});
 const mobile=await p.evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth}));
 if(mobile.scroll>mobile.client+2)console.error('QRW775_MOBILE320_WEP_PANEL_OVERFLOW_OBSERVED_EXISTING_LAYOUT_SCOPE_UNCLASSIFIED '+JSON.stringify(mobile));
 else console.log('QRW775_MOBILE320_PANEL_NO_OVERFLOW_PASS');
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),unchanged);
 console.log('QRW775_REAL_CHROME_ZOOM200_MOBILE320_LAYOUT_MEASURED_PASS_OR_OBSERVED_REPORTED');
 await page.setViewportSize({width:1440,height:1000});

 p=await load();
 const oldPending=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),handoffKey);
 assert.equal(oldPending.referenceId,'stage1-item');
 // Distinct NEW_ONLY seam, absent from the Source Chrome modes:
 // current persisted navigation hint changes to a different ref in SAME Board.
 // Source checks currentHandoff.boardId only; both references still exist.
 await page.evaluate(k=>{
   const now=JSON.parse(localStorage.getItem(k));
   now.referenceId='stage1-note'; // same board, group; incompatible NOTE, not pending ITEM
   localStorage.setItem(k,JSON.stringify(now));
 },handoffKey);
 const current=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),handoffKey);
 assert.equal(current.boardId,oldPending.boardId);
 assert.notEqual(current.referenceId,oldPending.referenceId);
 await p.locator('.pending-card').first().getByRole('button',{name:'Place'}).focus();
 await page.keyboard.press('Enter');
 const objectCount=await page.locator('g[data-editor-object]').count();
 const historyCount=await p.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count();
 const sourceAfter=await page.evaluate(k=>localStorage.getItem(k),boardKey);
 assert.equal(sourceAfter,unchanged,'Moodboard Store must never be overwritten');
 if(objectCount!==4||historyCount!==0){
   console.error('QRW775_TRUE_RED_SAME_BOARD_DIFFERENT_HANDOFF_REF_ACCEPTED '+JSON.stringify({
     oldRef:oldPending.referenceId,newRef:current.referenceId,oldGroup:oldPending.groupId,newGroup:current.groupId,
     objectCount,historyCount,storeUnchanged:sourceAfter===unchanged
   }));
   throw new Error('TRUE_RED_SCOPED: WEP live Draft insertion authorized using pending old ref while persisted handoff ref changed in same Board. Require currentHandoff.referenceId and groupId equality.');
 }
 await p.locator('.stage1-status').filter({hasText:worldEditorStage1Copy('en').staleReference}).waitFor({timeout:12000});
 console.log('QRW775_CURRENT_HANDOFF_SAME_BOARD_DIFFERENT_REFERENCE_FAILCLOSED_PASS');
 assert.deepEqual(jsErrors,[]);
 assert.deepEqual(unsafe,[]);
 console.log('QRW775_FOCUSED_INDEPENDENT_CHROME_SCOPED_PASS');
}finally {await browser.close();}
