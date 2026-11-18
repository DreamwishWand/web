import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {MOODBOARD_STORAGE_KEY as MAIN,MOODBOARD_BACKUP_KEY as BACKUP}
 from '../src/lib/moodboards/store.js';
if(!process.env.CHROME_BIN)throw Error('ACTUAL_INSTALLED_CHROME_REQUIRED');
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']
});
const root='http://127.0.0.1:4298/web/moodboards/';
const make=async(page,title)=>{
 await page.locator('[data-moodboard-quick-create] input').fill(title);
 await page.locator('[data-moodboard-quick-create] button').click();
};
try{
 for(const width of [1366,320]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{
   if(r.method()!=='GET'||!r.url().startsWith('http://127.0.0.1:4298/'))
    requests.push(r.method()+':'+r.url());
  });
  try{
   await page.goto(root,{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('[data-moodboard-quick-create]').waitFor({state:'visible'});
   await make(page,'Safe Board A');
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),1);
   const afterA=await page.evaluate(k=>localStorage.getItem(k),MAIN);
   assert.ok(afterA?.includes('Safe Board A'));
   await make(page,'Safe Board B');
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),2);
   const before=await page.evaluate(([m,b])=>({main:localStorage.getItem(m),
    backup:localStorage.getItem(b)}),[MAIN,BACKUP]);
   assert.ok(before.main?.includes('Safe Board B'));
   assert.equal(before.backup,afterA,'B success must retain A as an exact snapshot');

   await page.evaluate(key=>{
    window.__wandSavedSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
     if(k===key)throw new DOMException('quota','QuotaExceededError');
     return window.__wandSavedSetItem.call(this,k,v);
    };
   },MAIN);
   await make(page,'Quota Must Not Save');
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),2,
    'failed create cannot display a third saved board');
   const failed=await page.evaluate(([m,b])=>({main:localStorage.getItem(m),
    backup:localStorage.getItem(b)}),[MAIN,BACKUP]);
   assert.deepEqual(failed,before,'both original snapshots must survive QuotaExceededError');
   assert.equal(await page.locator('[data-moodboard-quick-create] input').inputValue(),
    'Quota Must Not Save','failed write must retain user-entered title');
   await page.evaluate(()=>{Storage.prototype.setItem=window.__wandSavedSetItem});
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('[data-moodboard-root-card]').count(),2);
   assert.equal(await page.getByText('Quota Must Not Save').count(),0);

   // A separate tab loads its old document; a new commit in the first tab
   // must not be overwritten or turned into a bogus "previous" backup.
   const other=await context.newPage();
   await other.goto(root,{waitUntil:'domcontentloaded',timeout:30000});
   await other.locator('[data-moodboard-root-card]').first().waitFor();
   await make(page,'Newer Tab Commit');
   const newer=await page.evaluate(([m,b])=>({main:localStorage.getItem(m),
    backup:localStorage.getItem(b)}),[MAIN,BACKUP]);
   assert.ok(newer.main?.includes('Newer Tab Commit'));
   await make(other,'Stale Tab Must Not Save');
   const still=await page.evaluate(([m,b])=>({main:localStorage.getItem(m),
    backup:localStorage.getItem(b)}),[MAIN,BACKUP]);
   assert.deepEqual(still,newer,'stale tab cannot replace newer main or previous');
   assert.equal(await other.locator('[data-moodboard-root-card]').count(),2);
   await other.close();
   if(width===320){
    await page.setViewportSize({width:640,height:900});
    await page.evaluate(()=>document.documentElement.style.zoom='2');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,
    'Moodboard must remain within viewport at 320 or 200% zoom');
   assert.deepEqual(requests,[],'no remote upload/POST');
   assert.deepEqual(errors,[],'no uncaught browser errors on failed local commits');
   console.log('08WEB_MOODBOARD_CURRENT_AND_PREVIOUS_QUOTA_STALE_CHROME_'+width+'_PASS');
  }finally{await page.close();await context.close()}
 }
 console.log('08WEB_MOODBOARD_ATOMIC_LOCAL_PERSIST_TWO_VIEWPORT_PASS');
}finally{await browser.close()}
