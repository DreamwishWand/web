// 04 QR-W / PR845: independent changed-only verification of Collection Item -> isolated IDB Handoff.
// Reuses accepted PR825 IDB CAS and PR837 landing entry; no ancestor algorithm re-QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';
import {COLLECTION_FIRST_MOODBOARD_GATE} from '../src/lib/collection/moodboard-inspire.mjs';
const source='1fa5e69169d32a3afd4f3c7422408acf9623debc';
const parent='3818f30d2bccada1600ba0d72615eab7c6c89a53';
const immutable=new Map([
 ['src/routes/collection/+page.svelte','f7a5df2df1e60aa91878871cd855204fcc183ff1'],
 ['src/routes/moodboards/atomic/+page.svelte','e59a76e9fd4182ad399c9296b1c707905a9659a6'],
 ['tests/web-collection-atomic-item-handoff.test.mjs','eb7d66f775b4476e3c8be390dfcfdc90efdde6a6'],
 ['scripts/web-collection-atomic-item-handoff-chrome.mjs','1f2f9880436ac7c310b231cf45021159c82de4b4'],
 ['.github/workflows/web-collection-atomic-item-handoff.yml','517fe0ee58c898d04cf9cff0d0e66227cdbe40bd']
]);
const qaPaths=[
 'scripts/04qr-w-pr845-item-handoff-changedonly-20261109.mjs',
 '.github/workflows/04qr-w-pr845-item-handoff-changedonly-20261109.yml'
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const names=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',parent,source),parent);
assert.deepEqual(names(parent,source),[...immutable.keys()].sort());
assert.equal(git('merge-base',source,'HEAD'),source);
assert.deepEqual(names(source,'HEAD'),qaPaths.sort());
for(const [file,blob] of immutable) {
 assert.equal(git('rev-parse',source+':'+file),blob,file+' fixed Source blob');
 assert.equal(git('hash-object',file),blob,file+' QA cannot modify Source');
}
assert.equal(git('diff','--name-only',parent,source,'--',
 'src/lib/moodboards/','src/lib/collection/','crates/','supabase/','static/',
 '.github/workflows/pages.yml','src/routes/+layout.svelte'),'');
const route=readFileSync('src/routes/moodboards/atomic/+page.svelte','utf8');
const collection=readFileSync('src/routes/collection/+page.svelte','utf8');
assert.equal(collection.split('<a data-collection-atomic-item-handoff').length-1,1);
assert.match(collection,/info = scoped\.find\(\(item:any\)=>item\.itemId===infoId\)/);
assert.match(route,/loadCollectionRuntime\(base\)/);
assert.match(route,/params\.getAll\('item'\)/);
assert.match(route,/String\(Number\(raw\)\)===raw/);
assert.match(route,/expectedRevision:snapshot\.revision/);
assert.match(route,/result\.action!=='added'/);
assert.match(route,/<meta name="robots" content="noindex,nofollow"/);
assert.equal(COLLECTION_FIRST_MOODBOARD_GATE,'OFF_LEGACY_WRITER_NO_ATOMIC_CAS');
console.log('QRW845_FIXED_SOURCE5_ORIGINAL_BLOBS_QA_ONLY2_GLOBAL_WRITER_OFF_PASS');

const origin=process.env.QRW845_ORIGIN||'';
const chrome=process.env.CHROME_BIN||'';
if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin)||!chrome)throw Error('ONLY_LOCAL_INSTALLED_CHROME');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:860},acceptDownloads:true,serviceWorkers:'block'});
const failures=[],outbound=[];
ctx.on('request',req=>{
 if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))
  outbound.push(req.method()+' '+req.url());
});
const create=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>failures.push(String(e)));return p;};
const page=await create();
const primary='dreamwishwand:moodboards:v1',backup='dreamwishwand:moodboards:v1:backup';
const path='/moodboards/atomic/?item=40000047';
const readIDB=async p=>p.evaluate(async()=>{
 const m=await import('/src/lib/moodboards/atomic-first-board.mjs');
 const db=await m.openAtomicFirstBoardDatabase();
 try{return await m.verifiedAtomicFirstBoardReopen(db);}finally{db.close();}
});
const readLegacy=async p=>p.evaluate(([a,b])=>({current:localStorage.getItem(a),previous:localStorage.getItem(b)}),[primary,backup]);
try{
 const landing=await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded'});
 assert.equal(landing.status(),200);
 const legacy=await page.evaluate(async([a,b])=>{
  const m=await import('/src/lib/moodboards/store.js');
  const first=m.createEmptyMoodboardDocument('2026-11-09T00:00:00.000Z');
  const next=m.createMoodboard(first,{title:'Original legacy isolated from handoff'},
   {now:'2026-11-09T00:00:01.000Z',idFactory:()=> 'orig-legacy-qrw845'}).document;
  const old=m.serializeMoodboardDocument(first),current=m.serializeMoodboardDocument(next);
  localStorage.setItem(a,current);localStorage.setItem(b,old);
  return {current,previous:old};
 },[primary,backup]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-search]').fill('40000047');
 await page.locator('[data-stage1-item-id="40000047"]').first().click();
 const link=page.locator('[data-collection-atomic-item-handoff]');
 await link.waitFor({timeout:20000});
 assert.equal(await link.getAttribute('href'),path);
 assert.deepEqual(await readLegacy(page),legacy);
 assert.equal(await page.locator('[data-collection-atomic-separation]').count(),1);
 const langs=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const lang of langs) {
  await page.selectOption('#site-locale',lang);
  const c=moodboardCopy(lang);
  await page.waitForFunction(t=>
   document.querySelector('[data-collection-atomic-item-handoff]')?.textContent?.trim()===t,c.atomicLink);
  assert.equal((await page.locator('[data-collection-atomic-separation]').innerText()).trim(),c.atomicNote);
  assert.equal(await link.getAttribute('href'),path);
 }
 await page.setViewportSize({width:320,height:850});
 const width320=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 assert.ok(width320[0]<=width320[1]+2,'Collection 320px overflow '+width320);
 await page.setViewportSize({width:640,height:860});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const zoom=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 assert.ok(zoom[0]<=zoom[1]+2,'Collection 200% zoom overflow '+zoom);
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:860});
 await link.focus();
 assert.equal(await link.evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Enter');
 await page.waitForURL(origin+path);
 await page.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 await page.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-atomic-handoff-verified]').getAttribute('data-atomic-handoff-verified'),'true');
 assert.equal(await page.locator('[data-atomic-first-board]').getAttribute('data-atomic-board-id'),'');
 assert.equal(await page.locator('[data-atomic-handoff-add]').count(),0,'no premature add');
 assert.equal(await page.locator('[data-atomic-create-form]').count(),1);
 assert.equal(await readIDB(page),null,'valid handoff is not an automatic creation');
 assert.deepEqual(await readLegacy(page),legacy);
 console.log('QRW845_COLLECTION_VERIFIED_ITEM_8LOCALE_320_ZOOM200_KEYBOARD_NOSIDE_EFFECT_PASS');

 // New receiver must not auto-save even after a Board is deliberately created.
 await page.locator('[data-atomic-title]').fill('Independent handoff target');
 await page.locator('[data-atomic-create]').click();
 await page.locator('[data-atomic-outcome="CREATED"]').waitFor({timeout:20000});
 const board0=await readIDB(page);
 assert.equal(board0.revision,1);
 assert.equal(board0.document.boards[0].references.length,0);
 const boardID=board0.boardId;
 assert.match(boardID,/^board_atomic_[a-zA-Z0-9_-]{10,80}$/);
 await page.locator('[data-atomic-handoff-add]').waitFor({timeout:20000});
 const stale=await create();
 await stale.goto(origin+path,{waitUntil:'domcontentloaded'});
 await stale.locator('[data-atomic-handoff-add]').waitFor({timeout:30000});
 // Inject an untrusted URL BoardID and Revision: this must deny the new handoff.
 const noP=[
 '?item=40000047&revision=1',
 '?item=40000047&boardId='+encodeURIComponent(boardID),
 '?item=40000047&label=spoof',
 '?item=40000047&item=40000047',
 '?item=00040000047',
 '?item=40000047x',
 '?item=0',
 '?item=-1',
 '?item=9007199254740992',
 '?item=999999'
 ];
 for(const q of noP){
  const p=await create();
  const res=await p.goto(origin+'/moodboards/atomic/'+q,{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200);
  await p.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
  await p.locator('[data-atomic-handoff-denied]').waitFor({timeout:30000});
  assert.equal(await p.locator('[data-atomic-handoff-add]').count(),0,q);
  assert.equal(await p.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
  await p.close();
 }
 const beforeDenied=await readIDB(page);
 assert.equal(beforeDenied.primary,board0.primary);
 assert.equal(beforeDenied.revision,1);
 console.log('QRW845_TAMPERED_ITEM_REVISION_BOARDID_DUPLICATE_QUERY_DENY_NO_SAVE_PASS');

 // Corrupt a fetched signed-to-manifest shard on this independent tab;
 // receiver must refuse add, and cannot claim verified Item from URL alone.
 const corrupt=await create();
 let intercepted=0;
 await corrupt.route('**/ddv/collection/v1.25/records-00.json',async route=>{
  intercepted++;
  const res=await route.fetch();
  const txt=await res.text();
  await route.fulfill({response:res,body:txt+' '});
 });
 await corrupt.goto(origin+path,{waitUntil:'domcontentloaded'});
 await corrupt.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 await corrupt.locator('[data-atomic-catalog="unavailable"]').waitFor({timeout:30000});
 assert.ok(intercepted>0,'SHA-negative catalog shard response actually intercepted');
 assert.equal(await corrupt.locator('[data-atomic-handoff-add]').count(),0);
 assert.equal(await corrupt.locator('[data-atomic-handoff-verified]').getAttribute('data-atomic-handoff-verified'),'false');
 await corrupt.close();
 console.log('QRW845_CATALOG_SHARD_SHA_CORRUPTION_NO_VERIFIED_HANDOFF_PASS');

 // Existing source CAS is accepted; NEW handoff must never turn its toggle into removal.
 await page.locator('[data-atomic-handoff-add]').click();
 await page.locator('[data-atomic-outcome="HANDOFF_ADDED"]').waitFor({timeout:15000});
 const committed=await readIDB(page);
 assert.equal(committed.boardId,boardID);
 assert.equal(committed.revision,2);
 assert.deepEqual(committed.document.boards[0].references.map(x=>x.entityId),['40000047']);
 assert.equal(committed.backupDocument.boards[0].references.length,0);
 assert.equal(await page.locator('[data-atomic-handoff-add]').count(),0);
 await stale.locator('[data-atomic-handoff-add]').click();
 await stale.locator('[data-atomic-outcome="REJECTED"]').waitFor({timeout:15000});
 assert.equal((await readIDB(stale)).primary,committed.primary);
 assert.equal((await readIDB(stale)).backup,committed.backup);
 await stale.locator('[data-atomic-reopen]').click();
 await stale.locator('[data-atomic-outcome="REOPENED"]').waitFor({timeout:15000});
 assert.equal(await stale.locator('[data-atomic-handoff-add]').count(),0,'replayed handoff never toggle-removes stored Item');
 assert.equal(await stale.locator('[data-atomic-handoff-already]').count(),1);
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.locator('[data-atomic-export]').click()]);
 const json=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(download.suggestedFilename(),'dreamwish-wand-atomic-first-backup.json');
 assert.equal(json.boards.length,1);
 assert.equal(json.boards[0].id,boardID);
 assert.equal(json.boards[0].references.length,0,'true prior snapshot');
 const reopened=await create();
 await reopened.goto(origin+path,{waitUntil:'domcontentloaded'});
 await reopened.locator('[data-atomic-handoff-already]').waitFor({timeout:30000});
 const fresh=await readIDB(reopened);
 assert.equal(fresh.primary,committed.primary);
 assert.equal(fresh.backup,committed.backup);
 assert.deepEqual(await readLegacy(page),legacy);
 console.log('QRW845_EXPLICIT_CAS_STALE_TAB_NO_REMOVAL_REAL_BACKUP_THIRD_TAB_REOPEN_PASS');

 // Legacy noncooperating later write is deliberately accepted by old store;
 // it must not overwrite the new isolated IDB Board/Backup bytes.
 await page.evaluate(([p,b])=>{localStorage.setItem(p,'{"late":"legacy writer"}');localStorage.setItem(b,'{"old":"backup"}');},[primary,backup]);
 const afterLate=await readIDB(reopened);
 assert.equal(afterLate.primary,committed.primary);
 assert.equal(afterLate.backup,committed.backup);
 assert.equal((await readLegacy(page)).current,'{"late":"legacy writer"}');
 assert.deepEqual(outbound,[],'no external POST/Cloud');
 assert.deepEqual(failures,[],'no console pageerror in actual Chrome');
 console.log('QRW845_NONCOOPERATING_LEGACY_LATE_WRITE_NO_IDB_OVERWRITE_NO_CLOUD_PASS');
 console.log('QRW845_INDEPENDENT_CHANGE_ONLY_CHROME_FOCUSED_PASS');
}finally{await ctx.close();await browser.close();}
