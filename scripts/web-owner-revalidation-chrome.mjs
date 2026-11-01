import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

// NEW-ONLY signed Owner 403 ambiguity and explicit Fresh. Genuine local
// GoTrue + Source153 HTTP; runner-only Python controls the signed withdrawal.
// Does not repeat the previously accepted 9+11 or PR291 lifecycle matrices.
const id=process.env;
if(id.DDVRE_E2_LOCAL_DISPOSABLE!=='APPROVED' ||
   ['CHROME_BIN','E2_ORIGINAL_WORK_ID','E2_OWNER_EMAIL','E2_OWNER_PASSWORD'].some(k=>!id[k]))
  throw Error('DISPOSABLE_SIGNED_403_FIXTURE_REQUIRED');
const browser=await chromium.launch({executablePath:id.CHROME_BIN,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage']});
const origin='http://127.0.0.1:4175';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const eventually=async(check)=>{
  for(let i=0;i<160;i++){if(await check())return;await wait(75);}
  throw Error('SIGNED_403_RECOVERY_OBSERVATION_TIMEOUT');
};
const handshake=async(marker)=>{
  process.stdout.write(marker+'\n');
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('SIGNED_403_FIXTURE_HANDSHAKE_TIMEOUT')),45000);
    process.stdin.once('data',()=>{clearTimeout(timeout);resolve();});
  });
};
const statuses=[],failures=[];
let requests=0;
try {
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 page.on('pageerror',()=>failures.push('PAGE_ERROR'));
 const authority='/__source153_e2/functions/v1/community-dreamsnap-owner';
 page.on('request',r=>{if(r.url().includes(authority))requests++;});
 page.on('response',r=>{if(r.url().includes(authority))statuses.push(r.status());});
 const res=await page.goto(origin+'/dreamsnaps/my/manage/source153-e2/?work='+id.E2_ORIGINAL_WORK_ID,
  {waitUntil:'domcontentloaded'});
 assert.equal(res?.status(),200);
 await page.locator('#e2-email').fill(id.E2_OWNER_EMAIL);
 await page.locator('#e2-password').fill(id.E2_OWNER_PASSWORD);
 await page.locator('[data-e2-login] button').click();
 await eventually(async()=>await page.locator('[data-e2-status]').innerText()==='SIGNED_LOCAL_SESSION_CANDIDATE');

 await page.locator('[data-e2-inspect]').click();
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===1);
 assert.equal(await page.locator('[data-e2-status]').innerText(),'SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.deepEqual(statuses,[200]);
 assert.equal(requests,1);
 assert.equal(await page.locator('[data-e2-grant]').innerText(),'recorded');

 await handshake('WEB403_READY_WITH_CAS1');
 // Python executes ACTUAL signed Owner A Withdrawal, CAS1/1 -> CAS2/2.
 await page.locator('[data-e2-inspect]').click();
 await eventually(async()=>await page.locator('[data-e2-status]').innerText()==='BACKEND_UNAVAILABLE');
 assert.equal(await page.locator('[data-e2-projection]').count(),0);
 assert.equal(statuses[1],403,'REAL_STALE_CAS_HTTP403_REQUIRED');
 assert.equal(requests,2);
 assert.equal(await page.locator('[data-e2-inspect]').isDisabled(),true);
 assert.equal(await page.locator('[data-e2-neutral-recovery]').count(),1);
 assert.equal(await page.locator('[data-e2-fresh-read]').isEnabled(),true);
 assert.equal(await page.locator('[data-e2-status]').innerText(),'BACKEND_UNAVAILABLE');

 // Lifecycle events MUST NOT silently retry the stale CAS nor invoke
 // a fresh request. Simulated browser events, not physical OS visibility.
 await page.evaluate(()=>{
  window.dispatchEvent(new Event('blur'));
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('offline'));
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('online'));
  window.dispatchEvent(new Event('focus'));
  window.dispatchEvent(new Event('pageshow'));
 });
 await wait(450);
 assert.equal(requests,2,'UNAUTHORIZED_AUTOMATIC_403_RETRY');
 assert.equal(await page.locator('[data-e2-status]').innerText(),'BACKEND_UNAVAILABLE');
 assert.equal(await page.locator('[data-e2-projection]').count(),0);

 await page.locator('[data-e2-fresh-read]').focus();
 await page.keyboard.press('Enter');
 await eventually(async()=>await page.locator('[data-e2-projection]').count()===1);
 assert.equal(statuses[2],200,'SIGNED_CAS_OMITTED_FRESH_OWNER_HTTP200_REQUIRED');
 assert.equal(requests,3,'EXPLICIT_FRESH_MUST_SEND_ONE_REQUEST');
 assert.equal(await page.locator('[data-e2-grant]').innerText(),'withdrawn');
 assert.equal(await page.locator('[data-e2-public-disabled]').innerText(),'true');
 assert.equal(await page.locator('[data-e2-inspect]').isEnabled(),true);
 assert.equal(await page.locator('[data-owner-actions="disabled"]').count(),1);

 await handshake('WEB403_REVOKE_READY');
 // Python retires the SAME actor after successful withdrawn source-only read.
 await page.locator('[data-e2-inspect]').click();
 await eventually(async()=>await page.locator('[data-e2-status]').innerText()==='BACKEND_UNAVAILABLE');
 assert.equal(await page.locator('[data-e2-projection]').count(),0);
 assert.ok([401,403,404].includes(statuses[3]),'ACTOR_REVOKED_READ_DENIAL_REQUIRED');
 assert.equal(await page.locator('[data-e2-fresh-read]').count(),1);
 await page.locator('[data-e2-fresh-read]').focus();
 await page.keyboard.press('Enter');
 await eventually(async()=>requests>=5);
 await eventually(async()=>await page.locator('[data-e2-status]').innerText()==='BACKEND_UNAVAILABLE');
 assert.ok([401,403,404].includes(statuses[4]),'ACTOR_REVOKED_FRESH_DENIAL_REQUIRED');
 assert.equal(await page.locator('[data-e2-projection]').count(),0);
 assert.equal(await page.locator('[data-e2-inspect]').isDisabled(),true);
 assert.equal(await page.locator('[data-owner-actions="disabled"]').count(),1);
 const html=await page.locator('body').innerText();
 for(const secret of [id.E2_OWNER_EMAIL,id.E2_ORIGINAL_WORK_ID,'access_token','storageKey','signedUrl'])
   assert.ok(!html.includes(secret),'SENSITIVE_FIELD_IN_DOM');
 assert.deepEqual(failures,[]);
 await context.close();
 console.log('WEB403_HTTP_STALE_CAS='+statuses[1]);
 console.log('WEB403_HTTP_EXPLICIT_FRESH='+statuses[2]);
 console.log('WEB403_HTTP_REVOKED_READ='+statuses[3]);
 console.log('WEB403_HTTP_REVOKED_FRESH='+statuses[4]);
 console.log('WEB_OWNER_403_RECOVERY_SIGNED_CHROMIUM_NEW_ONLY_PASS_LOCAL');
}catch(err){
 const line=String(err?.stack??'').match(/web-owner-revalidation-chrome\.mjs:(\d+):/)?.[1]??'UNKNOWN';
 console.log('WEB403_CASELINE '+line);
 throw err;
}finally{await browser.close();}
