// 04 QR-W independent changed-only PR825 audit: isolated IDB vs legacy storage.
// Deliberately not a global dual-store migration or production First Moodboard enablement.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const SOURCE='bcb494683051586121fbf233f3a6ca1af7d0271f';
const PARENT='23d62b95d5245f183c21ce1a9be0f38204f7cea1';
const source=new Map([
 ['.github/workflows/web-moodboard-atomic-first.yml','c074a4e805dd3bc2865bd67e483b58d47d587f2a'],
 ['scripts/web-moodboard-atomic-first-chrome.mjs','6ec2e0901d2a35937a9828a7ff8744617f8069fd'],
 ['src/lib/moodboards/atomic-first-board.mjs','7c32b14958508b5d7f1096a3a0c025daa7b343f3'],
 ['src/routes/moodboards/atomic/+page.svelte','e4d0405720a232be4e11d94e00f1c4e0e8d5be0b'],
 ['tests/web-moodboard-atomic-first.test.mjs','e2f3348415c7d67d00c4a26adb741bd904628b97']
]);
const audit=[
 '.github/workflows/04qr-w-pr825-atomic-idb-newonly-20261108.yml',
 'scripts/04qr-w-pr825-atomic-idb-newonly-20261108.mjs'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',PARENT,SOURCE),PARENT);
assert.deepEqual(diff(PARENT,SOURCE),[...source.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(SOURCE,'HEAD'),audit);
for(const [file,sha] of source){
 assert.equal(git('rev-parse',SOURCE+':'+file),sha);
 assert.equal(git('hash-object',file),sha,'Source git blob changed: '+file);
}
assert.equal(git('diff','--name-only',PARENT,SOURCE,'--',
 'src/lib/moodboards/store.js','src/routes/moodboards/+page.svelte',
 'src/lib/collection/moodboard-inspire.mjs','src/routes/collection/+page.svelte',
 'src/routes/+layout.svelte','.github/workflows/pages.yml','static/','supabase/'),'');
console.log('QRW825_SOURCE5_EXACT_IMMUTABLE_QA_ONLY2_LEGACY_AND_PAGES_NO_CHANGE_PASS');

const origin=process.env.QRW825_ORIGIN||'http://127.0.0.1:4297';
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'installed Chrome required; NEVER infer PASS');
const url=origin+'/moodboards/atomic/';
const modulePath='/src/lib/moodboards/atomic-first-board.mjs';
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']
});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
const outbound=[],errors=[];
context.on('request',r=>{
 const u=new URL(r.url());
 if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))outbound.push(r.method()+' '+r.url());
});
context.on('page',p=>p.on('pageerror',e=>errors.push(String(e))));
const openPage=async()=>{
 const p=await context.newPage();
 const res=await p.goto(url,{waitUntil:'domcontentloaded'});
 assert.equal(res.status(),200);
 await p.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await p.locator('[data-atomic-first-board]').getAttribute('data-writer'),'off');
 assert.equal(await p.locator('[data-atomic-first-board]').getAttribute('data-media-public'),'off');
 return p;
};
const fromDB=p=>p.evaluate(async path=>{
 const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
 try{return await m.verifiedAtomicFirstBoardReopen(db);}
 finally{db.close();}
},modulePath);
try{
 const [a,b]=await Promise.all([openPage(),openPage()]);
 assert.equal(await fromDB(a),null);
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of locales){
  await a.selectOption('#site-locale',locale);
  await a.waitForFunction(v=>document.documentElement.dataset.locale===v,locale);
  assert.equal(await a.locator('[data-atomic-first-board]').count(),1);
 }
 for(const [width,zoom] of [[320,1],[640,2]]){
  await a.setViewportSize({width,height:850});
  await a.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
  const size=await a.evaluate(()=>({
   viewport:document.documentElement.clientWidth,
   scroll:document.documentElement.scrollWidth
  }));
  assert.ok(size.scroll<=size.viewport+2,'isolated route horizontal overflow '+JSON.stringify({width,zoom,size}));
  const create=a.locator('[data-atomic-title]');
  await create.focus();
  assert.equal(await create.evaluate(n=>document.activeElement===n),true);
 }
 console.log('QRW825_EIGHT_LOCALE_320_AND_640_CSS200_KEYBOARD_NOINDEX_NO_WRITER_PASS');
 await a.locator('[data-atomic-title]').fill('First independent A');
 await b.locator('[data-atomic-title]').fill('First independent B');
 await Promise.all([a.locator('[data-atomic-create]').click(),b.locator('[data-atomic-create]').click()]);
 await Promise.all([a,b].map(p=>p.locator('[data-atomic-outcome="CREATED"],[data-atomic-outcome="REJECTED"]').waitFor({timeout:30000})));
 const states=await Promise.all([a,b].map(p=>p.locator('[data-atomic-first-board]').getAttribute('data-atomic-outcome')));
 assert.deepEqual(states.sort(),['CREATED','REJECTED']);
 const winner=await fromDB(a);
 assert.equal(winner.revision,1);
 assert.equal(winner.document.boards.length,1);
 assert.equal(winner.document.boards[0].id,winner.boardId);
 assert.equal(winner.backupDocument.boards.length,0);
 console.log('QRW825_ACTUAL_UNCOOPERATING_TWO_TAB_FIRST_CREATE_ONE_IDB_WINNER_PASS');

 const legacyPrimary='{"lateOldTab":"primary","sequence":3}';
 const legacyBackup='{"lateOldTab":"backup","sequence":2}';
 await b.evaluate(([p,backup])=>{
  localStorage.setItem('dreamwishwand:moodboards:v1',p);
  localStorage.setItem('dreamwishwand:moodboards:v1:backup',backup);
 },[legacyPrimary,legacyBackup]);
 assert.equal((await fromDB(a)).boardId,winner.boardId);
 const [c,d]=await Promise.all([openPage(),openPage()]);
 for(const p of [c,d]){
  assert.equal(await p.locator('[data-atomic-first-board]').getAttribute('data-atomic-board-id'),winner.boardId);
  await p.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
  await p.locator('[data-atomic-item-id]').fill('40000047');
 }
 // An adversarial *simultaneous* CAS from two already-open tabs: exactly one
 // may commit revision2, and backup MUST be the same-transaction prior primary.
 await Promise.all([c.locator('[data-atomic-save-item]').click(),d.locator('[data-atomic-save-item]').click()]);
 await Promise.all([c,d].map(p=>p.locator('[data-atomic-outcome="ITEM_SAVED"],[data-atomic-outcome="REJECTED"]').waitFor({timeout:30000})));
 const cas=await Promise.all([c,d].map(p=>p.locator('[data-atomic-first-board]').getAttribute('data-atomic-outcome')));
 assert.deepEqual(cas.sort(),['ITEM_SAVED','REJECTED']);
 const v2=await fromDB(c);
 assert.equal(v2.revision,2);
 assert.equal(v2.boardId,winner.boardId);
 assert.equal(v2.document.boards[0].references.length,1);
 assert.equal(v2.document.boards[0].references[0].entityId,'40000047');
 assert.equal(v2.backup,winner.primary);
 assert.equal(v2.backupDocument.boards[0].references.length,0);
 const fresh=await openPage();
 assert.deepEqual(await fromDB(fresh),v2);
 console.log('QRW825_TWO_TAB_SAME_REVISION_CAS_EXACT_ONE_ATOMIC_PRIOR_BACKUP_FRESH_REOPEN_PASS');

 // A transaction that queued a valid write but is forcibly ABORTED must NEVER
 // resolve success, persist revision3, or mutate the previous backup.
 const injected=await fresh.evaluate(async path=>{
  const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
  const wrapped={
   transaction(name,mode){
    const tx=db.transaction(name,mode),store=tx.objectStore(name);
    return {
     objectStore:()=>({
      get:key=>store.get(key),
      put:(value,key)=>{const request=store.put(value,key);tx.abort();return request;}
     }),
     abort:()=>tx.abort(),
     get error(){return tx.error;},
     set oncomplete(fn){tx.oncomplete=fn;},
     set onabort(fn){tx.onabort=fn;},
     set onerror(fn){tx.onerror=fn;}
    };
   }
  };
  try{
   const before=await m.verifiedAtomicFirstBoardReopen(db);
   const attempted=await m.toggleAtomicFirstBoardItem(wrapped,{
    boardId:before.boardId,expectedRevision:before.revision,
    itemId:40000047,verifiedRecords:[{itemId:40000047,label:'Synthetic local test only'}]
   }).then(()=>({resolved:true}),e=>({resolved:false,message:String(e)}));
   const after=await m.verifiedAtomicFirstBoardReopen(db);
   return {attempted,unchanged:JSON.stringify(before)===JSON.stringify(after)};
  }finally{db.close();}
 },modulePath);
 assert.equal(injected.attempted.resolved,false);
 assert.equal(injected.unchanged,true,'ABORTED IDB transaction must preserve primary and backup exactly');
 console.log('QRW825_FORCED_REAL_IDB_TX_ABORT_NO_PREMATURE_SUCCESS_NO_PARTIAL_BACKUP_PASS');

 const legacy=await b.evaluate(()=>({
  p:localStorage.getItem('dreamwishwand:moodboards:v1'),
  b:localStorage.getItem('dreamwishwand:moodboards:v1:backup')
 }));
 assert.deepEqual(legacy,{p:legacyPrimary,b:legacyBackup});
 assert.equal((await fromDB(a)).boardId,winner.boardId);
 console.log('QRW825_LATE_LEGACY_LOCALSTORAGE_NONCOOPERATION_IDB_UNCHANGED_NO_MIGRATION_PASS');

 const invalid=await fresh.evaluate(async path=>{
  const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
  try{
   const v=await m.verifiedAtomicFirstBoardReopen(db);
   const base={boardId:v.boardId,expectedRevision:v.revision,itemId:40000047,
    verifiedRecords:[{itemId:40000047,label:'Synthetic only'}]};
   const failures=[];
   for(const args of [
    {...base,expectedRevision:v.revision-1},
    {...base,boardId:'board_atomic_forged_1234567890'},
    {...base,itemId:987654321},
    {...base,itemId:-1}
   ]){
    try{await m.toggleAtomicFirstBoardItem(db,args);failures.push(false);}
    catch{failures.push(true);}
   }
   const after=await m.verifiedAtomicFirstBoardReopen(db);
   return {failures,unchanged:JSON.stringify(v)===JSON.stringify(after)};
  }finally{db.close();}
 },modulePath);
 assert.deepEqual(invalid.failures,[true,true,true,true]);
 assert.equal(invalid.unchanged,true);
 console.log('QRW825_STALE_FORGED_UNVERIFIED_ITEM_NEGATIVE_NO_REVISION_MUTATION_PASS');

 const deletion=await fresh.evaluate(async path=>{
  const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
  try{
   const v=await m.verifiedAtomicFirstBoardReopen(db);
   await m.deleteAtomicFirstBoard(db,{boardId:v.boardId,expectedRevision:v.revision});
   const tomb=await m.verifiedAtomicFirstBoardReopen(db);
   const denied=await m.createAtomicFirstBoard(db,'After deletion')
    .then(()=>false,()=>true);
   const after=await m.verifiedAtomicFirstBoardReopen(db);
   return {deleted:tomb.deleted,revision:tomb.revision,boardId:tomb.boardId,
    denied,unchanged:JSON.stringify(tomb)===JSON.stringify(after)};
  }finally{db.close();}
 },modulePath);
 assert.deepEqual(deletion,{deleted:true,revision:3,boardId:winner.boardId,denied:true,unchanged:true});
 console.log('QRW825_PERMANENT_TOMBSTONE_NO_RECREATION_IDB_KEY_PRESERVED_PASS');

 // Different browser context = different origin storage; corrupt JSON must be
 // rejected without auto-overwrite. No personal/user data in test namespace.
 const isolation=await browser.newContext({serviceWorkers:'block'});
 try{
  const corrupted=await isolation.newPage();
  const response=await corrupted.goto(url,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  const result=await corrupted.evaluate(async path=>{
   const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
   const broken={schema:'wand.moodboards.atomic-first@1',revision:1,
    boardId:'board_atomic_1234567890',primary:'{bad',backup:'{bad',deleted:false};
   try{
    await new Promise((resolve,reject)=>{
     const tx=db.transaction(m.ATOMIC_MOODBOARD_STORE,'readwrite');
     tx.objectStore(m.ATOMIC_MOODBOARD_STORE).put(broken,m.ATOMIC_MOODBOARD_SLOT);
     tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
    });
    const deniedRead=await m.verifiedAtomicFirstBoardReopen(db).then(()=>false,()=>true);
    const deniedCreate=await m.createAtomicFirstBoard(db,'Bad').then(()=>false,()=>true);
    const persisted=await new Promise((resolve,reject)=>{
     const tx=db.transaction(m.ATOMIC_MOODBOARD_STORE,'readonly');
     const req=tx.objectStore(m.ATOMIC_MOODBOARD_STORE).get(m.ATOMIC_MOODBOARD_SLOT);
     req.onsuccess=()=>resolve(req.result);
     req.onerror=()=>reject(req.error);
    });
    return {deniedRead,deniedCreate,unchanged:JSON.stringify(broken)===JSON.stringify(persisted)};
   }finally{db.close();}
  },modulePath);
  assert.deepEqual(result,{deniedRead:true,deniedCreate:true,unchanged:true});
 }finally{await isolation.close();}
 console.log('QRW825_CORRUPT_PRIMARY_BACKUP_FAIL_CLOSED_NO_OVERWRITE_PASS');
 assert.deepEqual(outbound,[],'network outside controlled localhost or POST forbidden');
 assert.deepEqual(errors,[],'unhandled Chrome page error');
 console.log('QRW825_INDEPENDENT_INSTALLED_CHROME_FINAL_SOURCE_SCOPED_PASS_NO_PUBLIC_PRODUCT_ENABLE');
}finally{await context.close();await browser.close();}
