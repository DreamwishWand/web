import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {verifiedMoodboardBatchCopy} from '../src/lib/explore/verified-moodboard-batch.mjs';
const origin=process.env.EXPLORE_BULK_ORIGIN||'http://127.0.0.1:4362';
assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]+$/);
assert.ok(process.env.CHROME_BIN,'installed Chrome required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:860},serviceWorkers:'block'});
const errors=[],unsafe=[];
context.on('request',request=>{
 if(new URL(request.url()).origin!==origin||!['GET','HEAD'].includes(request.method()))
  unsafe.push(request.method()+' '+request.url());
});
try{
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin+'/web/moodboards/',{waitUntil:'networkidle',timeout:30000});
 const create=page.locator('form.new-board');
 await create.locator('input').first().fill('Bulk verified catalog plan');
 await create.locator('button[type=submit]').click();
 await page.locator('[data-moodboard-root-card]').first().waitFor({state:'visible'});
 await page.goto(origin+'/web/explore/',{waitUntil:'networkidle',timeout:45000});
 await page.locator('[data-explore-bulk-moodboard-add]').waitFor({state:'visible'});
 const action=page.locator('[data-explore-bulk-moodboard-add]');
 assert.equal(await action.isEnabled(),true);
 const initial=await page.evaluate(()=>({
  current:localStorage.getItem('dreamwishwand:moodboards:v1'),
  backup:localStorage.getItem('dreamwishwand:moodboards:v1:backup')
 }));
 const count=async()=>page.evaluate(()=>
  JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')).boards[0].references.length);
 assert.equal(await count(),0);
 const button=await action.boundingBox();
 assert.ok(button?.width>=44&&button.height>=44,'44px accessible bulk action');
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(loc);
  const label=verifiedMoodboardBatchCopy(loc).action;
  await page.waitForFunction(label=>document.querySelector('[data-explore-bulk-moodboard-add]')?.textContent?.trim()===label,label);
 }
 await page.locator('#site-locale').selectOption('en');
 await action.focus();await page.keyboard.press('Enter');
 assert.equal(await count(),24);
 const first=await page.evaluate(()=>({
  current:localStorage.getItem('dreamwishwand:moodboards:v1'),
  backup:localStorage.getItem('dreamwishwand:moodboards:v1:backup'),
  refs:JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')).boards[0].references
 }));
 assert.equal(first.backup,initial.current,'first atomic CAS retained prior document');
 assert.equal(new Set(first.refs.map(r=>r.entityId)).size,24);
 assert.ok(first.refs.every(r=>r.type==='ITEM'&&r.url===null));
 assert.equal(await page.getByRole('dialog').count(),0,'bulk is independent of Quick Review');
 assert.equal(await page.locator('[data-game-save-writer="off"]').count(),1);
 assert.equal(await page.locator('[data-auto-cloud="off"]').count(),1);
 console.log('08WEB_EXPLORE_BULK_24_VERIFIED_ONE_ATOMIC_CAS_8LOCALE_PASS');
 await action.click();
 assert.equal(await count(),48);
 const second=await page.evaluate(()=>({
  current:localStorage.getItem('dreamwishwand:moodboards:v1'),
  backup:localStorage.getItem('dreamwishwand:moodboards:v1:backup'),
  refs:JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')).boards[0].references
 }));
 assert.equal(second.backup,first.current);
 assert.equal(new Set(second.refs.map(r=>r.entityId)).size,48);
 // Same-tab external raw mutation must not be mistaken for a UI click receipt.
 const afterExternal=await page.evaluate(()=>{
  const key='dreamwishwand:moodboards:v1';
  const old=localStorage.getItem(key);
  const current=JSON.parse(old);
  current.boards[0].title='External current newer than UI';
  const newRaw=JSON.stringify(current,null,2)+'\n';
  localStorage.setItem(key,newRaw);
  return {newRaw,backup:localStorage.getItem('dreamwishwand:moodboards:v1:backup')};
 });
 await action.click();
 assert.equal(await page.locator('.status').filter({hasText:verifiedMoodboardBatchCopy('en').blocked}).count(),1);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dreamwishwand:moodboards:v1')),afterExternal.newRaw);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dreamwishwand:moodboards:v1:backup')),afterExternal.backup);
 console.log('08WEB_EXPLORE_BULK_STALE_CAS_NEWER_RAW_PRIMARY_BACKUP_INVARIANT_PASS');
 for(const zoom of ['1','2']){
  await page.setViewportSize({width:320,height:880});
  await page.evaluate(z=>{document.documentElement.style.zoom=z},zoom);
  const width=await page.locator('[data-explore-bulk-moodboard]').evaluate(el=>({c:el.clientWidth,s:el.scrollWidth}));
  assert.ok(width.s<=width.c+2,'bulk responsive '+zoom+': '+JSON.stringify(width));
  assert.equal(await action.isVisible(),true);
 }
 assert.deepEqual(errors,[],'No JS exceptions');
 assert.deepEqual(unsafe,[],'Never external POST or Cloud');
 console.log('08WEB_EXPLORE_BULK_320_CSS200_NO_GAME_SAVE_NO_POST_PASS');
}finally{await context.close();await browser.close()}
