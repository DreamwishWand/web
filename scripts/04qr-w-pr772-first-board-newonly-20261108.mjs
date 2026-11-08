// 04 QR-W NEW_ONLY independent QA for first Collection Moodboard creation on PR772.
// Only synthetic public Catalog IDs and ephemeral localhost storage; NO P1G, Cloud or Writer.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {
 MOODBOARD_SCHEMA, MOODBOARD_VERSION,MOODBOARD_STORAGE_KEY,MOODBOARD_BACKUP_KEY,
 createEmptyMoodboardDocument,createMoodboard,serializeMoodboardDocument,parseMoodboardDocument
} from '../src/lib/moodboards/store.js';
import {createFirstCollectionMoodboardWithItem} from '../src/lib/collection/moodboard-inspire.mjs';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';

const BASE='b7d86d47125f1764919b67898c39badaf35976d8';
const SOURCE='5e5be76de51e27ef1b0979d062220b7f3be136a3';
const changed=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','857409be248ea90b1dcc1582c42619c8c99909fc'],
 ['scripts/web-stage1-collection-chrome.mjs','2f0b8309018a88655f2ba423c1e2f125af73cd49'],
 ['src/lib/collection/moodboard-inspire.mjs','b1930ed8cfea56f4dfb296a9ff13f9a9c511f2f2'],
 ['src/routes/collection/+page.svelte','5544094449b1f702c24cc459f485124beb33436f'],
 ['tests/web-collection-moodboard-inspire.test.mjs','b75c84492e0a5f9584293fa80da15580fa41e363']
]);
const qa=[
 '.github/workflows/04qr-w-pr772-first-board-newonly-20261108.yml',
 'scripts/04qr-w-pr772-first-board-newonly-20261108.mjs'
].sort();
const git=(...s)=>execFileSync('git',s,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',BASE,SOURCE),BASE);
assert.equal(git('rev-list','--count',BASE+'..'+SOURCE),'2');
assert.deepEqual(diff(BASE,SOURCE),[...changed.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(SOURCE,'HEAD'),qa);
for(const [p,sha] of changed){
 assert.equal(git('rev-parse',SOURCE+':'+p),sha,p+' Source Git blob');
 assert.equal(git('hash-object',p),sha,p+' QA cannot alter Source');
}
for(const k of ['WEP_PRIVATE_P1G_PATH','DDV_PRIVATE_SAVE_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK']){
 assert.ok(!process.env[k],'NO_OWNER_PRIVATE_SAVE_IN_PUBLIC_QA '+k);
}
console.log('QRW772_FIXED_BASE_SOURCE5_QA_ONLY2_GIT_SHA_PASS');
const now='2026-11-08T00:00:00.000Z';
const emptyRaw=serializeMoodboardDocument(createEmptyMoodboardDocument(now));
const trusted=[{itemId:40000047,label:'Verified Chair',family:'Furniture'},
 {itemId:40000048,label:'Verified Table',family:'Furniture'}];
const first=(storage,name='First QA Board',id=40000047,rows=trusted)=>
 createFirstCollectionMoodboardWithItem(storage,name,id,rows,'Furniture');
function fake(raw=emptyRaw,failKey=null){
 const values=new Map(raw===null?[]:[[MOODBOARD_STORAGE_KEY,raw]]);
 const counts=new Map();
 return {
  getItem:k=>values.get(k)??null,
  setItem(k,v){
   if(k===failKey) throw new DOMException('QuotaExceededError','QuotaExceededError');
   counts.set(k,(counts.get(k)||0)+1);values.set(k,String(v));
  },
  peek:k=>values.get(k)??null,
  replace:(k,v)=>values.set(k,String(v)),
  count:k=>counts.get(k)||0
 };
}
const s=fake(emptyRaw);
const created=first(s,'  First QA Board  ');
assert.equal(s.count(MOODBOARD_STORAGE_KEY),1,'one primary commit includes board+ITEM');
assert.equal(s.count(MOODBOARD_BACKUP_KEY),1);
assert.equal(s.peek(MOODBOARD_BACKUP_KEY),emptyRaw,'previous raw empty document exact Backup');
assert.equal(created.document.boards.length,1);
assert.equal(created.document.boards[0].title,'First QA Board');
assert.deepEqual(created.document.boards[0].references.map(r=>[r.type,r.entityId,r.label]),
 [['ITEM','40000047','Verified Chair']]);
assert.equal(parseMoodboardDocument(s.peek(MOODBOARD_STORAGE_KEY)).boards[0].references[0].entityId,'40000047');
console.log('QRW772_FIRST_BOARD_ONE_PRIMARY_WRITE_BACKUP_TYPED_ITEM_REOPEN_PASS');
const noKey=fake(null);
assert.equal(first(noKey,'First No-Key').document.boards.length,1);
assert.equal(noKey.peek(MOODBOARD_BACKUP_KEY),null,'never fabricate backup if no original document');
assert.throws(()=>first(noKey,'Stale Retry'),/now exists/);
console.log('QRW772_NEW_BROWSER_AND_STALE_PREEXISTING_BOARD_DENY_PASS');

let neg=0;
function deny(title,id,rows=trusted){
 const v=fake(emptyRaw);
 assert.throws(()=>first(v,title,id,rows));
 assert.equal(v.peek(MOODBOARD_STORAGE_KEY),emptyRaw);
 assert.equal(v.peek(MOODBOARD_BACKUP_KEY),null);
 assert.equal(v.count(MOODBOARD_STORAGE_KEY),0);
 neg++;
}
for(const title of ['', '  ', 'x'.repeat(121)])deny(title,40000047);
for(const id of [0, -1, 1.2, Number.NaN, Number.MAX_SAFE_INTEGER+1, '40000047', 999999])deny('Valid',id);
deny('Valid',40000047,[]);
deny('Valid',40000047,[{itemId:40000047,label:''}]);
for(const malformed of ['{invalid','{"schema":"unsupported","boards":[]}', '{}']){
 const v=fake(malformed);
 assert.throws(()=>first(v));
 assert.equal(v.peek(MOODBOARD_STORAGE_KEY),malformed);
 assert.equal(v.peek(MOODBOARD_BACKUP_KEY),null);
 neg++;
}
for(const key of [MOODBOARD_BACKUP_KEY,MOODBOARD_STORAGE_KEY]){
 const v=fake(emptyRaw,key);
 assert.throws(()=>first(v),/Quota/);
 assert.equal(v.peek(MOODBOARD_STORAGE_KEY),emptyRaw,'quota denial must preserve primary');
 neg++;
}
console.log('QRW772_FORGED_NAME_ID_SCHEMA_QUOTA_NEGATIVES_'+neg+'_PASS');
for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
 const c=moodboardCopy(lang);
 for(const k of ['newBoard','titleLabel','create','created','invalid'])
  assert.ok(typeof c[k]==='string'&&c[k].trim(),lang+' '+k);
}
console.log('QRW772_REUSED_8_LOCALE_FIRST_BOARD_COPY_PASS');

const host=(process.env.QRW772_LOCAL_ORIGIN||'http://127.0.0.1:4297').replace(/\/$/,'');
assert.match(host,/^http:\/\/127\.0\.0\.1:/,'QA Chrome localhost only');
const bin=process.env.CHROME_BIN;
assert.ok(bin,'NOT_RUN: installed real Chrome required');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const bad=[],errors=[],sockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>sockets.push(w.url()));
await page.route('**/*',route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin===host && ['GET','HEAD'].includes(r.method()))route.continue();
 else{bad.push(r.method()+' '+r.url());route.abort('blockedbyclient');}
});
const fit=async(tag)=>{
 const g=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(g.s<=g.w+2,tag+' no overflow '+JSON.stringify(g));
};
try{
 const response=await page.goto(host+'/collection/',{waitUntil:'domcontentloaded',timeout:55000});
 assert.equal(response?.status(),200);
 await page.locator('[data-stage1-category-grid] [data-category="Furniture"]').waitFor({timeout:45000});
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
 await page.evaluate(([key,val])=>localStorage.setItem(key,val),[MOODBOARD_STORAGE_KEY,emptyRaw]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-category="Furniture"]').waitFor({timeout:35000});
 await page.locator('[data-category="Furniture"]').click();
 const card=page.locator('[data-stage1-category-browse] .item-card').first();
 const id=await card.getAttribute('data-stage1-item-id');
 await card.focus();await page.keyboard.press('Enter');
 await page.locator('[data-collection-first-moodboard]').waitFor({timeout:15000});
 const title=page.locator('[data-collection-first-moodboard-title]');
 const submit=page.locator('[data-collection-first-moodboard-create]');
 const choose=page.locator('[data-collection-moodboard-select]');
 assert.equal(await submit.isDisabled(),true,'no implicit first board when title empty');
 assert.equal(await page.locator('[data-collection-moodboard-toggle]').isDisabled(),true,'existing Add unavailable without board');
 await page.setViewportSize({width:1366,height:900}); // desktop language selector is hidden on 320px
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.selectOption('#site-locale',lang);
  const label=moodboardCopy(lang);
  assert.ok((await page.locator('[data-collection-first-moodboard]').innerText()).includes(label.newBoard),lang);
  assert.ok((await page.locator('[data-collection-first-moodboard]').innerText()).includes(label.titleLabel),lang);
 }
 await page.selectOption('#site-locale','ja');
 await page.setViewportSize({width:320,height:800});
 await fit('mobile320 first board');
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('css200 first board');
 assert.equal(await title.isVisible(),true);
 assert.equal(await submit.isVisible(),true);
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:320,height:800});
 await title.fill('Independent New Moodboard');
 await title.focus();await page.keyboard.press('Enter');
 await page.waitForFunction(k=>{try{return JSON.parse(localStorage.getItem(k))?.boards?.[0]?.references?.length===1;}catch{return false;}},MOODBOARD_STORAGE_KEY);
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),MOODBOARD_STORAGE_KEY);
 assert.equal(saved.boards.length,1);
 assert.equal(saved.boards[0].title,'Independent New Moodboard');
 assert.deepEqual([saved.boards[0].references[0].type,saved.boards[0].references[0].entityId],['ITEM',id]);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),MOODBOARD_BACKUP_KEY),emptyRaw);
 assert.equal(await page.locator('[data-collection-first-moodboard]').count(),0,'only explicit initial creation UI disappears');
 assert.equal(await choose.inputValue(),saved.boards[0].id);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-category="Furniture"]').waitFor();
 await page.locator('[data-category="Furniture"]').click();
 await page.locator('[data-stage1-category-browse] .item-card').first().click();
 assert.equal(await page.locator('[data-collection-moodboard-toggle]').getAttribute('aria-pressed'),'true','fresh page reopen state');
 assert.deepEqual(bad,[],'no offhost POST / Save media egress');
 assert.deepEqual(errors,[],'no page JS errors');
 assert.deepEqual(sockets.filter(u=>new URL(u).host!==new URL(host).host),[], 'no external WebSocket; localhost Vite dev HMR is allowed');
 console.log('QRW772_ACTUAL_CHROME_FIRST_BOARD_8LOCALE_KEYBOARD_320_200_REOPEN_NETWORK_SAFE_PASS');
}finally{await browser.close();}

