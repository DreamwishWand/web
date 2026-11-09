import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {worldEditorStage1Copy} from '../src/lib/wep/world-editor-stage1-copy.js';
import {moodboardCopy} from '../src/lib/moodboards/copy.js';
const origin=process.env.WEP_ATOMIC_DRAFT_ORIGIN||'http://127.0.0.1:4337';
if(!/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin)||!process.env.CHROME_BIN)
 throw Error('WEP_ATOMIC_CHROME_LOCAL_ONLY');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const errors=[],outbound=[];
ctx.on('request',req=>{
 if(new URL(req.url()).origin!==origin||!['GET','HEAD'].includes(req.method()))
  outbound.push(req.method()+' '+req.url());
});
const newPage=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));return p;};
const page=await newPage();
const oldKey='dreamwishwand:moodboards:v1',bakKey=oldKey+':backup';
const compare=async(p)=>p.evaluate(async()=>{
 const m=await import('/src/lib/moodboards/atomic-first-board.mjs');
 const db=await m.openAtomicFirstBoardDatabase();
 try{return await m.verifiedAtomicFirstBoardReopen(db);}finally{db.close();}
});
const makeUrl=(row,ref)=>'/editor/world/?atomicBoard='+encodeURIComponent(row.boardId)+
 '&atomicRevision='+row.revision+'&atomicReference='+encodeURIComponent(ref.id)+
 '&atomicItem='+encodeURIComponent(ref.entityId);
