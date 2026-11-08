import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';
const origin=process.env.MOODBOARD_ATOMIC_ENTRY_ORIGIN||'http://127.0.0.1:4299';
if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin)||!process.env.CHROME_BIN)
 throw Error('ONLY_LOCAL_INSTALLED_CHROME');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900},
 serviceWorkers:'block',acceptDownloads:true});
const page=await context.newPage(),errors=[],external=[];
page.on('pageerror',err=>errors.push(String(err)));
context.on('request',req=>{
 if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))
  external.push(req.method()+' '+req.url());
});
const legacyKey='dreamwishwand:moodboards:v1';
const backupKey='dreamwishwand:moodboards:v1:backup';
try{
 const legacyPage=await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
 assert.equal(legacyPage.status(),200);
 const previous=await page.evaluate(async([primaryKey,previousKey])=>{
  const m=await import('/src/lib/moodboards/store.js');
  const start=m.createEmptyMoodboardDocument('2026-11-09T00:00:00.000Z');
  const doc=m.createMoodboard(start,{title:'Untouched legacy board'},
   {now:'2026-11-09T00:00:01.000Z',idFactory:()=> 'legacy-existing'}).document;
  const current=m.serializeMoodboardDocument(doc);
  const old=m.serializeMoodboardDocument(start);
  localStorage.setItem(primaryKey,current);
  localStorage.setItem(previousKey,old);
  return {current,old};
 },[legacyKey,backupKey]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.board-list button').getByText('Untouched legacy board').waitFor({timeout:15000});
 const option=page.locator('[data-moodboard-atomic-entry]');
 assert.equal(await option.count(),1);
 assert.equal(await option.getAttribute('data-storage-separation'),'explicit');
 assert.equal(await option.getAttribute('data-legacy-migration'),'off');
 assert.equal(await option.getAttribute('data-first-collection-create'),'off');
 const link=page.locator('[data-moodboard-atomic-link]');
 assert.equal(await link.getAttribute('href'),'/moodboards/atomic/');
 assert.equal(await page.locator('[data-atomic-first-board]').count(),0,
  'the isolated writer cannot auto-run on legacy landing');
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.selectOption('#site-locale',locale);
  const expected=moodboardCopy(locale);
  await page.waitForFunction(text=>document.querySelector('[data-moodboard-atomic-link]')?.textContent?.trim()===text,expected.atomicLink);
  assert.equal((await page.locator('[data-moodboard-atomic-warning]').innerText()).trim(),expected.atomicNote);
  assert.equal(await link.getAttribute('href'),'/moodboards/atomic/');
 }
 console.log('WEB_ATOMIC_ENTRY_EIGHT_LOCALES_EXPLICIT_TWO_STORE_SEPARATION_PASS');
 await page.selectOption('#site-locale','ja');
 await page.waitForFunction(text=>document.querySelector('[data-moodboard-atomic-link]')?.textContent?.trim()===text,
  moodboardCopy('ja').atomicLink);
 await page.setViewportSize({width:320,height:850});
 const mobile=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(mobile.scroll<=mobile.client+2,'legacy option 320px '+JSON.stringify(mobile));
 assert.equal(await link.isVisible(),true);
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const zoom=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.client+2,'legacy option 200% '+JSON.stringify(zoom));
 await link.focus();
 assert.equal(await link.evaluate(el=>el===document.activeElement),true);
 console.log('WEB_ATOMIC_ENTRY_320_ZOOM200_KEYBOARD_FOCUS_PASS');
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:900});
 await link.focus();
 await page.keyboard.press('Enter');
 await page.waitForURL(origin+'/moodboards/atomic/');
 await page.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-atomic-gate]').getAttribute('data-atomic-gate'),
  'ISOLATED_LOCAL_ONLY__NOT_LEGACY_MIGRATED');
 const unchanged=async()=>page.evaluate(([a,b])=>({current:localStorage.getItem(a),old:localStorage.getItem(b)}),
  [legacyKey,backupKey]);
 assert.deepEqual(await unchanged(),previous,'opening separate DB cannot modify legacy bytes');
 await page.locator('[data-atomic-title]').fill('Isolated opted-in Board');
 await page.locator('[data-atomic-create]').click();
 await page.locator('[data-atomic-outcome="CREATED"]').waitFor({timeout:20000});
 const boardId=await page.locator('[data-atomic-first-board]').getAttribute('data-atomic-board-id');
 assert.match(boardId,/^board_atomic_[a-zA-Z0-9_-]{10,80}$/);
 assert.equal(await page.locator('[data-atomic-first-board]').getAttribute('data-atomic-revision'),'1');
 await page.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 await page.locator('[data-atomic-item-id]').fill('40000047');
 await page.locator('[data-atomic-save-item]').click();
 await page.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:20000});
 assert.equal(await page.locator('[data-atomic-item="40000047"]').count(),1);
 assert.equal(await page.locator('[data-atomic-first-board]').getAttribute('data-atomic-revision'),'2');
 console.log('WEB_ATOMIC_ENTRY_USER_OPTIN_CREATE_VERIFIED_ITEM_SAVE_PASS');
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:15000}),
  page.locator('[data-atomic-export]').click()
 ]);
 assert.equal(download.suggestedFilename(),'dreamwish-wand-atomic-first-backup.json');
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(backup.boards.length,1);
 assert.equal(backup.boards[0].id,boardId);
 assert.equal(backup.boards[0].references.length,0,'the prior snapshot not fabricated current revision');
 assert.equal(backup.schema,'wand.moodboards.local@1');
 const reopened=await context.newPage();reopened.on('pageerror',err=>errors.push(String(err)));
 await reopened.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'});
 await reopened.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 assert.equal(await reopened.locator('[data-atomic-first-board]').getAttribute('data-atomic-board-id'),boardId);
 assert.equal(await reopened.locator('[data-atomic-item="40000047"]').count(),1);
 await reopened.locator('[data-atomic-reopen]').click();
 await reopened.locator('[data-atomic-outcome="REOPENED"]').waitFor({timeout:10000});
 assert.deepEqual(await unchanged(),previous,'create/save/reopen cannot overwrite legacy bytes');
 console.log('WEB_ATOMIC_ENTRY_BACKUP_DOWNLOAD_AND_SEPARATE_TAB_REOPEN_PASS');
 await page.goto(origin+'/moodboards/',{waitUntil:'domcontentloaded'});
 await page.locator('.board-list button').getByText('Untouched legacy board').waitFor({timeout:15000});
 assert.deepEqual(await unchanged(),previous);
 assert.equal(await page.locator('[data-moodboard-atomic-link]').count(),1);
 assert.deepEqual(external,[],'no POST/outside requests/Cloud sync');
 assert.deepEqual(errors,[],'no browser JS exceptions');
 console.log('WEB_ATOMIC_ENTRY_LEGACY_BOARD_BACKUP_UNCHANGED_NO_CLOUD_PASS');
 console.log('WEB_ATOMIC_ENTRY_ACTUAL_CHROME_FINAL_PASS');
}finally{await context.close();await browser.close();}
