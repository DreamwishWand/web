import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';
const origin=process.env.WEB_COLLECTION_ATOMIC_ORIGIN||'http://127.0.0.1:4317';
if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin)||!process.env.CHROME_BIN)
 throw Error('LOCAL_INSTALLED_CHROME_ONLY');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block',acceptDownloads:true});
const errors=[],offsite=[];
ctx.on('request',req=>{if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))offsite.push(req.method()+' '+req.url());});
const createPage=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));return p;};
const page=await createPage();
const primary='dreamwishwand:moodboards:v1',backup='dreamwishwand:moodboards:v1:backup';
const itemId=40000047,url='/moodboards/atomic/?item=40000047';
const readIdb=async(p)=>p.evaluate(async()=>{
 const m=await import('/src/lib/moodboards/atomic-first-board.mjs');
 const db=await m.openAtomicFirstBoardDatabase();
 try{return await m.verifiedAtomicFirstBoardReopen(db);}finally{db.close();}
});
try{
 assert.equal((await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded'})).status(),200);
 const old=await page.evaluate(async([key,bak])=>{
  const m=await import('/src/lib/moodboards/store.js');
  const start=m.createEmptyMoodboardDocument('2026-11-09T00:00:00.000Z');
  const b=m.createMoodboard(start,{title:'Legacy Board untouched'},
   {now:'2026-11-09T00:00:01.000Z',idFactory:()=> 'legacybefore'}).document;
  const current=m.serializeMoodboardDocument(b),previous=m.serializeMoodboardDocument(start);
  localStorage.setItem(key,current);localStorage.setItem(bak,previous);
  return {current,previous};
 },[primary,backup]);
 const checkOld=()=>page.evaluate(([a,b])=>({current:localStorage.getItem(a),previous:localStorage.getItem(b)}),[primary,backup]);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-search]').fill(String(itemId));
 await page.locator('[data-stage1-item-id="40000047"]').first().click();
 const link=page.locator('[data-collection-atomic-item-handoff]');
 await link.waitFor({timeout:20000});
 assert.equal(await link.getAttribute('href'),url);
 assert.match(await page.locator('[data-collection-atomic-separation]').innerText(),/IndexedDB/);
 assert.deepEqual(await checkOld(),old);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.selectOption('#site-locale',locale);
  await page.waitForFunction(label=>
   document.querySelector('[data-collection-atomic-item-handoff]')?.textContent?.trim()===label,
   moodboardCopy(locale).atomicLink);
  assert.equal((await page.locator('[data-collection-atomic-separation]').innerText()).trim(),
   moodboardCopy(locale).atomicNote);
  assert.equal(await link.getAttribute('href'),url);
 }
 console.log('WEB_COLLECTION_ATOMIC_EIGHT_LOCALES_VERIFIED_VISIBLE_ITEM_LINK_PASS');
 await page.selectOption('#site-locale','ja');
 await page.setViewportSize({width:320,height:850});
 const mobile=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(mobile.scroll<=mobile.client+2,'320px horizontal overflow '+JSON.stringify(mobile));
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const zoom=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.client+2,'200% horizontal overflow '+JSON.stringify(zoom));
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:860});
 await link.focus();
 assert.equal(await link.evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Enter');
 await page.waitForURL(origin+url);
 await page.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 await page.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 assert.equal(await page.locator('[data-atomic-item-handoff]').getAttribute('data-atomic-handoff-verified'),'true');
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-atomic-handoff-add]').count(),0,'before first-board create');
 const preview=page.locator('[data-atomic-handoff-preview]');
 const thumb=preview.locator('[data-item-thumb-id="40000047"]');
 await thumb.waitFor({timeout:10000});
 assert.equal(await thumb.getAttribute('data-media-status'),'unavailable','compiled media OFF');
 assert.equal(await thumb.locator('img').count(),0);
 for(const width of [320,640]){
  await page.setViewportSize({width,height:850});
  await page.evaluate(w=>{document.documentElement.style.zoom=w===640?'2':'1';},width);
  const geometry=await preview.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:document.documentElement.clientWidth,view:window.innerWidth};});
  assert.ok(geometry.left>=-1&&geometry.right<=geometry.view+2,JSON.stringify(geometry));
 }
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:860});
 console.log('WEB_ATOMIC_EXPLICIT_PUBLIC_ITEM_SHARED_THUMB_MEDIA_OFF_REFLOW_PASS');
 assert.deepEqual(await checkOld(),old,'link navigation cannot mutate legacy bytes');
 console.log('WEB_COLLECTION_ATOMIC_320_ZOOM200_KEYBOARD_NO_AUTOSAVE_PASS');
 await page.locator('[data-atomic-title]').fill('Opt-in from Collection');
 await page.locator('[data-atomic-create]').click();
 await page.locator('[data-atomic-outcome="CREATED"]').waitFor({timeout:20000});
 const starting=await readIdb(page);
 assert.equal(starting.revision,1);
 assert.equal(starting.document.boards[0].references.length,0,'handoff not auto saved by first-create');
 await page.locator('[data-atomic-handoff-add]').waitFor();
 const second=await createPage();
 await second.goto(origin+url,{waitUntil:'domcontentloaded'});
 await second.locator('[data-atomic-handoff-add]').waitFor({timeout:30000});
 const recordName=await page.locator('[data-atomic-handoff-label]').innerText();
 assert.match(recordName,/40000047/);
 await page.locator('[data-atomic-handoff-add]').click();
 await page.locator('[data-atomic-outcome="HANDOFF_ADDED"]').waitFor({timeout:20000});
 const saved=await readIdb(page);
 assert.equal(saved.revision,2);
 assert.equal(saved.document.boards[0].references.length,1);
 assert.equal(saved.document.boards[0].references[0].entityId,'40000047');
 assert.equal(saved.backupDocument.boards[0].references.length,0);
 assert.equal(await page.locator('[data-atomic-handoff-add]').count(),0,'already stored cannot toggle-remove');
 assert.equal(await page.locator('[data-atomic-handoff-already]').count(),1);
 await second.locator('[data-atomic-handoff-add]').click();
 await second.locator('[data-atomic-outcome="REJECTED"]').waitFor({timeout:15000});
 assert.equal((await readIdb(second)).revision,2);
 assert.equal((await readIdb(second)).document.boards[0].references.length,1,
  'stale tab cannot silently toggle/remove another tab Item');
 console.log('WEB_COLLECTION_ATOMIC_TWO_TAB_CAS_STALE_NO_DUPLICATE_NO_REMOVE_PASS');
 const [download]=await Promise.all([
  page.waitForEvent('download',{timeout:16000}),
  page.locator('[data-atomic-export]').click()
 ]);
 assert.equal(download.suggestedFilename(),'dreamwish-wand-atomic-first-backup.json');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(exported.boards.length,1);
 assert.equal(exported.boards[0].references.length,0,'real prior Revision backup, not falsely current data');
 const reopened=await createPage();
 await reopened.goto(origin+url,{waitUntil:'domcontentloaded'});
 await reopened.locator('[data-atomic-handoff-already]').waitFor({timeout:30000});
 assert.equal(await reopened.locator('[data-atomic-handoff-add]').count(),0);
 assert.equal(await reopened.locator('[data-atomic-item="40000047"]').count(),1);
 assert.equal(await reopened.locator('[data-atomic-items] [data-item-thumb-id]').count(),0,'saved private Board rows cannot auto-request images');
 const plain=await createPage();
 await plain.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'});
 await plain.locator('[data-atomic-item="40000047"]').waitFor({timeout:30000});
 assert.equal(await plain.locator('[data-item-thumb-id]').count(),0,'no explicit public selection');
 await plain.close();
 await reopened.locator('[data-atomic-reopen]').click();
 await reopened.locator('[data-atomic-outcome="REOPENED"]').waitFor();
 const reopenedRow=await readIdb(reopened);
 assert.equal(reopenedRow.primary,saved.primary);
 assert.equal(reopenedRow.backup,saved.backup);
 assert.deepEqual(await checkOld(),old);
 console.log('WEB_COLLECTION_ATOMIC_BACKUP_DOWNLOAD_FRESH_TAB_REOPEN_LEGACY_INTACT_PASS');
 const adversarial=[
  '/moodboards/atomic/?item=999999',
  '/moodboards/atomic/?item=00040000047',
  '/moodboards/atomic/?item=40000047&item=40000047',
  '/moodboards/atomic/?item=40000047&revision=2',
  '/moodboards/atomic/?item=-1',
  '/moodboards/atomic/?item=9007199254740992'
 ];
 for(const path of adversarial){
  const p=await createPage();
  await p.goto(origin+path,{waitUntil:'domcontentloaded'});
  await p.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
  await p.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
  assert.equal(await p.locator('[data-atomic-handoff-add]').count(),0,path);
  assert.equal(await p.locator('[data-atomic-handoff-denied]').count(),1,path);
  assert.equal(await p.locator('[data-atomic-handoff-preview], [data-item-thumb-id]').count(),0,path);
  await p.close();
 }
 const verifiedAfter=await readIdb(page);
 assert.equal(verifiedAfter.primary,saved.primary);
 assert.equal(verifiedAfter.backup,saved.backup);
 console.log('WEB_COLLECTION_ATOMIC_FORGED_DUP_QUERY_BAD_ID_FAIL_CLOSED_PASS');
 // Old non-cooperating tab can write the legacy storage after new IDB commit,
 // but it has NO permission/path to overwrite this isolated IDB namespace.
 const late='{"noncooperating":"oldtab","late":true}';
 await page.evaluate(([a,value])=>localStorage.setItem(a,value),[primary,late]);
 const afterLate=await readIdb(reopened);
 assert.equal(afterLate.primary,saved.primary);
 assert.equal(afterLate.backup,saved.backup);
 assert.equal((await checkOld()).current,late);
 assert.equal((await checkOld()).previous,old.previous);
 assert.deepEqual(offsite,[]);
 assert.deepEqual(errors,[]);
 console.log('WEB_COLLECTION_ATOMIC_OLD_WRITER_NO_IDB_LOSS_NO_OUTBOUND_POST_PASS');
 console.log('WEB_COLLECTION_ATOMIC_REAL_CHROME_FINAL_PASS');
}finally{await ctx.close();await browser.close();}
