import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const origin='http://127.0.0.1:4175';
const required=['CHROME_BIN','E2_ORIGINAL_WORK_ID','E2_POST_WORK_ID','E2_OWNER_EMAIL',
 'E2_OWNER_PASSWORD','E2_B_EMAIL','E2_B_PASSWORD','E2_M_EMAIL','E2_M_PASSWORD'];
if(required.some(k=>!process.env[k]))throw Error('DISPOSABLE_SIGNED_BROWSER_FIXTURE_NOT_READY');
const id=process.env;
const browser=await chromium.launch({executablePath:id.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
let count=0;
const errors=[];
const expectEventually=async(fn,limit=12000)=>{
 const until=Date.now()+limit;
 while(Date.now()<until){if(await fn())return;await new Promise(r=>setTimeout(r,80));}
 throw Error('SIGNED_BROWSER_STATUS_NOT_REACHED');
};
try {
 const ctx=await browser.newContext({viewport:{width:1280,height:850}});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push('PAGE_ERROR'));
 page.on('console',m=>{if(m.type()==='error'&&!/403|401/.test(m.text()))errors.push('CONSOLE_ERROR');});
 const navigate=async(workId)=>{
   const resp=await page.goto(origin+'/dreamsnaps/my/manage/source153-e2/?work='+workId,
     {waitUntil:'domcontentloaded'});
   assert.equal(resp?.status(),200);
   await page.locator('[data-source153-e2="local-only"]').waitFor();
 };
 const login=async(email,password)=>{
   await page.locator('#e2-email').fill(email);
   await page.locator('#e2-password').fill(password);
   await page.locator('[data-e2-login] button').click();
   await expectEventually(async()=>{
     const s=await page.locator('[data-e2-status]').innerText();
     return ['SIGNED_LOCAL_SESSION_CANDIDATE','AUTH_DENIED','AUTH_UNAVAILABLE'].includes(s);
   });
   assert.equal((await page.locator('[data-e2-status]').innerText()).trim(),
     'SIGNED_LOCAL_SESSION_CANDIDATE');
   assert.equal(await page.locator('#e2-password').inputValue(),'');
 };
 const inspect=async(expected)=>{
   await page.locator('[data-e2-inspect]').click();
   await expectEventually(async()=> (await page.locator('[data-e2-status]').innerText()).trim()!== 'READING_SOURCE');
   const status=(await page.locator('[data-e2-status]').innerText()).trim();
   assert.equal(status,expected);
   return status;
 };
 await navigate(id.E2_ORIGINAL_WORK_ID);
 await login(id.E2_OWNER_EMAIL,id.E2_OWNER_PASSWORD);
 await inspect('SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal((await page.locator('[data-e2-kind]').innerText()).trim(),'OriginalCompetition');
 assert.equal((await page.locator('[data-e2-entry]').innerText()).trim(),'FROZEN_ORIGINAL_ENTRY');
 count++; // True GoTrue ES256 session -> HTTP Source153 original -> WEB267 candidate

 await navigate(id.E2_POST_WORK_ID);
 assert.equal(await page.locator('[data-e2-projection]').count(),0);
 assert.equal(await page.locator('[data-e2-inspect]').isDisabled(),true);
 await login(id.E2_OWNER_EMAIL,id.E2_OWNER_PASSWORD);
 await inspect('SOURCE153_SCHEMA_CANDIDATE_ONLY');
 assert.equal((await page.locator('[data-e2-entry]').innerText()).trim(),'NO_COMPETITION_ENTRY');
 count++; // True signed PostEvent no Entry

 for(const [email,password] of [[id.E2_B_EMAIL,id.E2_B_PASSWORD],[id.E2_M_EMAIL,id.E2_M_PASSWORD]]){
   await navigate(id.E2_ORIGINAL_WORK_ID);
   await login(email,password);
   await inspect('BACKEND_UNAVAILABLE');
   assert.equal(await page.locator('[data-e2-projection]').count(),0);
 }
 count++; // Different signed B and Moderator M cannot read Owner A

 await navigate(id.E2_ORIGINAL_WORK_ID);
 assert.equal(await page.locator('[data-e2-inspect]').isDisabled(),true);
 assert.equal(await page.locator('[data-e2-projection]').count(),0);
 count++; // Anonymous no auth no read

 await page.goto(origin+'/dreamsnaps/my/manage/source153-e2/?work=invalid',
   {waitUntil:'domcontentloaded'});
 await page.locator('[data-e2-state="invalid-work"]').waitFor();
 assert.equal(await page.locator('[data-e2-inspect]').count(),0);
 count++; // Bad UUID no owner request

 await navigate(id.E2_ORIGINAL_WORK_ID);
 await login(id.E2_OWNER_EMAIL,id.E2_OWNER_PASSWORD);
 await inspect('SOURCE153_SCHEMA_CANDIDATE_ONLY');
 await page.goBack({waitUntil:'domcontentloaded'});
 await expectEventually(async()=>await page.locator('[data-e2-projection]').count()===0);
 await page.goForward({waitUntil:'domcontentloaded'});
 await expectEventually(async()=>await page.locator('[data-e2-projection]').count()===0);
 count++; // Back/Forward clears token and candidate snapshot

 for(const code of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
   await page.locator('#site-locale').selectOption(code);
   await expectEventually(async()=>await page.locator('html').getAttribute('lang')===code);
   await page.setViewportSize({width:320,height:780});
   const m=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));
   assert.ok(m.s<=m.w+2,'LOCALE_OVERFLOW_'+code);
   await page.locator('#e2-email').focus();
   assert.equal(await page.locator('#e2-email').evaluate(x=>x===document.activeElement),true);
   await page.setViewportSize({width:1280,height:850});
 }
 count++; // 8 locales / 320px / keyboard focus

 const body=await page.locator('body').innerText();
 const html=await page.content();
 const safeStrings=['access_token','refresh_token','Authorization','Bearer ',id.E2_OWNER_PASSWORD,
   id.E2_B_PASSWORD,id.E2_M_PASSWORD,'storageKey','signedUrl'];
 for(const secret of safeStrings){
   assert.ok(!body.includes(secret));
   assert.ok(!html.includes(secret));
 }
 assert.equal(await page.locator('[data-e2-capabilities="all-disabled"]').count(),1);
 assert.equal(await page.locator('[data-e2-projection]').count(),0);
 count++; // No credential and unsafe IDs in browser DOM/visible text

 assert.deepEqual(errors,[]);
 count++; // No uncaught browser exceptions
 await ctx.close();
}finally{await browser.close();}
assert.equal(count,9);
console.log('WEB_SOURCE153_REAL_ES256_BROWSER_9_OF_9_PASS_LOCAL_ONLY');
