import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

// New ONLY: simulated browser lifecycle events + genuine disposable signed
// Source153 revalidation. Accepted PR290 old 9+11 matrices are NOT rerun.
const id=process.env;
const needed=['CHROME_BIN','E2_ORIGINAL_WORK_ID','E2_OWNER_EMAIL','E2_OWNER_PASSWORD'];
if(id.DDVRE_E2_LOCAL_DISPOSABLE!=='APPROVED' || needed.some(k=>!id[k]))
  throw Error('DISPOSABLE_REVALIDATION_FIXTURE_REQUIRED');
const browser=await chromium.launch({executablePath:id.CHROME_BIN,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const origin='http://127.0.0.1:4175';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const eventually=async(fn)=>{
  for(let i=0;i<180;i++){if(await fn())return;await wait(75);}
  throw Error('REVALIDATION_OBSERVATION_TIMEOUT');
};
let hits=0,failures=[];
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:850}});
 const page=await ctx.newPage();
 page.on('pageerror',()=>failures.push('PAGE_ERROR'));
 page.on('response',r=>{
   if(r.url().includes('/__source153_e2/functions/v1/community-dreamsnap-owner') &&
       r.status()===200)hits++;
 });
 const res=await page.goto(origin+'/dreamsnaps/my/manage/source153-e2/?work='+id.E2_ORIGINAL_WORK_ID,{waitUntil:'domcontentloaded'});
 assert.equal(res?.status(),200);
 await page.locator('#e2-email').waitFor();
 await page.locator('#e2-email').fill(id.E2_OWNER_EMAIL);
 await page.locator('#e2-password').fill(id.E2_OWNER_PASSWORD);
 await page.locator('[data-e2-login] button').click();
 await eventually(async()=>await page.locator('[data-e2-status]').innerText()==='SIGNED_LOCAL_SESSION_CANDIDATE');
 await page.locator('[data-e2-inspect]').click();
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===1);
 assert.ok(hits>=1,'INITIAL_REAL_OWNER_HTTP_MISSING');

 // Passive unchanged source view is NOT falsely claimed as push-revoked.
 await wait(150);
 assert.equal(await page.locator('[data-e2-projection]').count(),1);
 assert.equal(hits,1);

 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===0);
 assert.equal(await page.locator('[data-e2-status]').innerText(),'REVALIDATION_REQUIRED');
 assert.equal(await page.locator('[data-e2-inspect]').isDisabled(),true);

 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===1);
 assert.ok(hits>=2,'ONLINE_SIGNED_REREAD_MISSING');

 // Simulated page visibility/focus events; not OS/browser physical activity.
 await page.evaluate(()=>{
   Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
   document.dispatchEvent(new Event('visibilitychange'));
 });
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===0);
 await page.evaluate(()=>{
   Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
   document.dispatchEvent(new Event('visibilitychange'));
 });
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===1);
 assert.ok(hits>=3,'VISIBLE_SIGNED_REREAD_MISSING');

 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===0);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===1);
 assert.ok(hits>=4,'FOCUS_SIGNED_REREAD_MISSING');

 const html=await page.locator('body').innerText();
 assert.ok(!html.includes(id.E2_OWNER_EMAIL),'EMAIL_IN_DOM');
 assert.ok(!html.includes(id.E2_ORIGINAL_WORK_ID),'WORK_LOCATOR_IN_DOM');
 for(const word of ['access_token','refresh_token','storageKey','signedUrl']){
   assert.ok(!html.includes(word),'SENSITIVE_SOURCE_FIELD_IN_DOM');
 }
 assert.equal(await page.locator('[data-owner-actions="disabled"]').count(),1);
 await page.locator('[data-e2-logout]').focus();
 await page.keyboard.press('Enter');
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===0);
 assert.equal((await page.locator('[data-e2-inspect]').isDisabled()),true);
 assert.equal(await page.locator('[data-e2-status]').innerText(),'AUTH_REQUIRED');
 assert.deepEqual(failures,[]);
 await ctx.close();
 console.log('OWNER_REVALIDATION_SIGNED_CHROME_NEW_LIFECYCLE_PASS_LOCAL_ONLY');
}catch(error){
 const line=String(error?.stack??'').match(/web-owner-revalidation-chrome\.mjs:(\d+):/)?.[1]??'UNKNOWN';
 console.log('REVALIDATION_CHROME_CASELINE '+line); // no secret/errors/HTTP bodies
 throw error;
}finally{await browser.close();}
