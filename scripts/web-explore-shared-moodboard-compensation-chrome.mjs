import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {MOODBOARD_STORAGE_KEY as MAIN,MOODBOARD_BACKUP_KEY as PREVIOUS} from
 '../src/lib/moodboards/store.js';
if(!process.env.CHROME_BIN)throw Error('REAL_INSTALLED_CHROME_REQUIRED');
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']
});
const host='http://127.0.0.1:4298/web';
try{
 for(const width of [1366,320]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',req=>{
   if(req.method()!=='GET'&&req.method()!=='HEAD')requests.push(req.method()+' '+req.url());
  });
  try{
   await page.goto(host+'/moodboards/',{waitUntil:'domcontentloaded'});
   await page.locator('form.new-board input').fill('Explore shared backup Board A');
   await page.locator('form.new-board button[type=submit]').click();
   await page.locator('[data-moodboard-root-card]').first().waitFor();
   const rawA=await page.evaluate(key=>localStorage.getItem(key),MAIN);
   assert.ok(rawA?.includes('Explore shared backup Board A'));
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),PREVIOUS),null);
   await page.goto(host+'/explore/',{waitUntil:'domcontentloaded'});
   const card=page.locator('article.card').first();
   await card.waitFor({state:'visible',timeout:30000});
   const action=card.locator('[data-explore-moodboard-toggle]');
   assert.equal(await action.isEnabled(),true);
   assert.equal(await action.getAttribute('aria-pressed'),'false');
   const rect=await action.boundingBox();
   assert.ok(rect?.width>=44&&rect?.height>=44);
   await action.click();
   assert.equal(await action.getAttribute('aria-pressed'),'true');
   const rawB=await page.evaluate(key=>localStorage.getItem(key),MAIN);
   assert.ok(rawB&&rawB!==rawA);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),PREVIOUS),rawA,
    'Explore succeeds with exact A full prior backup');
   assert.equal(await page.getByRole('dialog').count(),0);

   // Web Storage quota error after previous-key write, prior raw A must be
   // restored while the present Item remains visibly added (no false ACK).
   await page.evaluate(key=>{
    window.__exploreOriginalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
     if(k===key)throw new DOMException('quota','QuotaExceededError');
     return window.__exploreOriginalSetItem.call(this,k,v);
    };
   },MAIN);
   await action.click();
   assert.equal(await action.getAttribute('aria-pressed'),'true',
    'quota rejected remove must not flip the visible action state');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),MAIN),rawB);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),PREVIOUS),rawA,
    'quota rejected Explore edit keeps BOTH current and previous raw bytes');
   const status=await page.locator('.status[role=status]').last().innerText();
   assert.ok(status.length>12&&/Moodboard|心情板/.test(status),'user-visible localized failure');
   await page.evaluate(()=>{Storage.prototype.setItem=window.__exploreOriginalSetItem});

   // Another tab uses the accepted Moodboards entrypoint. The Explore
   // membership is re-read only from a validated storage event.
   const other=await context.newPage();
   await other.goto(host+'/moodboards/',{waitUntil:'domcontentloaded'});
   await other.locator('form.new-board input').fill('Board B separate tab');
   await other.locator('form.new-board button[type=submit]').click();
   await other.locator('[data-moodboard-root-card]').nth(1).waitFor();
   const rawC=await page.evaluate(key=>localStorage.getItem(key),MAIN);
   assert.ok(rawC?.includes('Board B separate tab'));
   await page.waitForFunction(()=>document.querySelectorAll('select option').length>3);
   // Do not rely on number of unrelated select choices; verify exact Board.
   await page.locator('select').filter({has:page.locator('option', {hasText:'Board B separate tab'})}).first().waitFor({state:'attached'});
   const observedBoard=await page.locator('select').filter({has:page.locator('option',{hasText:'Board B separate tab'})}).first().locator('option').allTextContents();
   assert.ok(observedBoard.some(x=>x.includes('Board B separate tab')));

   // A same-document write bypasses StorageEvent: raw CAS must deny the
   // stale Explore model, not overwrite a valid newer document/backup.
   const injected=await page.evaluate(key=>{
    const raw=localStorage.getItem(key)+' ';
    localStorage.setItem(key,raw);return raw;
   },MAIN);
   const backupBefore=await page.evaluate(key=>localStorage.getItem(key),PREVIOUS);
   await action.click();
   assert.equal(await action.getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),MAIN),injected);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),PREVIOUS),backupBefore);

   await page.reload({waitUntil:'domcontentloaded'});
   const recovered=page.locator('article.card').first().locator('[data-explore-moodboard-toggle]');
   await recovered.waitFor({state:'visible',timeout:30000});
   assert.equal(await recovered.getAttribute('aria-pressed'),'true');
   await recovered.click();
   assert.equal(await recovered.getAttribute('aria-pressed'),'false');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),PREVIOUS),injected,
    'after explicit reopen successful remove preserves prior exact bytes');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
   if(width===320){
    await page.setViewportSize({width:640,height:900});
    await page.evaluate(()=>{document.documentElement.style.zoom='2'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,
      '200% zoom must not overflow viewport');
   }
   assert.deepEqual(errors,[],'no page JS exceptions');
   assert.deepEqual(requests,[],'no remote posts or cloud backup');
   console.log('08WEB_EXPLORE_MOODBOARD_BOTH_RAW_QUOTA_STALE_REOPEN_CHROME_'+width+'_PASS');
   await other.close();
  }finally{await page.close();await context.close()}
 }
 console.log('08WEB_EXPLORE_MOODBOARD_COMPENSATED_TWO_VIEWPORT_FINAL_PASS');
}finally{await browser.close()}
