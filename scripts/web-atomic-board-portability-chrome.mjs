import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const old='http://127.0.0.1:4294',next='http://127.0.0.1:4293';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
const errors=[],requests=[];
ctx.on('request',r=>{if(![old,next].includes(new URL(r.url()).origin)||!['GET','HEAD'].includes(r.method()))requests.push(r.method());});
const ready=p=>p.locator('[data-atomic-ready="true"][data-atomic-catalog="ready"]').waitFor({timeout:45000});
const read=(p,base)=>p.evaluate(async path=>{const m=await import(path),db=await m.openAtomicFirstBoardDatabase();try{return await m.verifiedAtomicFirstBoardReopen(db);}finally{db.close();}},base+'/src/lib/moodboards/atomic-first-board.mjs');
const legacy=p=>p.evaluate(()=>[localStorage.getItem('dreamwishwand:moodboards:v1'),localStorage.getItem('dreamwishwand:moodboards:v1:backup')]);
const create=async(p,title)=>{await p.locator('[data-atomic-title]').fill(title);await p.locator('[data-atomic-create]').click();await p.locator('[data-atomic-outcome="CREATED"]').waitFor();};
const exportFile=async p=>{const dl=p.waitForEvent('download');await p.locator('[data-atomic-portable-export]').click();return readFile(await(await dl).path());};
const importFile=async(p,buffer)=>{await p.locator('[data-atomic-portable-file]').setInputFiles({name:'board.json',mimeType:'application/json',buffer});};
try{
 const a=await ctx.newPage(),b=await ctx.newPage();for(const p of [a,b])p.on('pageerror',e=>errors.push(String(e)));
 await a.goto(old+'/web/moodboards/atomic/',{waitUntil:'networkidle'});await ready(a);
 await create(a,'Synthetic atomic source');
 await a.locator('[data-atomic-item-id]').fill('40000047');await a.locator('[data-atomic-save-item]').click();await a.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor();
 const original=await read(a,'/web');assert.equal(original.revision,2);
 const file=await exportFile(a);
 await b.goto(next+'/moodboards/atomic/',{waitUntil:'networkidle'});await ready(b);assert.equal(await read(b,''),null);
 const invalid=Buffer.from(file.toString().replace('"version": 1','"version": 99'));
 await importFile(b,invalid);await b.locator('[data-atomic-outcome="PORTABLE_REJECTED"]').waitFor();assert.equal(await read(b,''),null);
 await importFile(b,file);await b.locator('[data-atomic-outcome="PORTABLE_IMPORTED"]').waitFor();
 assert.deepEqual(await read(b,''),original);
 await b.reload({waitUntil:'networkidle'});await ready(b);assert.deepEqual(await read(b,''),original);
 assert.deepEqual(await read(a,'/web'),original);
 assert.equal(await b.locator('[data-atomic-portable-import]').isDisabled(),true);
 // The actual transaction also denies a direct/replayed file when occupied.
 const denied=await b.evaluate(async text=>{const m=await import('/src/lib/moodboards/atomic-first-board.mjs'),db=await m.openAtomicFirstBoardDatabase();try{return await m.importAtomicBoardPortable(db,text,[{itemId:40000047,label:'verified'}]).then(()=>false,e=>String(e).includes('PORTABLE_DESTINATION_OCCUPIED'));}finally{db.close();}},file.toString());
 assert.equal(denied,true);assert.deepEqual(await read(b,''),original);
 assert.deepEqual(await legacy(a),[null,null]);assert.deepEqual(await legacy(b),[null,null]);
 console.log('ATOMIC_PORTABLE_TWO_ORIGIN_PRIMARY_BACKUP_REOPEN_COLLISION_PASS');
 // Source tombstone is a real separate snapshot, not an instruction to delete target.
 await a.locator('[data-atomic-delete]').click();await a.locator('[data-atomic-outcome="DELETED"]').waitFor();
 const tomb=await exportFile(a),tombRow=await read(a,'/web');assert.equal(tombRow.deleted,true);
 const fresh=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});
 try{
  const c=await fresh.newPage();await c.goto(next+'/moodboards/atomic/',{waitUntil:'networkidle'});await ready(c);
  await importFile(c,tomb);await c.locator('[data-atomic-outcome="PORTABLE_IMPORTED"]').waitFor();
  assert.deepEqual(await read(c,''),tombRow);assert.equal(await c.locator('[data-atomic-tombstone]').count(),1);
  assert.equal(await c.locator('[data-atomic-create]').count(),0);
 }finally{await fresh.close();}
 // Two real pages race import/create against same IDB row; exactly one transaction wins.
 const race=await browser.newContext({serviceWorkers:'block'});
 try{
  const x=await race.newPage(),y=await race.newPage();for(const p of [x,y]){await p.goto(next+'/moodboards/atomic/',{waitUntil:'networkidle'});await ready(p);}
  const result=await Promise.all([x.evaluate(async raw=>{const m=await import('/src/lib/moodboards/atomic-first-board.mjs'),db=await m.openAtomicFirstBoardDatabase();try{return await m.importAtomicBoardPortable(db,raw,[{itemId:40000047,label:'verified'}]).then(()=>true,()=>false);}finally{db.close();}},file.toString()),y.evaluate(async()=>{const m=await import('/src/lib/moodboards/atomic-first-board.mjs'),db=await m.openAtomicFirstBoardDatabase();try{return await m.createAtomicFirstBoard(db,'Synthetic competing create').then(()=>true,()=>false);}finally{db.close();}})]);
  assert.equal(result.filter(Boolean).length,1);
  const row=await read(x,'');if(result[0])assert.deepEqual(row,original);else assert.equal(row.document.boards[0].title,'Synthetic competing create');
 }finally{await race.close();}
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 console.log('ATOMIC_PORTABLE_TOMBSTONE_CONCURRENT_CREATE_IMPORT_NO_NETWORK_PASS');
}finally{await browser.close();}
