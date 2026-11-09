import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';
const origin=process.env.WEB_ATOMIC_WEP_SENDER_ORIGIN||'http://127.0.0.1:4333';
if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin)||!process.env.CHROME_BIN)
 throw Error('ONLY_LOCAL_INSTALLED_CHROME');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const errors=[],unexpected=[];
context.on('request',req=>{if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))
 unexpected.push(req.method()+' '+req.url());});
const open=async path=>{const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));
 const response=await p.goto(origin+path,{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200,path);return p;};
const atomic='/moodboards/atomic/',editor='/editor/world/';
const dbRow=async p=>p.evaluate(async()=>{
 const m=await import('/src/lib/moodboards/atomic-first-board.mjs');
 const db=await m.openAtomicFirstBoardDatabase();
 try{return await m.verifiedAtomicFirstBoardReopen(db);}finally{db.close();}
});
const getHandoff=async p=>p.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:world-editor:handoff:v1')||'null'));
const getLegacy=async p=>p.evaluate(()=>({
 primary:localStorage.getItem('dreamwishwand:moodboards:v1'),
 backup:localStorage.getItem('dreamwishwand:moodboards:v1:backup')
}));
try{
 const p=await open(atomic);
 await p.locator('[data-atomic-ready="true"]').waitFor({timeout:25000});
 await p.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 assert.equal(await p.locator('[data-atomic-wep-sender]').count(),0,'no sender before a Board');
 const legacy=await p.evaluate(async()=>{
  const m=await import('/src/lib/moodboards/store.js');
  const empty=m.createEmptyMoodboardDocument('2026-11-09T00:00:00.000Z');
  const created=m.createMoodboard(empty,{title:'Old separate localStorage'},
   {now:'2026-11-09T00:00:01.000Z',idFactory:()=> 'existing-old-board'}).document;
  const primary=m.serializeMoodboardDocument(created),backup=m.serializeMoodboardDocument(empty);
  localStorage.setItem('dreamwishwand:moodboards:v1',primary);
  localStorage.setItem('dreamwishwand:moodboards:v1:backup',backup);
  return {primary,backup};
 });
 await p.locator('[data-atomic-title]').fill('Atomic Sender Review');
 await p.locator('[data-atomic-create]').click();
 await p.locator('[data-atomic-outcome="CREATED"]').waitFor();
 assert.equal(await p.locator('[data-atomic-wep-send]').count(),0,'no auto item or sender after first Board');
 await p.locator('[data-atomic-item-id]').fill('40000047');
 await p.locator('[data-atomic-save-item]').click();
 await p.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:25000});
 await p.locator('[data-atomic-wep-send]:not(:disabled)').waitFor({timeout:25000});
 const saved=await dbRow(p);
 assert.equal(saved.revision,2);
 const ref=saved.document.boards[0].references.find(x=>x.entityId==='40000047');
 assert.ok(ref?.id&&ref.type==='ITEM'&&ref.groupIds?.length===0);
 assert.equal(await p.locator('[data-atomic-wep-send]').getAttribute('data-reference-id'),ref.id);
 assert.equal(await p.locator('[data-atomic-wep-separation]').count(),1);
 assert.match(await p.locator('[data-atomic-wep-separation]').innerText(),/IndexedDB/);
 assert.equal(await p.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 assert.deepEqual(await getLegacy(p),legacy);
 assert.equal(await getHandoff(p),null,'no navigation hint until explicit user gesture');
 console.log('WEB_ATOMIC_WEP_NO_AUTO_SAVE_NO_HINT_EXACT_VERIFIED_REF_PASS');
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await p.selectOption('#site-locale',locale);
  await p.waitForFunction(label=>document.querySelector('[data-atomic-wep-send]')?.textContent?.trim().startsWith(label),
   moodboardCopy(locale).openWorldEditor);
  assert.equal((await p.locator('[data-atomic-wep-separation]').innerText()).trim(),
   moodboardCopy(locale).atomicNote);
  assert.equal(await p.locator('[data-atomic-wep-send]').isEnabled(),true);
 }
 console.log('WEB_ATOMIC_WEP_EIGHT_LANGUAGES_INTENT_AND_STORE_WARNING_PASS');
 await p.setViewportSize({width:320,height:850});
 const mobile=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(mobile.scroll<=mobile.client+2,JSON.stringify({mobile}));
 await p.setViewportSize({width:640,height:860});
 await p.evaluate(()=>{document.documentElement.style.zoom='2';});
 const zoom=await p.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.client+2,JSON.stringify({zoom}));
 await p.evaluate(()=>{document.documentElement.style.zoom='1';});
 await p.setViewportSize({width:1280,height:900});
 const send=p.locator('[data-atomic-wep-send]');
 await send.focus();assert.equal(await send.evaluate(el=>el===document.activeElement),true);
 await p.keyboard.press('Enter');
 await p.waitForURL(origin+editor,{timeout:35000});
 await p.locator('[data-wep-pre-source-stage1] [data-wep-decorate-stage1]').waitFor({timeout:35000});
 await p.locator('[data-wep-pre-source-stage1] #pending-item-title').waitFor({timeout:35000});
 assert.match(await p.locator('[data-wep-pre-source-stage1] #pending-item-title').innerText(),/40000047/);
 assert.equal(await p.locator('[data-wep-stage1-change]').count(),0,'navigation never mutates Draft');
 const hint=await getHandoff(p);
 assert.equal(hint.sourceSurface,'atomic-moodboard');
 assert.equal(hint.intent,'ATOMIC_MOODBOARD');
 assert.equal(hint.boardId,saved.boardId);
 assert.equal(hint.revision,saved.revision);
 assert.equal(hint.referenceId,ref.id);
 for(const field of ['persistentWriteAuthorized','productApplyAuthorized','directSourceReplacementAuthorized'])
  assert.equal(hint[field],false,field);
 assert.equal((await dbRow(p)).primary,saved.primary);
 assert.equal((await dbRow(p)).backup,saved.backup);
 assert.deepEqual(await getLegacy(p),legacy);
 console.log('WEB_ATOMIC_WEP_320_ZOOM200_KEYBOARD_EXPLICIT_READONLY_PENDING_PASS');
 const reopened=await open(editor);
 await reopened.locator('[data-wep-pre-source-stage1] #pending-item-title').waitFor({timeout:35000});
 assert.match(await reopened.locator('[data-wep-pre-source-stage1] #pending-item-title').innerText(),/40000047/);
 assert.equal((await dbRow(reopened)).primary,saved.primary);
 assert.deepEqual(await getLegacy(reopened),legacy);
 console.log('WEB_ATOMIC_WEP_FRESH_TAB_REOPEN_VERIFIED_REFDRAFT_NO_WRITER_PASS');
 const stale=await open(atomic);
 await stale.locator('[data-atomic-wep-send]:not(:disabled)').waitFor({timeout:25000});
 const updater=await open(atomic);
 await updater.locator('[data-atomic-item-id]').fill('40000047');
 await updater.locator('[data-atomic-save-item]').click(); // explicit user removes Item in a second tab
 await updater.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor();
 const changed=await dbRow(updater);
 assert.equal(changed.revision,saved.revision+1);
 assert.equal(changed.document.boards[0].references.length,0);
 await stale.locator('[data-atomic-wep-send]').click();
 await stale.locator('[data-atomic-wep-status]').waitFor({timeout:18000});
 assert.equal(await stale.locator('[data-atomic-wep-sender]').count(),1);
 assert.equal(new URL(stale.url()).pathname,atomic);
 assert.equal(await getHandoff(stale).then(x=>x.referenceId),ref.id,'stale send may not overwrite earlier valid hint');
 assert.equal((await dbRow(stale)).primary,changed.primary);
 assert.deepEqual(await getLegacy(stale),legacy);
 console.log('WEB_ATOMIC_WEP_STALE_CROSS_TAB_REF_NO_NAVIGATION_NO_STORE_WRITE_PASS');
 await updater.locator('[data-atomic-delete]').click();
 await updater.locator('[data-atomic-tombstone]').waitFor();
 assert.equal(await updater.locator('[data-atomic-wep-send]').count(),0);
 const deleted=await dbRow(updater);assert.equal(deleted.deleted,true);
 const fresh=await open(atomic);
 await fresh.locator('[data-atomic-tombstone]').waitFor();
 assert.equal(await fresh.locator('[data-atomic-wep-send]').count(),0);
 assert.equal(await fresh.locator('[data-atomic-create]').count(),0);
 assert.deepEqual(await getLegacy(fresh),legacy);
 console.log('WEB_ATOMIC_WEP_DELETED_BOARD_NO_SENDER_NO_MIGRATION_PASS');
 assert.deepEqual(unexpected,[]);
 assert.deepEqual(errors,[]);
 console.log('WEB_ATOMIC_WEP_REAL_INSTALLED_CHROME_FINAL_PASS');
}finally{await context.close();await browser.close();}