try{
 await page.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-atomic-ready="true"]').waitFor({timeout:30000});
 await page.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 const legacy=await page.evaluate(async([k,b])=>{
  const m=await import('/src/lib/moodboards/store.js');
  const initial=m.createEmptyMoodboardDocument('2026-11-09T00:00:00.000Z');
  const d=m.createMoodboard(initial,{title:'Separate legacy source'},
    {now:'2026-11-09T00:00:01.000Z',idFactory:()=> 'older-board'}).document;
  const primary=m.serializeMoodboardDocument(d),backup=m.serializeMoodboardDocument(initial);
  localStorage.setItem(k,primary);localStorage.setItem(b,backup);
  return {primary,backup};
 },[oldKey,bakKey]);
 const legacyNow=()=>page.evaluate(([k,b])=>({primary:localStorage.getItem(k),backup:localStorage.getItem(b)}),[oldKey,bakKey]);
 await page.locator('[data-atomic-title]').fill('WEP readonly draft from isolated Board');
 await page.locator('[data-atomic-create]').click();
 await page.locator('[data-atomic-outcome="CREATED"]').waitFor({timeout:20000});
 await page.locator('[data-atomic-item-id]').fill('40000047');
 await page.locator('[data-atomic-save-item]').click();
 await page.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:20000});
 const saved=await compare(page);
 assert.equal(saved.revision,2);
 assert.equal(saved.document.boards[0].references.length,1);
 const ref=saved.document.boards[0].references[0];
 assert.equal(ref.type,'ITEM');
 assert.equal(ref.entityId,'40000047');
 const uri=makeUrl(saved,ref);
 assert.equal((await page.goto(origin+uri,{waitUntil:'domcontentloaded'})).status(),200);
 const receiver=page.locator('[data-wep-atomic-draft-receiver]');
 await receiver.waitFor({timeout:30000});
 assert.equal(await receiver.getAttribute('data-wep-native-placement'),'off');
 assert.equal(await receiver.getAttribute('data-wep-atomic-gate'),
  'READONLY_PENDING_SELECTION__NO_NATIVE_PLACEMENT');
 assert.equal(await receiver.getAttribute('data-wep-atomic-status'),'NOT_INSPECTED');
 assert.equal(await receiver.locator('[data-wep-atomic-inspected]').count(),0);
 assert.equal(await receiver.locator('[data-wep-atomic-held]').count(),0);
 assert.deepEqual(await legacyNow(),legacy);
 assert.equal((await compare(page)).primary,saved.primary);
 console.log('WEP_ATOMIC_DRAFT_NO_AUTOREAD_NO_NATIVE_PLACEMENT_LEGACY_INTACT_PASS');

 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.selectOption('#site-locale',locale);
  const c=worldEditorStage1Copy(locale);
  await page.waitForFunction(s=>
   document.querySelector('[data-wep-atomic-inspect]')?.textContent?.trim()===s,c.atomicInspect);
  assert.equal((await receiver.locator('[data-wep-atomic-storage-note]').innerText()).trim(),
   moodboardCopy(locale).atomicNote);
  assert.equal((await receiver.locator('[data-wep-atomic-boundary]').innerText()).trim(),
   c.atomicBoundary);
 }
 await page.selectOption('#site-locale','ja');
 await page.setViewportSize({width:320,height:850});
 await page.waitForFunction(s=>document.querySelector('[data-wep-atomic-inspect]')?.textContent?.trim()===s,
  worldEditorStage1Copy('ja').atomicInspect);
 const mobile=await receiver.boundingBox();
 assert.ok(mobile&&mobile.x>=-1&&mobile.x+mobile.width<=320+2,'receiver 320px viewport '+JSON.stringify(mobile));
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 const zoom=await receiver.boundingBox();
 assert.ok(zoom&&zoom.x>=-2&&zoom.x+zoom.width<=640+2,'receiver 200% viewport '+JSON.stringify(zoom));
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1280,height:900});
 await receiver.locator('[data-wep-atomic-inspect]').focus();
 assert.equal(await receiver.locator('[data-wep-atomic-inspect]').evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Enter');
 await receiver.locator('[data-wep-atomic-inspected]').waitFor({timeout:30000});
 assert.equal(await receiver.getAttribute('data-wep-atomic-status'),'INSPECTED');
 assert.match(await receiver.locator('[data-wep-atomic-inspected]').innerText(),/40000047/);
 await receiver.locator('[data-wep-atomic-hold]').focus();
 await page.keyboard.press('Enter');
 await receiver.locator('[data-wep-atomic-held]').waitFor({timeout:15000});
 assert.equal(await receiver.getAttribute('data-wep-atomic-status'),'HELD');
 assert.equal((await compare(page)).primary,saved.primary,'inspect+hold must not mutate IDB');
 assert.equal((await compare(page)).backup,saved.backup);
 assert.deepEqual(await legacyNow(),legacy,'inspect+hold must not modify legacy');
 console.log('WEP_ATOMIC_DRAFT_EIGHT_LOCALES_320_200_KEYBOARD_READONLY_HOLD_PASS');
 await receiver.locator('[data-wep-atomic-clear]').click();
 assert.equal(await receiver.getAttribute('data-wep-atomic-status'),'NOT_INSPECTED');
 assert.equal(await receiver.locator('[data-wep-atomic-held]').count(),0);
 assert.equal((await compare(page)).revision,2);
 console.log('WEP_ATOMIC_DRAFT_CLEAR_ONLY_IN_MEMORY_NO_UNDO_CHANGE_PASS');

 // The receiver must revalidate right before HOLD; a different tab modifying
 // the IDB Board after INSPECT must invalidate the stale token.
 await receiver.locator('[data-wep-atomic-inspect]').click();
 await receiver.locator('[data-wep-atomic-inspected]').waitFor();
 const writer=await newPage();
 await writer.goto(origin+'/moodboards/atomic/',{waitUntil:'domcontentloaded'});
 await writer.locator('[data-atomic-catalog="ready"]').waitFor({timeout:30000});
 await writer.locator('[data-atomic-item-id]').fill('40000047');
 await writer.locator('[data-atomic-save-item]').click();
 await writer.locator('[data-atomic-outcome="ITEM_SAVED"]').waitFor({timeout:20000});
 const mutated=await compare(writer);
 assert.equal(mutated.revision,3);
 assert.equal(mutated.document.boards[0].references.length,0);
 await receiver.locator('[data-wep-atomic-hold]').click();
 await receiver.locator('[data-wep-atomic-error]').waitFor({timeout:15000});
 assert.equal(await receiver.getAttribute('data-wep-atomic-status'),'REJECTED');
 assert.equal(await receiver.locator('[data-wep-atomic-held]').count(),0);
 assert.equal((await compare(page)).primary,mutated.primary);
 console.log('WEP_ATOMIC_DRAFT_STALE_REVISION_INSPECT_HOLD_REJECT_NO_PLACEMENT_PASS');

 for(const bad of [
  uri.replace('atomicRevision=2','atomicRevision=3'),
  uri.replace('atomicRevision=2','atomicRevision=01'),
  uri.replace('atomicBoard=board_atomic_','atomicBoard=stage1_'),
  uri.replace('atomicItem=40000047','atomicItem=999999'),
  uri+'&atomicItem=40000047',
  uri+'&oldMoodboard=legacy',
  uri.replace('atomicReference='+encodeURIComponent(ref.id),'atomicReference=ref_wrong'),
  uri.replace('atomicItem=40000047','atomicItem=9007199254740992')
 ]){
  const p=await newPage();
  await p.goto(origin+bad,{waitUntil:'domcontentloaded'});
  const target=p.locator('[data-wep-atomic-draft-receiver]');
  await target.waitFor({timeout:30000});
  const button=target.locator('[data-wep-atomic-inspect]');
  if(await button.isEnabled()){
   await button.click();
   await target.locator('[data-wep-atomic-error]').waitFor({timeout:20000});
  }else await target.locator('[data-wep-atomic-error]').waitFor({timeout:20000});
  assert.equal(await target.locator('[data-wep-atomic-held]').count(),0,bad);
  assert.equal(await target.getAttribute('data-wep-atomic-status'),'REJECTED',bad);
  await p.close();
 }
 assert.equal((await compare(writer)).primary,mutated.primary);
 assert.equal((await compare(writer)).backup,mutated.backup);
 assert.deepEqual(await legacyNow(),legacy);
 assert.deepEqual(outbound,[],'no offhost requests or POST');
 assert.deepEqual(errors,[],'no browser errors');
 console.log('WEP_ATOMIC_DRAFT_BAD_BOARD_REF_ITEM_QUERY_DENY_NO_STORE_WRITE_PASS');
 console.log('WEP_ATOMIC_DRAFT_REAL_CHROME_FINAL_PASS');
}finally{await ctx.close();await browser.close();}
