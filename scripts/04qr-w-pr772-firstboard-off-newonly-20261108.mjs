// 04 QR-W NEW_ONLY independent safety QA: Source PR772 FIRST_BOARD_OFF four-path containment.
// No private Save/P1G, no game-item art, no product Writer, no cloud.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {
 MOODBOARD_SCHEMA,MOODBOARD_VERSION,MOODBOARD_STORAGE_KEY,MOODBOARD_BACKUP_KEY,
 createEmptyMoodboardDocument,parseMoodboardDocument,serializeMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {
 COLLECTION_FIRST_MOODBOARD_GATE,createFirstCollectionMoodboardWithItem,
 toggleCollectionMoodboardInspiration
} from '../src/lib/collection/moodboard-inspire.mjs';
const BASE='b7d86d47125f1764919b67898c39badaf35976d8';
const SOURCE='524bb2d7c9da1114f8a18de351c2a0ec918ae5cb';
const sourceFour=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','a1711d58e6ee5cc7bb90e59339d37f047d90a5ba'],
 ['scripts/web-stage1-collection-chrome.mjs','d560a25907e020402567de0c94eaec2a25dfd874'],
 ['src/lib/collection/moodboard-inspire.mjs','d49351aad8b6737fc6f3c1694951678bc8e15d09'],
 ['tests/web-collection-moodboard-inspire.test.mjs','fa28a19106bfb633d5f7f334aea0cc46036c7d6a']
]);
const qaTwo=[
 '.github/workflows/04qr-w-pr772-firstboard-off-newonly-20261108.yml',
 'scripts/04qr-w-pr772-firstboard-off-newonly-20261108.mjs'
].sort();
const git=(...x)=>execFileSync('git',x,{encoding:'utf8'}).trim();
const changed=(x,y)=>git('diff','--name-only',x,y).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',BASE,SOURCE),BASE);
assert.deepEqual(changed(BASE,SOURCE),[...sourceFour.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(changed(SOURCE,'HEAD'),qaTwo);
for(const [path,blob] of sourceFour){
 assert.equal(git('rev-parse',SOURCE+':'+path),blob,path+' original blob');
 assert.equal(git('hash-object',path),blob,path+' QA-only no Source edit');
}
for(const v of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK'])
 assert.ok(!process.env[v],v+' must not be present in public CI');
console.log('QRW772_OFF_FIXED_SOURCE4_QA_ONLY2_SHA_PASS');

assert.equal(COLLECTION_FIRST_MOODBOARD_GATE,'OFF_LEGACY_WRITER_NO_ATOMIC_CAS');
const t='2026-11-08T00:00:00.000Z';
const empty=serializeMoodboardDocument(createEmptyMoodboardDocument(t));
const existing=JSON.stringify({
 schema:MOODBOARD_SCHEMA,version:MOODBOARD_VERSION,updatedAt:t,
 boards:[{id:'qa-existing',title:'Old User Board',description:null,
  createdAt:t,updatedAt:t,groups:[],references:[]}]
});
const originalBackup='DO_NOT_TOUCH_ORIGINAL_BACKUP';
const invalid=['{broken','{"schema":"wrong","boards":[]}',null,empty,existing];
for(const val of invalid){
 const values=new Map([[MOODBOARD_BACKUP_KEY,originalBackup]]);
 if(val!==null)values.set(MOODBOARD_STORAGE_KEY,val);
 let reads=0,writes=0;
 const adversarial={
  getItem(k){reads++;if(k===MOODBOARD_STORAGE_KEY)throw Error('legacy writer entered');return values.get(k)??null;},
  setItem(k,x){writes++;throw Error('quota/legacy noncooperative writer injected '+k);}
 };
 for(const arg of [
  [adversarial,'First Board',40000047,[{itemId:40000047,label:'Verified Chair'}],'Furniture'],
  [adversarial,'',999999,[{itemId:40000047,label:'Verified Chair'}],''],
  [adversarial,'Other tab',Number.NaN,[],'']
 ]){
  assert.throws(()=>createFirstCollectionMoodboardWithItem(...arg),
   /COLLECTION_FIRST_MOODBOARD_DISABLED_LEGACY_WRITER/);
 }
 assert.equal(reads,0,'no first board reads before rejection');
 assert.equal(writes,0,'no first board primary or backup writes');
 assert.equal(values.get(MOODBOARD_STORAGE_KEY)??null,val,'original primary byte-identical');
 assert.equal(values.get(MOODBOARD_BACKUP_KEY),originalBackup,'prior backup byte-identical');
}
console.log('QRW772_OFF_QA777_BACKUP_AND_QA789_LAST_GETITEM_LEGACY_RACE_UNREACHABLE_ZERO_IO_PASS');
console.log('QRW772_OFF_CORRUPT_SCHEMA_MISSING_STORAGE_QUOTA_FORGED_ID_ZERO_IO_FAILCLOSED_PASS');

const record=[{itemId:40000047,label:'Verified Chair'}];
function storage(initial){
 const map=new Map([[MOODBOARD_STORAGE_KEY,initial]]);
 return {
  getItem:k=>map.get(k)??null,
  setItem(k,v){map.set(k,String(v));},
  raw:k=>map.get(k)??null
 };
}
// Focused compatibility check: user-owned existing Board is still writable,
// and only this preaccepted existing-board operation may update its backup.
const local=storage(existing);
const saved=toggleCollectionMoodboardInspiration(local,'qa-existing',40000047,record,'Furniture');
assert.deepEqual([saved.action,saved.document.boards[0].references[0].entityId],['added','40000047']);
assert.equal(local.raw(MOODBOARD_BACKUP_KEY),existing);
const afterAdd=local.raw(MOODBOARD_STORAGE_KEY);
assert.equal(parseMoodboardDocument(afterAdd).boards[0].references.length,1);
const removed=toggleCollectionMoodboardInspiration(local,'qa-existing',40000047,record,'Furniture');
assert.equal(removed.action,'removed');
assert.equal(parseMoodboardDocument(local.raw(MOODBOARD_STORAGE_KEY)).boards[0].references.length,0);
assert.equal(local.raw(MOODBOARD_BACKUP_KEY),afterAdd);
console.log('QRW772_OFF_EXISTING_BOARD_ONLY_ADD_REMOVE_EXACT_BACKUP_REOPEN_COMPAT_PASS');

const host=(process.env.QRW772_OFF_ORIGIN||'http://127.0.0.1:4304').replace(/\/$/,'');
assert.match(host,/^http:\/\/127\.0\.0\.1:/,'only localhost fixture');
assert.ok(process.env.CHROME_BIN,'NOT_RUN: Chrome is required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({
 viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false
});
const page=await context.newPage();
const oldTab=await context.newPage();
const unsafe=[],pageErrors=[];
for(const p of [page,oldTab]){
 p.on('pageerror',err=>pageErrors.push(String(err)));
 await p.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin===host && ['GET','HEAD'].includes(req.method()))route.continue();
  else{unsafe.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
 });
}
async function openInfo(p=page){
 await p.locator('[data-category="Furniture"]').waitFor({timeout:45000});
 await p.locator('[data-category="Furniture"]').click();
 const item=p.locator('[data-stage1-category-browse] .item-card').first();
 await item.waitFor({timeout:25000});
 await item.click();
 await p.locator('[data-stage1-item-info]').waitFor({timeout:25000});
 return await item.getAttribute('data-stage1-item-id');
}
async function raw(p=page){
 return await p.evaluate(([b,backup])=>({board:localStorage.getItem(b),backup:localStorage.getItem(backup)}),
  [MOODBOARD_STORAGE_KEY,MOODBOARD_BACKUP_KEY]);
}
const fit=async(label)=>{
 const v=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth
 }));
 assert.ok(v.scroll<=v.viewport+2,label+' document horizontal overflow '+JSON.stringify(v));
};
try{
 await page.goto(host+'/collection/',{waitUntil:'domcontentloaded'});
 await page.evaluate(([k,v,b])=>{
  localStorage.setItem(k,v);
  localStorage.setItem(b,'QA_PRIOR_BACKUP_PRESERVE');
 },[MOODBOARD_STORAGE_KEY,empty,MOODBOARD_BACKUP_KEY]);
 await page.reload({waitUntil:'domcontentloaded'});
 await openInfo();
 assert.equal(await page.locator('[data-collection-first-moodboard]').count(),0);
 assert.equal(await page.locator('[data-collection-moodboard-toggle]').isDisabled(),true);
 assert.match(await page.locator('[data-collection-moodboard-inspire] a').getAttribute('href'),/\/moodboards\/$/);
 assert.deepEqual(await raw(),{board:empty,backup:'QA_PRIOR_BACKUP_PRESERVE'});
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const lang of locales){
  await page.selectOption('#site-locale',lang);
  await page.waitForFunction(l=>document.documentElement.lang===l,lang);
  assert.equal(await page.locator('[data-collection-first-moodboard]').count(),0,lang+' unsafe form');
  assert.equal(await page.locator('[data-collection-moodboard-toggle]').isDisabled(),true,lang+' no board');
  assert.deepEqual(await raw(),{board:empty,backup:'QA_PRIOR_BACKUP_PRESERVE'},lang+' storage');
 }
 console.log('QRW772_OFF_CHROME_8_LOCALE_NO_FIRST_FORM_NO_STORAGE_MODIFICATION_PASS');
 await page.setViewportSize({width:320,height:800});
 await fit('first-board-OFF-320');
 assert.equal(await page.locator('[data-collection-moodboard-inspire] a').isVisible(),true);
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('first-board-OFF-css200');
 assert.equal(await page.locator('[data-collection-first-moodboard]').count(),0);
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:1366,height:900});
 console.log('QRW772_OFF_CHROME_320PX_ZOOM200_NO_UNSAFE_CONTROL_PASS');
 // Non-cooperating old tab (not using Web Locks) creates an unrelated valid
 // board; the disabled first-board Collection UI cannot overwrite it.
 await oldTab.goto(host+'/collection/',{waitUntil:'domcontentloaded'});
 await oldTab.evaluate(([b,v])=>localStorage.setItem(b,v),[MOODBOARD_STORAGE_KEY,existing]);
 assert.equal((await raw()).board,existing);
 assert.equal(await page.locator('[data-collection-first-moodboard]').count(),0);
 await page.reload({waitUntil:'domcontentloaded'});
 const currentItem=await openInfo();
 assert.equal(await page.locator('[data-collection-first-moodboard]').count(),0);
 const button=page.locator('[data-collection-moodboard-toggle]');
 assert.equal(await button.isDisabled(),false,'pre-existing Board must remain writable');
 assert.equal(await page.locator('[data-collection-moodboard-select]').inputValue(),'qa-existing');
 assert.equal(await button.getAttribute('aria-pressed'),'false');
 await button.focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('[data-collection-moodboard-toggle]')?.getAttribute('aria-pressed')==='true');
 const updated=await raw();
 const doc=parseMoodboardDocument(updated.board);
 assert.equal(doc.boards.length,1);
 assert.equal(doc.boards[0].title,'Old User Board');
 assert.deepEqual(doc.boards[0].references.map(r=>[r.type,r.entityId]),[['ITEM',currentItem]]);
 assert.equal(updated.backup,existing,'exact old-tab Board document Backup');
 console.log('QRW772_OFF_CHROME_LEGACY_OTHER_TAB_PRESERVED_EXISTING_ITEM_KEYBOARD_SAVE_REOPEN_PASS');
 await page.goto(host+'/moodboards/',{waitUntil:'domcontentloaded'});
 await page.locator('.board-list button').first().waitFor({timeout:20000});
 assert.ok((await page.locator('.board-list button').first().innerText()).includes('Old User Board'));
 assert.equal(parseMoodboardDocument((await raw()).board).boards[0].references.length,1);
 console.log('QRW772_OFF_CHROME_EXISTING_MOODBOARD_CONSUMER_REOPEN_PASS');
 await page.goto(host+'/collection/',{waitUntil:'domcontentloaded'});
 await openInfo();
 await page.locator('[data-collection-moodboard-toggle]').focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('[data-collection-moodboard-toggle]')?.getAttribute('aria-pressed')==='false');
 assert.equal(parseMoodboardDocument((await raw()).board).boards[0].references.length,0);
 console.log('QRW772_OFF_CHROME_EXISTING_BOARD_REMOVE_AND_REOPEN_PASS');
 // A corrupt unknown-schema primary and an unreachable first-create route
 // must not be replaced with an empty/new valid document.
 await page.evaluate(([b,s])=>localStorage.setItem(b,s),[MOODBOARD_STORAGE_KEY,'{"schema":"UNKNOWN_NEW","boards":[]}']);
 await page.reload({waitUntil:'domcontentloaded'});
 await openInfo();
 assert.equal(await page.locator('[data-collection-first-moodboard]').count(),0);
 assert.equal(await page.locator('[data-collection-moodboard-toggle]').isDisabled(),true);
 assert.equal((await raw()).board,'{"schema":"UNKNOWN_NEW","boards":[]}');
 console.log('QRW772_OFF_CHROME_UNKNOWN_SCHEMA_FAILCLOSED_PASS');
 assert.deepEqual(pageErrors,[],'actual Chrome JS page errors');
 assert.deepEqual(unsafe,[],'no POST/offhost/media upload');
 console.log('QRW772_OFF_INDEPENDENT_FOCUSED_CHROME_SCOPED_PASS');
}finally{await context.close();await browser.close();}
