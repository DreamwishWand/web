// 04 QR-W independent change-only acceptance of PR837 explicit opt-in link.
// No old accepted PR825 cross-tab CAS algorithm or global migration re-QA.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {moodboardCopy,MOODBOARD_COPY} from '../src/lib/moodboards/copy.js';
import {COLLECTION_FIRST_MOODBOARD_GATE} from '../src/lib/collection/moodboard-inspire.mjs';

const SOURCE='46f0c7b1a2cff7f6764f9d1c1e4af4d794fe369f';
const BASE='795cf4de32c39c33a3113a4733b0d3ccbb7a42b1';
const original=new Map([
 ['src/lib/moodboards/copy.js','b46487f4655c54ee98abe4f4bc3f3ada8a3c49d7'],
 ['src/routes/moodboards/+page.svelte','603d48a115b5c4081425f2d106bf6dd881e6b330'],
 ['tests/web-moodboard-atomic-entry.test.mjs','c3946fccb619e2f51488974330460c638bbe0a6a'],
 ['scripts/web-moodboard-atomic-entry-chrome.mjs','dda118dfb519217dd4904b41fe0c09aa1a106ee5'],
 ['.github/workflows/web-moodboard-atomic-entry.yml','5c6489ac5cee6f5772edf2542b4b7ec372c09f3d']
]);
const qa=[
 'scripts/04qr-w-pr837-atomic-optin-newonly-20261109.mjs',
 '.github/workflows/04qr-w-pr837-atomic-optin-newonly-20261109.yml'
].sort();
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.equal(git('merge-base',BASE,SOURCE),BASE);
assert.deepEqual(diff(BASE,SOURCE),[...original.keys()].sort());
assert.equal(git('merge-base',SOURCE,'HEAD'),SOURCE);
assert.deepEqual(diff(SOURCE,'HEAD'),qa);
for(const [name,sha] of original){
 assert.equal(git('rev-parse',SOURCE+':'+name),sha);
 assert.equal(git('hash-object',name),sha);
}
assert.equal(git('diff','--name-only',BASE,SOURCE,'--',
  'src/lib/moodboards/store.js','src/lib/moodboards/atomic-first-board.mjs',
  'src/routes/moodboards/atomic/+page.svelte','src/lib/collection',
  'src/routes/collection','src/routes/+layout.svelte','static','supabase','.github/workflows/pages.yml'),'');
assert.equal(COLLECTION_FIRST_MOODBOARD_GATE,'OFF_LEGACY_WRITER_NO_ATOMIC_CAS');
assert.deepEqual(Object.keys(MOODBOARD_COPY).sort(),['en','de','es-ES','fr','it','ja','pt-BR','zh-CN'].sort());
console.log('QRW837_FROZEN_SOURCE5_QA2_NO_ACCEPTED_STORE_OR_LAYOUT_MUTATION_PASS');

