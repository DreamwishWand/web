// 04 QR-W changed-only independent QA of Source PR775 stale Moodboard handoff guard.
// Source accepted Stage1 Chrome suite is inherited. This QA uniquely checks that the
// *current handoff ref/group* still equals the pending selected ref/group before Draft insert.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {
 verifyCurrentMoodboardItemPlacement,verifyCurrentMoodboardEditorSession,verifyCurrentMoodboardHandoffIdentity
} from '../src/lib/wep/world-editor-moodboard-placement-guard.mjs';
import {worldEditorStage1Copy,WORLD_EDITOR_STAGE1_LOCALES} from '../src/lib/wep/world-editor-stage1-copy.js';
const MAIN='b7d86d47125f1764919b67898c39badaf35976d8';
// Accepted StageH from the newer protected main is path-disjoint and is not retested.
const SOURCE='849c27f153d431c7b7f9fa57456f85d3b429d474';
const expected=new Map([
 ['docs/wep/world-editor-localization-inventory-20261002.json','dbb95382e96c6778af5b9f89207ffc17d9611ffd'],
 ['scripts/wep-decorate-stage1-browser-acceptance.mjs','913e02cb0abec2f094e4205294ac2f54f20cbdfa'],
 ['src/lib/wep/WorldEditorStage1DecoratePanel.svelte','d18a798976a2704b5cb7eb8eebd39951c328f46a'],
 ['src/lib/wep/world-editor-moodboard-placement-guard.mjs','f8a9c2e21c284df503972fa16a2443ca89540f9b'],
 ['src/lib/wep/world-editor-stage1-copy.js','a6e5efd66bcd3dac6cd9608da5592cfac646e0ab'],
 ['tests/wep-moodboard-stale-handoff.test.mjs','f95f08f43887b88333f677ea64a3e86bf5c1d716']
]);
const qa=['.github/workflows/04qr-w-pr775-repaired-handoff-newonly-20261108.yml',
 'scripts/04qr-w-pr775-repaired-handoff-newonly-20261108.mjs'].sort();
