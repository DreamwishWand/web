import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin=process.env.ATOMIC_MOODBOARD_ORIGIN||'http://127.0.0.1:4293';
if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin))throw Error('LOCAL_ORIGIN_ONLY');
if(!process.env.CHROME_BIN)throw Error('NOT_RUN_CHROME_BINARY');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block'});
const errors=[],offsite=[];
context.on('request',req=>{if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))offsite.push(req.method()+' '+req.url());});
const pages=[await context.newPage(),await context.newPage()];
for(const p of pages)p.on('pageerror',e=>errors.push(String(e)));
const url=origin+'/moodboards/atomic/';
const jsUrl='/src/lib/moodboards/atomic-first-board.mjs';
const read=page=>page.evaluate(async path=>{
 const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
 try{return await m.verifiedAtomicFirstBoardReopen(db);}finally{db.close();}
},jsUrl);
try{
 await Promise.all(pages.map(p=>p.goto(url,{waitUntil:'domcontentloaded'})));
 await Promise.all(pages.map(p=>p.locator('[data-atomic-ready="true"]').waitFor({timeout:30000})));
 await pages[0].locator('[data-atomic-title]').fill('First A');
 await pages[1].locator('[data-atomic-title]').fill('First B');
 await Promise.all(pages.map(p=>p.locator('[data-atomic-create]').click()));
 await Promise.all(pages.map(p=>p.locator('[data-atomic-outcome="CREATED"],[data-atomic-outcome="REJECTED"]').waitFor({timeout:20000})));
 const states=await Promise.all(pages.map(p=>p.locator('[data-atomic-first-board]').getAttribute('data-atomic-outcome')));
 assert.deepEqual([...states].sort(),['CREATED','REJECTED']);
 const winner=pages[states.indexOf('CREATED')],loser=pages[states.indexOf('REJECTED')];
 const initial=await read(winner);
 assert.equal(initial.revision,1);
 assert.equal(initial.document.boards.length,1);
 assert.equal(initial.document.boards[0].id,initial.boardId);
 assert.equal(initial.backupDocument.boards.length,0);
 console.log('WEB_ATOMIC_FIRST_TWO_TABS_ONE_DURABLE_BOARDID_PASS');
 const legacy='{"writer":"noncooperating","value":"late-primary"}';
 const legacyBackup='{"writer":"noncooperating","value":"old-backup"}';
 await loser.evaluate(([raw,bak])=>{
  localStorage.setItem('dreamwishwand:moodboards:v1',raw);
  localStorage.setItem('dreamwishwand:moodboards:v1:backup',bak);
 },[legacy,legacyBackup]);
 const afterOldWrite=await read(winner);
 assert.equal(afterOldWrite.boardId,initial.boardId);
 assert.equal(afterOldWrite.revision,1);
 console.log('WEB_ATOMIC_FIRST_LATE_LEGACY_WRITER_ISOLATED_NO_LOST_BOARD_PASS');
 await winner.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 await winner.locator('[data-atomic-item-id]').fill('40000047');
 await winner.locator('[data-atomic-save-item]').click();
 await winner.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:20000});
 const saved=await read(winner);
 assert.equal(saved.revision,2);
 assert.equal(saved.document.boards[0].references.length,1);
 assert.equal(saved.document.boards[0].references[0].entityId,'40000047');
 assert.equal(saved.backupDocument.boards[0].references.length,0);
 console.log('WEB_ATOMIC_FIRST_VERIFIED_ITEM_SAVE_ATOMIC_BACKUP_PASS');
 const rejection=await winner.evaluate(async path=>{
  const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
  try{
   const row=await m.readAtomicFirstBoard(db);
   const input={boardId:row.boardId,expectedRevision:1,itemId:40000047,verifiedRecords:[{itemId:40000047,label:'Verified'}]};
   const stale=await m.toggleAtomicFirstBoardItem(db,input).then(()=>false,e=>String(e).includes('STALE_REVISION'));
   const forged=await m.toggleAtomicFirstBoardItem(db,{...input,boardId:'board_atomic_forgedwrong',expectedRevision:2})
    .then(()=>false,e=>String(e).includes('BOARD_NOT_FOUND'));
   const invalid=await m.toggleAtomicFirstBoardItem(db,{...input,itemId:999999,expectedRevision:2})
    .then(()=>false,e=>e instanceof TypeError);
   return {stale,forged,invalid,revision:(await m.readAtomicFirstBoard(db)).revision};
  }finally{db.close();}
 },jsUrl);
 assert.deepEqual(rejection,{stale:true,forged:true,invalid:true,revision:2});
 console.log('WEB_ATOMIC_FIRST_STALE_REVISION_FORGED_BOARDID_INVALID_ITEM_DENIED_PASS');
 const other=await context.newPage();other.on('pageerror',e=>errors.push(String(e)));
 await other.goto(url,{waitUntil:'domcontentloaded'});
 await other.locator('[data-atomic-ready="true"]').waitFor();
 assert.equal(await other.locator('[data-atomic-first-board]').getAttribute('data-atomic-board-id'),saved.boardId);
 assert.equal(await other.locator('[data-atomic-item="40000047"]').count(),1);
 await other.locator('[data-atomic-reopen]').click();
 const reopened=await read(other);
 assert.equal(reopened.primary,saved.primary);
 assert.equal(reopened.backup,saved.backup);
 assert.equal(reopened.revision,2);
 console.log('WEB_ATOMIC_FIRST_FRESH_TAB_REOPEN_EXACT_PRIMARY_BACKUP_PASS');
 await other.locator('[data-atomic-catalog="ready"]').waitFor();
 await other.locator('[data-atomic-item-id]').fill('40000047');
 await other.locator('[data-atomic-save-item]').click();
 await other.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor();
 const removed=await read(other);
 assert.equal(removed.revision,3);
 assert.equal(removed.document.boards[0].references.length,0);
 assert.equal(removed.backupDocument.boards[0].references.length,1);
 await other.locator('[data-atomic-delete]').click();
 await other.locator('[data-atomic-tombstone]').waitFor();
 const tombstone=await read(other);
 assert.equal(tombstone.deleted,true);
 assert.equal(tombstone.boardId,saved.boardId);
 const noDuplicate=await other.evaluate(async path=>{
  const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
  try{return await m.createAtomicFirstBoard(db,'Again')
   .then(()=>false,e=>String(e).includes('ALREADY_CREATED'));}
  finally{db.close();}
 },jsUrl);
 assert.equal(noDuplicate,true);
 const legacyBytes=await loser.evaluate(()=>({
  primary:localStorage.getItem('dreamwishwand:moodboards:v1'),
  backup:localStorage.getItem('dreamwishwand:moodboards:v1:backup')
 }));
 assert.deepEqual(legacyBytes,{primary:legacy,backup:legacyBackup});
 console.log('WEB_ATOMIC_FIRST_DELETE_TOMBSTONE_NO_RECREATE_LEGACY_UNTOUCHED_PASS');
 const corruptContext=await browser.newContext({viewport:{width:620,height:900},serviceWorkers:'block'});
 const corrupt=await corruptContext.newPage();
 await corrupt.goto(url,{waitUntil:'domcontentloaded'});
 await corrupt.locator('[data-atomic-ready="true"]').waitFor();
 const malformed=await corrupt.evaluate(async path=>{
  const m=await import(path),db=await m.openAtomicFirstBoardDatabase();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(m.ATOMIC_MOODBOARD_STORE,'readwrite');
   tx.objectStore(m.ATOMIC_MOODBOARD_STORE).put({
    schema:'wand.moodboards.atomic-first@1',revision:1,
    boardId:'board_atomic_1234567890',primary:'{invalid',backup:'{invalid',deleted:false
   },m.ATOMIC_MOODBOARD_SLOT);
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
  });
  const readDenied=await m.readAtomicFirstBoard(db).then(()=>false,e=>String(e).includes('CORRUPT_SNAPSHOT'));
  const createDenied=await m.createAtomicFirstBoard(db,'No overwrite').then(()=>false,e=>String(e).includes('CORRUPT_SNAPSHOT'));
  db.close();return {readDenied,createDenied};
 },jsUrl);
 assert.deepEqual(malformed,{readDenied:true,createDenied:true});
 await corruptContext.close();
 console.log('WEB_ATOMIC_FIRST_MALFORMED_IDB_JSON_DENY_NO_OVERWRITE_PASS');
 assert.deepEqual(offsite,[]);
 assert.deepEqual(errors,[]);
 console.log('WEB_ATOMIC_FIRST_REAL_CHROME_FINAL_PASS');
}finally{await context.close();await browser.close();}
