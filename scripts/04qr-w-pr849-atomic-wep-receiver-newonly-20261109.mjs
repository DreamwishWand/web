// 04 QR-W independent changed-only World Editor receiver QA: synthetic browser data only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {verifyAtomicBoardReference,verifyAtomicHandoffIdentity,readExistingAtomicBoard} from '../src/lib/wep/world-editor-atomic-board-guard.mjs';
import {worldEditorStage1Copy,WORLD_EDITOR_STAGE1_LOCALES} from '../src/lib/wep/world-editor-stage1-copy.js';
const SOURCE='fb503bb166836b5ea465c255a8f9ef620e1c22d8';
const BASE='0312614d4995874191541a5f6d2353b2edcffdf0';
const sourceBlobs=new Map([
 ['.github/workflows/wep-atomic-board-readonly-handoff.yml','5d54a0b554c05428e80b5f93a5360d668c3081ed'],
 ['docs/wep/world-editor-localization-inventory-20261002.json','fa53a69998b353adf1d06befedf684f6861d60ca'],
 ['scripts/wep-atomic-board-readonly-handoff-chrome.mjs','a235cd64bcb77e7abbe5fd2db97ccb2f90900854'],
 ['src/lib/wep/WorldEditorStage1DecoratePanel.svelte','32c1834fbb5c5ca42307d81ad0cc5314c616c2ea'],
 ['src/lib/wep/world-editor-atomic-board-guard.mjs','71215a8ab2a0ebd75d5bd74fde4937eba986398f'],
 ['src/lib/wep/world-editor-handoff.ts','2509e86e92ff6795414b09282390be6858439cb3'],
 ['src/lib/wep/world-editor-stage1-copy.js','b5241358967cc0daa7f1cba6870f551810af717d'],
 ['tests/wep-atomic-board-readonly-handoff.test.mjs','994940002eda34c3201e74a33c391000c123016a']
]);
const qaFiles=[
 '.github/workflows/04qr-w-pr849-atomic-wep-receiver-newonly-20261109.yml',
 'scripts/04qr-w-pr849-atomic-wep-receiver-newonly-20261109.mjs'
];
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const paths=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',BASE,SOURCE),BASE);
assert.deepEqual(paths(BASE,SOURCE),[...sourceBlobs.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(paths(SOURCE,'HEAD'),qaFiles.sort());
for(const [path,blob] of sourceBlobs) {
 assert.equal(git('rev-parse',SOURCE+':'+path),blob);
 assert.equal(git('hash-object',path),blob);
}
assert.equal(git('diff','--name-only',BASE,SOURCE,'--',
 'src/routes/moodboards/','src/lib/moodboards/','src/lib/collection/','src/routes/collection/','crates/','supabase/','static/','.github/workflows/pages.yml'),'');
console.log('QRW849_FROZEN_WEP_SOURCE8_QA_ONLY2_NO_STORE_CORE_WEB_DIFF_PASS');

// Independently assert changed risk on newly introduced receiver verifier.
// The localStorage hint is NEVER BoardID/Revision/Item authority.
const bid='board_atomic_abcdefghijk',eid=40000048,rid='ref-qrw-atomic';
const seed=()=>({schema:'wand.moodboards.atomic-first@1',boardId:bid,revision:2,deleted:false,
 document:{schema:'wand.moodboards.local@1',version:2,boards:[{id:bid,references:[{id:rid,type:'ITEM',entityId:String(eid),groupIds:[]}]}]}});
const verified=new Map([[eid,{itemId:eid,label:'Verified Furniture'}]]);
const req=()=>({boardId:bid,revision:2,referenceId:rid,itemId:eid});
assert.equal(verifyAtomicBoardReference(seed(),req(),verified).persistentWriteAuthorized,false);
const bad=[
 ['legacy authority',(s,q)=>q.boardId='legacy-board-id'],
 ['old revision',(s,q)=>q.revision=1],
 ['newer revision',(s,q)=>s.revision=3],
 ['forged item',(s,q)=>q.itemId=40000049],
 ['item retarget',(s,q)=>s.document.boards[0].references[0].entityId='40000049'],
 ['item removed',(s,q)=>s.document.boards[0].references=[]],
 ['changed group',(s,q)=>s.document.boards[0].references[0].groupIds=['unauthorized']],
 ['tombstone',(s,q)=>s.deleted=true],
 ['wrong schema',(s,q)=>s.schema='other']
];
for(const [name,fn] of bad){
 const s=seed(),q=req();fn(s,q);
 assert.throws(()=>verifyAtomicBoardReference(s,q,verified),/WEP_ATOMIC_/,name);
}
const pin={sourceSurface:'atomic-moodboard',intent:'ATOMIC_MOODBOARD',boardId:bid,revision:2,referenceId:rid,
 createdAt:'2026-11-09T00:00:00.000Z',persistentWriteAuthorized:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false};
assert.equal(verifyAtomicHandoffIdentity({...pin},pin),true);
for(const diff of [{boardId:'legacy'},{revision:3},{referenceId:'new'},{createdAt:'2026-11-09T00:00:01.000Z'},
 {sourceSurface:'moodboard'},{persistentWriteAuthorized:true},{productApplyAuthorized:true}]){
 assert.throws(()=>verifyAtomicHandoffIdentity({...pin,...diff},pin),/WEP_ATOMIC_HANDOFF_CHANGED/);
}
assert.equal(WORLD_EDITOR_STAGE1_LOCALES.length,8);
console.log('QRW849_IDB_VERIFIER_STALE_FORGED_LEGACY_REF_GROUP_AUTHORITIES_DENIED_PASS');

const origin=process.env.QRW849_ORIGIN;
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin??'')||!process.env.CHROME_BIN)
 throw Error('LOCAL_INSTALLED_CHROME_REQUIRED');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',acceptDownloads:true});
