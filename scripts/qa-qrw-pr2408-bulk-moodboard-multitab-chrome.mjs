// 04 QR-W independent changed-only 08 WEB Source PR2408 true Chrome L2.
 // Exercise real multi-tab LocalStorage CAS+rollback, not synthetic in-memory store.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4367';
assert.ok(process.env.CHROME_BIN,'installed Chrome required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
const unsafe=[],errors=[];
context.on('request',r=>{
 if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))
  unsafe.push(r.method()+' '+r.url());
});
const a=await context.newPage(),b=await context.newPage();
for(const p of [a,b])p.on('pageerror',e=>errors.push(String(e)));
const MAIN='dreamwishwand:moodboards:v1',BACKUP=MAIN+':backup';
const snapshot=p=>p.evaluate(([main,backup])=>{
 const primary=localStorage.getItem(main),prior=localStorage.getItem(backup);
 return {primary,prior,doc:primary?JSON.parse(primary):null};
},[MAIN,BACKUP]);
const count=s=>s.doc.boards[0].references.length;
const batch=p=>p.locator('[data-explore-bulk-moodboard-add]');
try{
 await a.goto(origin+'/web/moodboards/',{waitUntil:'networkidle'});
 const create=a.locator('form.new-board');
 for(const title of ['QRW L2 selected board','QRW L2 untouched board']){
  await create.locator('input').first().fill(title);
  await create.locator('button[type=submit]').click();
 }
 const original=await snapshot(a);
 assert.equal(original.doc.boards.length,2);
 assert.equal(count(original),0);
 assert.equal(original.doc.boards[1].references.length,0);
 await a.goto(origin+'/web/explore/',{waitUntil:'networkidle',timeout:45000});
 await b.goto(origin+'/web/explore/',{waitUntil:'networkidle',timeout:45000});
 await batch(a).waitFor({state:'visible'});await batch(b).waitFor({state:'visible'});
 assert.equal(await batch(a).isEnabled(),true);
 assert.equal(await batch(b).isEnabled(),true);
 // Tab A commits the entire first batch under raw CAS, then tab B must
 // apply a storage event and only add the NEXT 24 verified IDs.
 await batch(a).click();
 const first=await snapshot(a);
 assert.equal(count(first),24);
 assert.equal(first.prior,original.primary);
 await b.waitForFunction(()=>Array.from(document.querySelectorAll(
  '[data-explore-moodboard-toggle][aria-pressed=true]')).length>=24,null,{timeout:15000});
 await batch(b).click();
 const second=await snapshot(b);
 assert.equal(count(second),48,'tab B must consume the updated document, not overwrite tab A');
 assert.equal(second.prior,first.primary);
 const ids=second.doc.boards[0].references.map(x=>x.entityId);
 assert.equal(new Set(ids).size,48);
 assert.deepEqual(second.doc.boards[1],original.doc.boards[1],
  'a different board must remain byte-for-byte logically unchanged');
 assert.ok(second.doc.boards[0].references.every(r=>r.type==='ITEM'&&r.url===null));
 console.log('QRW2408_REAL_CROSS_TAB_STORAGE_EVENT_24_PLUS24_NO_LOST_UPDATES_PASS');

 // Actual Chrome Storage setter throws at PRIMARY after previously writing
 // BACKUP. Existing compensation must restore BOTH old raw values exactly.
 await a.waitForFunction(()=>Array.from(document.querySelectorAll(
  '[data-explore-moodboard-toggle][aria-pressed=true]')).length>=48,null,{timeout:15000});
 const preQuota=await snapshot(a);
 assert.equal(count(preQuota),48);
 await a.evaluate(main=>{
  const original=Storage.prototype.setItem;
  window.__qrwOldStorageSetter=original;
  Storage.prototype.setItem=function(key,value){
   if(key===main)throw Error('QRW_TEST_PRIMARY_QUOTA_AFTER_BACKUP_WRITE');
   return original.call(this,key,value);
  };
 },MAIN);
 await batch(a).click();
 const quota=await snapshot(a);
 await a.evaluate(()=>{
  Storage.prototype.setItem=window.__qrwOldStorageSetter;
  delete window.__qrwOldStorageSetter;
 });
 assert.equal(quota.primary,preQuota.primary,'quota failure must not replace the primary');
 assert.equal(quota.prior,preQuota.prior,'quota rollback must compensate raw backup');
 assert.ok((await a.locator('[role=status]').allTextContents()).some(t=>t.includes(
  'The batch was denied')),'user-visible failure required');
 console.log('QRW2408_REAL_CHROME_PRIMARY_STORAGE_QUOTA_COMPENSATES_BOTH_RAW_KEYS_PASS');

 // Inject a valid, near-capacity source document into this disposable
 // device-local browser. 499 canonical references leave only one slot,
 // so a new batch must fail in full, never add its first item.
 const stress=await a.evaluate(async({main,backup})=>{
  const {serializeMoodboardDocument}=await import('/src/lib/moodboards/store.js');
  const doc=JSON.parse(localStorage.getItem(main));
  const extra=Array.from({length:451},(_,i)=>({
   id:'note_qa_'+i,type:'NOTE',label:'Synthetic '+i,
   url:null,entityId:null,note:null,groupIds:[],createdAt:'2026-11-20T08:00:00.000Z'
  }));
  doc.boards[0].references.push(...extra);
  const raw=serializeMoodboardDocument(doc);
  localStorage.setItem(main,raw);
  return {raw,prior:localStorage.getItem(backup)};
 },{main:MAIN,backup:BACKUP});
 await a.reload({waitUntil:'networkidle'});
 await batch(a).waitFor({state:'visible'});
 assert.equal((await snapshot(a)).doc.boards[0].references.length,499);
 assert.equal(await batch(a).isEnabled(),true,'unadded visible items remain');
 await batch(a).click();
 const afterCap=await snapshot(a);
 assert.equal(afterCap.primary,stress.raw);
 assert.equal(afterCap.prior,stress.prior);
 assert.equal(count(afterCap),499);
 assert.ok((await a.locator('[role=status]').allTextContents()).some(t=>t.includes(
  'The batch was denied')));
 console.log('QRW2408_REAL_CHROME_499_CAPACITY_NO_PARTIAL_BATCH_OR_BACKUP_MUTATION_PASS');

 assert.deepEqual(errors,[]);
 assert.deepEqual(unsafe,[],'no off-origin or mutating requests');
 assert.equal(await a.locator('[data-game-save-writer="off"]').count(),1);
 assert.equal(await a.locator('[data-auto-cloud="off"]').count(),1);
 console.log('QRW2408_LOCAL_MOODBOARD_ONLY_REAL_BROWSER_CAS_QUOTA_CAPACITY_L2_PASS');
}finally{
 await context.close();
 await browser.close();
}