const git=(...s)=>execFileSync('git',s,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',MAIN,SOURCE),MAIN);
assert.equal(git('rev-list','--count',MAIN+'..'+SOURCE),'14');
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
console.log('QRW775_REPAIRED_FIXED_SOURCE6_AND_QA2_GIT_INVARIANTS_PASS');
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
console.log('QRW775_REPAIRED_NEW_ONLY_GUARD_SOURCE_READONLY_8_LOCALE_COPY_PASS');

const frozenSelection={
 schema:'dreamwish-wand-world-editor-handoff@1',version:1,
 sourceSurface:'moodboard',intent:'MOODBOARD',boardId:'stage1-board',
 referenceId:'stage1-item',groupId:'stage1-group',createdAt:'2026-11-08T00:00:00.000Z',
 persistentWriteAuthorized:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false
};
const frozenPending={referenceId:'stage1-item',groupId:'stage1-group'};
assert.equal(verifyCurrentMoodboardHandoffIdentity({...frozenSelection},frozenSelection,frozenPending),true);
for(const [label,mod] of [
 ['NOTE',{referenceId:'stage1-note'}],
 ['OTHER_ITEM',{referenceId:'stage1-other-item'}],
 ['OTHER_GROUP',{groupId:null}],
 ['NEW_SELECTION_TIME',{createdAt:'2026-11-08T04:00:00.000Z'}],
 ['UNSAFE_WRITER_FLAG',{productApplyAuthorized:true}]
]){
 assert.throws(()=>verifyCurrentMoodboardHandoffIdentity(
  {...frozenSelection,...mod},frozenSelection,frozenPending
 ),/WEP_MOODBOARD_STALE_HANDOFF_IDENTITY/,label);
}
console.log('QRW775_REPAIRED_NEW_CURRENT_HANDOFF_IDENTITY_NODE_NEW_ONLY_NEGATIVES_PASS');


const origin=(process.env.QRW775_REPAIRED_LOCAL_ORIGIN||'http://127.0.0.1:4301').replace(/\/$/,'');
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
   name:'qrw775-repaired-newonly-editor-draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(synthetic))
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
 console.log('QRW775_REPAIRED_VALID_SAME_BOARD_REF_GROUP_ITEM_SESSION_DRAFT_ONLY_ONE_MUTATION_PASS');
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
 console.log('QRW775_REPAIRED_REAL_CHROME_8_LOCALE_IMMERSIVE_KEYBOARD_AND_DRAFT_IMMUTABLE_PASS');
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await p.evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth}));
 if(zoom.scroll>zoom.client+2){
   console.error('QRW775_REPAIRED_ZOOM200_WEP_PANEL_OVERFLOW_OBSERVED_SCOPE_ATTRIBUTION_UNKNOWN '+JSON.stringify(zoom));
 } else console.log('QRW775_REPAIRED_ZOOM200_WEP_PANEL_NO_OVERFLOW_PASS');
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:320,height:844});
 const mobile=await p.evaluate(node=>({client:node.clientWidth,scroll:node.scrollWidth}));
 if(mobile.scroll>mobile.client+2){
   console.error('QRW775_REPAIRED_MOBILE320_WEP_PANEL_OVERFLOW_OBSERVED_SCOPE_ATTRIBUTION_UNKNOWN '+JSON.stringify(mobile));
 } else console.log('QRW775_REPAIRED_MOBILE320_PANEL_NO_OVERFLOW_PASS');
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),unchanged);
 await page.setViewportSize({width:1440,height:1000});
 console.log('QRW775_REPAIRED_200ZOOM_320PX_LAYOUT_MEASURED_NOT_ASSUMED_PASS');
 const modes=['note','other-item','wrong-group','new-intent'];
 for(const mode of modes){
   p=await load();
   const beforeHandoff=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),handoffKey);
   assert.deepEqual([beforeHandoff.boardId,beforeHandoff.referenceId,beforeHandoff.groupId],
    ['stage1-board','stage1-item','stage1-group'],mode+' source initial handoff');
   const beforeRaw=await page.evaluate(k=>localStorage.getItem(k),boardKey);
   const changed=await page.evaluate(({mode,handoffKey,boardKey})=>{
     const live=JSON.parse(localStorage.getItem(handoffKey));
     let canonical=localStorage.getItem(boardKey);
     if(mode==='note')live.referenceId='stage1-note';
     if(mode==='other-item'){
       const doc=JSON.parse(canonical);
       doc.boards[0].references.push({
         id:'stage1-other-item',type:'ITEM',label:'Verified Other Furniture',
         entityId:'40000049',url:null,note:null,groupIds:['stage1-group'],
         createdAt:'2026-11-08T00:00:00.000Z'
       });
       canonical=JSON.stringify(doc);
       localStorage.setItem(boardKey,canonical);
       live.referenceId='stage1-other-item';
     }
     if(mode==='wrong-group')live.groupId=null;
     if(mode==='new-intent')live.createdAt='2026-11-08T04:00:00.000Z';
     localStorage.setItem(handoffKey,JSON.stringify(live));
     return {canonical,live};
   },{mode,handoffKey,boardKey});
   assert.equal(changed.live.boardId,beforeHandoff.boardId);
   assert.notDeepEqual(changed.live,beforeHandoff,'must exercise modified intent '+mode);
   assert.ok(changed.canonical===beforeRaw || mode==='other-item');
   const pendingCard=p.locator('.pending-card').first();
   await pendingCard.getByRole('button',{name:'Place'}).focus();
   await page.keyboard.press('Enter');
   await p.locator('.stage1-status').filter({
     hasText:worldEditorStage1Copy('en').staleReference
   }).waitFor({timeout:12000});
   assert.equal(await page.locator('g[data-editor-object]').count(),4,
     mode+' must prevent old selected ITEM insertion');
   assert.equal(await p.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),0,
     mode+' must not grow Draft history');
   assert.equal(await p.locator('.pending-card').count(),0,
     mode+' must clear selected old ITEM');
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),boardKey),changed.canonical,
     mode+' must never overwrite canonical Moodboard raw');
   // A stale selection must not be silently revived by a second keyboard Enter.
   await page.keyboard.press('Enter');
   assert.equal(await page.locator('g[data-editor-object]').count(),4,
     mode+' replay should not insert');
   console.log('QRW775_REPAIRED_REAL_CHROME_LIVE_HANDOFF_'+mode.toUpperCase().replaceAll('-','_')+
    '_ZERO_INSERT_ZERO_HISTORY_CLEAR_OLD_INTENT_AND_STORE_UNCHANGED_PASS');
 }
 assert.deepEqual(jsErrors,[]);
 assert.deepEqual(unsafe,[]);
 console.log('QRW775_REPAIRED_SCOPED_INDEPENDENT_CHROME_ALL_FOUR_HANDOFF_NEGATIVES_PASS');
t();
 const sourceAfter=await page.evaluate(k=>localStorage.getItem(k),boardKey);
 assert.equal(sourceAfter,unchanged,'Moodboard Store must never be overwritten');
 if(objectCount!==4||historyCount!==0){
   console.error('QRW775_REPAIRED_TRUE_RED_SAME_BOARD_DIFFERENT_HANDOFF_REF_ACCEPTED '+JSON.stringify({
     oldRef:oldPending.referenceId,newRef:current.referenceId,oldGroup:oldPending.groupId,newGroup:current.groupId,
     objectCount,historyCount,storeUnchanged:sourceAfter===unchanged
   }));
   throw new Error('TRUE_RED_SCOPED: WEP live Draft insertion authorized using pending old ref while persisted handoff ref changed in same Board. Require currentHandoff.referenceId and groupId equality.');
 }
 await p.locator('.stage1-status').filter({hasText:worldEditorStage1Copy('en').staleReference}).waitFor({timeout:12000});
 console.log('QRW775_REPAIRED_CURRENT_HANDOFF_SAME_BOARD_DIFFERENT_REFERENCE_FAILCLOSED_PASS');
 assert.deepEqual(jsErrors,[]);
 assert.deepEqual(unsafe,[]);
 console.log('QRW775_REPAIRED_FOCUSED_INDEPENDENT_CHROME_SCOPED_PASS');
}finally {await browser.close();}