const exceptions=[],outbound=[];
ctx.on('request',r=>{
 if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))outbound.push(r.method()+' '+r.url());
});
const page=await ctx.newPage();page.on('pageerror',e=>exceptions.push(String(e)));
const fixture={schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'independent-qrw849'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[
  {editorId:'stage-a',itemId:40000049,layer:'furniture',x:0,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'A',worldClass:'FurnitureItemData'}},
  {editorId:'stage-b',itemId:40000050,layer:'furniture',x:5,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'B',worldClass:'FurnitureItemData'}},
  {editorId:'stage-c',itemId:40000052,layer:'furniture',x:10,y:5,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'C',worldClass:'FurnitureItemData'}},
  {editorId:'stage-road',itemId:30000001,layer:'road',x:15,y:0,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Road',worldClass:'FenceAndRoadItemData'}}
 ]};
const pk='dreamwishwand:moodboards:v1',bk='dreamwishwand:moodboards:v1:backup',hintKey='dreamwishwand:world-editor:handoff:v1';
const frozen=async p=>p.evaluate(([a,b])=>({main:localStorage.getItem(a),backup:localStorage.getItem(b)}),[pk,bk]);
const idb=async p=>p.evaluate(async()=>{
 const m=await import('/src/lib/moodboards/atomic-first-board.mjs');
 const db=await m.openAtomicFirstBoardDatabase();
 try {return await m.verifiedAtomicFirstBoardReopen(db);}finally{db.close();}
});
try{
 assert.equal((await page.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'})).status(),200);
 await page.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 await page.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 await page.evaluate(([a,b])=>{
  localStorage.setItem(a,'{legacy-intentionally-malformed');
  localStorage.setItem(b,'{"legacy":"old-backup-unmodified"}');
 },[pk,bk]);
 const legacy=await frozen(page);
 await page.locator('[data-atomic-title]').fill('QR-W genuine IDB only');
 await page.locator('[data-atomic-create]').click();
 await page.locator('[data-atomic-board]').waitFor({timeout:15000});
 await page.locator('[data-atomic-item-id]').fill('40000048');
 await page.locator('[data-atomic-save-item]').click();
 await page.locator('[data-atomic-item="40000048"]').waitFor({timeout:15000});
 const initial=await idb(page);
 assert.equal(initial.revision,2);
 const snap=await page.evaluate(async()=>{
  const m=await import('/src/lib/moodboards/atomic-first-board.mjs');
  const db=await m.openAtomicFirstBoardDatabase();
  try {return await m.verifiedAtomicFirstBoardReopen(db);}finally{db.close();}
 });
 const firstRef=snap.document.boards[0].references[0];
 const hint={schema:'dreamwish-wand-world-editor-handoff@1',version:1,
  sourceSurface:'atomic-moodboard',intent:'ATOMIC_MOODBOARD',
  boardId:snap.boardId,revision:snap.revision,referenceId:firstRef.id,
  createdAt:'2026-11-09T00:00:00.000Z',persistentWriteAuthorized:false,productApplyAuthorized:false,directSourceReplacementAuthorized:false};
 await page.evaluate(([key,value])=>localStorage.setItem(key,JSON.stringify(value)),[hintKey,hint]);
 assert.equal((await page.goto(origin+'/editor/world/',{waitUntil:'domcontentloaded'})).status(),200);
 await page.locator('[data-wep-pre-source-stage1] [data-wep-atomic-revision]').waitFor({timeout:30000});
 await page.locator('.load-panel input[type=file]').setInputFiles({
  name:'qrw849-synthetic-document.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))
 });
 await page.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:30000});
 const panel=page.locator('[data-wep-decorate-stage1]');
 const open=panel.locator('[data-wep-atomic-open]');
 await open.waitFor({timeout:30000});
 const localizations=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const loc of localizations){
  await page.locator('#site-locale').evaluate((element,value)=>{element.value=value;element.dispatchEvent(new Event('change',{bubbles:true}));},loc);
  const c=worldEditorStage1Copy(loc);
  await page.waitForFunction(label=>
   Array.from(document.querySelectorAll('[data-wep-decorate-stage1] [data-wep-atomic-open]')).some(el=>el.textContent?.trim()===label),c.atomicOpen);
  assert.equal((await panel.locator('.atomic-source .boundary-note').first().innerText()).trim(),c.atomicReadonly);
 }
 await page.locator('#site-locale').evaluate((element)=>{element.value='en';element.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.setViewportSize({width:320,height:900});
 const w320=await panel.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));
 assert.ok(w320.scroll<=w320.client+2,'320px Stage1 '+JSON.stringify(w320));
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const w200=await panel.evaluate(e=>({scroll:e.scrollWidth,client:e.clientWidth}));
 assert.ok(w200.scroll<=w200.client+2,'200% Stage1 '+JSON.stringify(w200));
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:900});
 await open.focus();assert.equal(await open.evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Enter');
 await panel.locator('[data-wep-atomic-revision]').waitFor({timeout:20000});
 assert.match(await panel.locator('[data-wep-atomic-revision]').innerText(),new RegExp(snap.boardId));
 const selected=panel.locator('[data-wep-atomic-select]').filter({hasText:'40000048'});
 await selected.focus();await page.keyboard.press('Enter');
 await panel.locator('.pending-card').waitFor({timeout:15000});
 assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),0);
 assert.deepEqual(await frozen(page),legacy);
 assert.equal((await idb(page)).primary,initial.primary);
 console.log('QRW849_8LOCALE_320_ZOOM200_KEYBOARD_IDB_BOARD_REV_PENDING_NO_AUTOSAVE_PASS');

 // Forged hint replacing selected authority must be caught before Draft insert.
 const pending=panel.locator('.pending-card');
 await page.evaluate(key=>{const p=JSON.parse(localStorage.getItem(key));p.revision++;localStorage.setItem(key,JSON.stringify(p));},hintKey);
 await pending.locator('button').last().click();
 await panel.locator('.stage1-status').filter({hasText:/Board|Revision|Item|Changed/}).first().waitFor({timeout:15000});
 assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),0,'forged revision must deny Draft');
 await open.click();await selected.click();
 await pending.waitFor();
 const observer=await ctx.newPage();observer.on('pageerror',e=>exceptions.push(String(e)));
 await observer.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'});
 await observer.locator('[data-atomic-ready="true"]').waitFor();
 await observer.locator('[data-atomic-item-id]').fill('40000048');
 await observer.locator('[data-atomic-save-item]').click();
 await observer.locator('[data-atomic-items] [data-atomic-item="40000048"]').waitFor({state:'detached',timeout:15000});
 const newer=await idb(observer);
 assert.equal(newer.revision,3);
 await pending.locator('button').last().click();
 await panel.locator('.stage1-status').filter({hasText:/Board|Revision|Item|Changed/}).first().waitFor({timeout:15000});
 assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),0,'stale IDB Revision must deny Draft');
 assert.equal((await idb(observer)).primary,newer.primary);
 console.log('QRW849_FORGED_HINT_AND_NEWER_IDB_REVISION_DENY_DRAFT_BEFORE_CHANGE_PASS');

 // Re-add verified source ref on current Board, explicit Reopen, create one local
 // Draft then Undo; neither IDB nor old localStorage can be modified by Editor.
 await observer.locator('[data-atomic-item-id]').fill('40000048');
 await observer.locator('[data-atomic-save-item]').click();
 await observer.locator('[data-atomic-item="40000048"]').waitFor({timeout:15000});
 const latest=await idb(observer);
 assert.equal(latest.revision,4);
 await open.click();
 const live=panel.locator('[data-wep-atomic-select]').filter({hasText:'40000048'});
 await live.click();await pending.waitFor();
 await pending.locator('input[type=number]').nth(0).fill('6');
 await pending.locator('input[type=number]').nth(1).fill('8');
 await pending.locator('button').last().click();
 await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').first().waitFor({timeout:20000});
 assert.equal(await page.locator('[data-wep-stage1-review] [data-wep-stage1-change]').count(),1);
 assert.equal((await idb(observer)).primary,latest.primary);
 assert.deepEqual(await frozen(page),legacy);
 const undo=page.getByRole('button',{name:'Undo',exact:true});
 await undo.first().click();
 await page.waitForFunction(()=>document.querySelectorAll('[data-wep-stage1-review] [data-wep-stage1-change]').length===0);
 assert.equal((await idb(observer)).primary,latest.primary);
 assert.deepEqual(await frozen(page),legacy);
 assert.deepEqual(outbound,[]);assert.deepEqual(exceptions,[]);
 console.log('QRW849_ONE_LOCAL_DRAFT_UNDO_RESTORED_NO_STORE_MUTATION_NO_EXTERNAL_POST_PASS');
 console.log('QRW849_INDEPENDENT_FOCUSED_CHROME_SCOPED_PASS');
}finally{await ctx.close();await browser.close();}