const origin=process.env.QRW837_ORIGIN;
const chrome=process.env.CHROME_BIN;
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin??'')||!chrome)throw Error('ONLY_DISPOSABLE_LOCAL_CHROME');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850},acceptDownloads:true,serviceWorkers:'block'});
const errors=[],external=[];
context.on('request',r=>{
 if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))external.push(r.method()+' '+r.url());
});
await context.addInitScript(()=>{
 window.__qrw837_idb_open_count=0;
 const originalOpen=indexedDB.open.bind(indexedDB);
 indexedDB.open=(...args)=>{window.__qrw837_idb_open_count++;return originalOpen(...args);};
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(String(e)));
const primaryKey='dreamwishwand:moodboards:v1',backupKey='dreamwishwand:moodboards:v1:backup';
try{
 const response=await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);
 const legacy=await page.evaluate(async([p,b])=>{
  const m=await import('/src/lib/moodboards/store.js');
  const empty=m.createEmptyMoodboardDocument('2026-11-09T00:00:00.000Z');
  const next=m.createMoodboard(empty,{title:'Legacy owner board preserved'},
   {now:'2026-11-09T00:00:01.000Z',idFactory:()=> 'legacy-qa-only-board'}).document;
  const primary=m.serializeMoodboardDocument(next);
  const backup=m.serializeMoodboardDocument(empty);
  localStorage.setItem(p,primary);localStorage.setItem(b,backup);
  return {primary,backup};
 },[primaryKey,backupKey]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.board-list button').getByText('Legacy owner board preserved').waitFor({timeout:15000});
 assert.equal(await page.locator('[data-moodboard-atomic-entry]').count(),1);
 assert.equal(await page.locator('[data-atomic-first-board]').count(),0);
 assert.equal(await page.evaluate(()=>window.__qrw837_idb_open_count),0,'no auto-opting into IDB on old route');
 const link=page.locator('[data-moodboard-atomic-link]');
 assert.equal(await link.getAttribute('href'),'/moodboards/atomic/');
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.selectOption('#site-locale',lang);
  await page.waitForFunction(value=>document.querySelector('[data-moodboard-atomic-link]')?.textContent?.trim()===value,moodboardCopy(lang).atomicLink);
  assert.equal((await page.locator('[data-moodboard-atomic-warning]').innerText()).trim(),moodboardCopy(lang).atomicNote);
  assert.match(moodboardCopy(lang).atomicNote,/IndexedDB/);
 }
 await page.setViewportSize({width:320,height:860});
 assert.equal(await link.isVisible(),true);
 const width320=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 assert.ok(width320[0]<=width320[1]+2,'overflow 320 '+width320);
 await page.setViewportSize({width:640,height:860});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const widthZoom=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 assert.ok(widthZoom[0]<=widthZoom[1]+2,'overflow 200 '+widthZoom);
 await link.hover();
 assert.equal(await page.evaluate(()=>window.__qrw837_idb_open_count),0,'hover not an IDB opt-in');
 const untouched=await page.evaluate(([a,b])=>({primary:localStorage.getItem(a),backup:localStorage.getItem(b)}),[primaryKey,backupKey]);
 assert.deepEqual(untouched,legacy,'locale and hover never change old primary/backup');
 console.log('QRW837_8LOCALE_320_ZOOM200_HOVER_DONT_MIGRATE_OR_OPEN_IDB_PASS');
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:850});
 await link.focus();assert.equal(await link.evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Enter');
 await page.waitForURL(origin+'/moodboards/atomic/');
 await page.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-atomic-first-board]').count(),0,'legacy BoardID never auto imported into IDB');
 assert.equal(await page.locator('[data-atomic-gate]').getAttribute('data-atomic-gate'),'ISOLATED_LOCAL_ONLY__NOT_LEGACY_MIGRATED');
 assert.deepEqual(await page.evaluate(([a,b])=>({primary:localStorage.getItem(a),backup:localStorage.getItem(b)}),[primaryKey,backupKey]),legacy);
 await page.locator('[data-atomic-title]').fill('Explicit independent Board');
 await page.locator('[data-atomic-create]').click();
 await page.locator('[data-atomic-outcome="CREATED"]').waitFor({timeout:20000});
 const boardID=await page.locator('[data-atomic-first-board]').getAttribute('data-atomic-board-id');
 assert.match(boardID,/^board_atomic_[a-zA-Z0-9_-]{10,80}$/);
 await page.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 await page.locator('[data-atomic-item-id]').fill('40000047');
 await page.locator('[data-atomic-save-item]').click();
 await page.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:20000});
 assert.equal(await page.locator('[data-atomic-item="40000047"]').count(),1);
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:15000}),
  page.locator('[data-atomic-export]').click()
 ]);
 assert.equal(download.suggestedFilename(),'dreamwish-wand-atomic-first-backup.json');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(exported.boards[0].id,boardID);
 assert.equal(exported.boards[0].references.length,0,'export is actual previous snapshot, not current');
 console.log('QRW837_REAL_OPTIN_KEYBOARD_CREATE_TYPED_ITEM_BACKUP_EXPORT_PASS');
 const late=await context.newPage();late.on('pageerror',e=>errors.push(String(e)));
 await late.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
 await late.locator('.board-list button').getByText('Legacy owner board preserved').waitFor({timeout:15000});
 const lateBytes={primary:legacy.primary.replace('Legacy owner board preserved','Legacy late writer after opt-in'),backup:legacy.primary};
 assert.notEqual(lateBytes.primary,legacy.primary);
 await late.evaluate(([p,b,d])=>{localStorage.setItem(p,d.primary);localStorage.setItem(b,d.backup);},[primaryKey,backupKey,lateBytes]);
 const reopen=await context.newPage();reopen.on('pageerror',e=>errors.push(String(e)));
 await reopen.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'});
 await reopen.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 assert.equal(await reopen.locator('[data-atomic-first-board]').getAttribute('data-atomic-board-id'),boardID);
 assert.equal(await reopen.locator('[data-atomic-item="40000047"]').count(),1);
 await reopen.locator('[data-atomic-reopen]').click();
 await reopen.locator('[data-atomic-outcome="REOPENED"]').waitFor({timeout:12000});
 assert.deepEqual(await reopen.evaluate(([a,b])=>({primary:localStorage.getItem(a),backup:localStorage.getItem(b)}),[primaryKey,backupKey]),lateBytes);
 await late.reload({waitUntil:'domcontentloaded'});
 await late.locator('.board-list button').getByText('Legacy late writer after opt-in').waitFor({timeout:15000});
 console.log('QRW837_LATE_NONCOOPERATING_LEGACY_WRITE_NOT_CLOBBER_ATOMIC_OR_IMPORT_PASS');
 assert.deepEqual(external,[],'never POST/cloud/offsite from independent opt-in');
 assert.deepEqual(errors,[],'no browser JS exceptions');
 console.log('QRW837_INDEPENDENT_FOCUSED_CHROME_CHANGED_ONLY_PASS_GLOBAL_FIRSTBOARD_OFF');
}finally{
 await context.close();
 await browser.close();
}
