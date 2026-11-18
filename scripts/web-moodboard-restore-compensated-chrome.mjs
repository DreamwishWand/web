import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {MOODBOARD_STORAGE_KEY as MAIN,MOODBOARD_BACKUP_KEY as PREVIOUS} from '../src/lib/moodboards/store.js';

if(!process.env.CHROME_BIN)throw Error('INSTALLED_CHROME_REQUIRED');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const root='http://127.0.0.1:4298/web/moodboards/';
const snapshot=page=>page.evaluate(([m,p])=>({
 main:localStorage.getItem(m),previous:localStorage.getItem(p)
}),[MAIN,PREVIOUS]);
const create=async(page,title)=>{
 await page.locator('[data-moodboard-quick-create] input').fill(title);
 await page.locator('[data-moodboard-quick-create] button').click();
};
try{
 for(const width of [1366,320]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',request=>{
   if(request.method()!=='GET')requests.push(request.method()+':'+request.url());
  });
  try{
   await page.goto(root,{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('[data-moodboard-quick-create] input').waitFor({state:'visible'});
   await create(page,'Restore A');await create(page,'Restore B');
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),2);
   const before=await snapshot(page);
   assert.ok(before.main?.includes('Restore B'));
   assert.ok(before.previous?.includes('Restore A'));
   const button=page.locator('[data-moodboard-local-restore]');
   await button.click();
   const restored=await snapshot(page);
   assert.equal(restored.main,before.previous,'restore current from previously accepted exact bytes');
   assert.equal(restored.previous,before.main,'old current is now previous and remains recoverable');
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),1);
   await button.click();
   const again=await snapshot(page);
   assert.equal(again.main,before.main,'second explicit Restore reverses prior restore');
   assert.equal(again.previous,before.previous);
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),2);

   // Browser WebStorage injection: Previous is already changed when primary
   // setItem partially commits and throws. Verified rollback must recover
   // BOTH prior raw keys and never falsely report a restored workspace.
   await page.evaluate(key=>{
    window.__moodboardOriginalSetItem=Storage.prototype.setItem;
    window.__moodboardFirstPrimary=true;
    Storage.prototype.setItem=function(k,v){
     if(k===key&&window.__moodboardFirstPrimary){
      window.__moodboardFirstPrimary=false;
      window.__moodboardOriginalSetItem.call(this,k,v);
      throw new DOMException('partially written','QuotaExceededError');
     }
     return window.__moodboardOriginalSetItem.call(this,k,v);
    };
   },MAIN);
   try{
    await button.click();
    const denied=await snapshot(page);
    assert.deepEqual(denied,again,'partial failed Restore cannot destroy either snapshot');
    assert.equal(await page.locator('[data-moodboard-root-card]').count(),2,
      'failed Restore cannot report/display a different current Board');
    const status=await page.locator('.status[role="status"]').innerText();
    assert.ok(status.length>0,'failed Restore must show localized error');
   }finally{
    await page.evaluate(()=>{Storage.prototype.setItem=window.__moodboardOriginalSetItem});
   }
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('[data-moodboard-root-card]').first().waitFor({state:'visible'});
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),2,
     'independent page reload preserves old current after denied Restore');
   assert.deepEqual(await snapshot(page),again);
   if(width===320){
    await page.setViewportSize({width:640,height:900});
    await page.evaluate(()=>{document.documentElement.style.zoom='2'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,
      'mobile 200% zoom no horizontal overflow');
   }
   assert.deepEqual(errors,[],'no browser JS exceptions');
   assert.deepEqual(requests,[],'no Save/Cloud POST from local Restore');
   console.log('08WEB_MOODBOARD_MANUAL_RESTORE_REVERSIBLE_PARTIAL_QUOTA_1366_320_PASS_'+width);
  }finally{await page.close();await context.close()}
 }
}finally{await browser.close()}