// Distinct NEW_ONLY negative: concurrent tab writes between read and commit.
// Synchronization of getItem+backup+setItem is not atomic across tabs.
// Inject a real other-tab commit in the seam between backup and primary writes.
const other=createMoodboard(createEmptyMoodboardDocument(now),
 {title:'Another Tab Already Committed'},{now,idFactory:()=> 'concurrent'});
const otherRaw=serializeMoodboardDocument(other.document);
const concurrent=fake(emptyRaw);
let injected=false;
const storage={
 getItem:k=>concurrent.getItem(k),
 setItem(k,v){
  if(k===MOODBOARD_BACKUP_KEY&&!injected){
   concurrent.replace(MOODBOARD_STORAGE_KEY,otherRaw);
   injected=true;
  }
  concurrent.setItem(k,v);
 }
};
const result=first(storage,'First while racing');
assert.equal(injected,true,'test actually injected other-tab primary commit');
const retained=concurrent.peek(MOODBOARD_STORAGE_KEY);
if(retained!==otherRaw) {
 console.error('QRW772_TRUE_RED_CONCURRENT_INTERLEAVE_OVERWROTE_OTHER_TAB',JSON.stringify({
  expectedOtherBoard:other.document.boards[0].id,
  actualBoard:parseMoodboardDocument(retained).boards[0].id,
  appReturnedBoard:result.boardId,
  priorBackupIsEmpty:concurrent.peek(MOODBOARD_BACKUP_KEY)===emptyRaw
 }));
 throw new Error('TRUE_RED_SCOPED: concurrent other-tab Moodboard overwritten between backup and primary write; first-create is not CAS/transactional.');
}
console.log('QRW772_CONCURRENT_INTERLEAVE_PRESERVED_OTHER_TAB_PASS');
