import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const path=process.env.DDVRE_SIGNED_BROWSER_FIXTURE;
if(!path||!process.env.CHROME_BIN)throw Error('LOCAL_BROWSER_FIXTURE_OR_CHROME_REQUIRED');
const v=JSON.parse(fs.readFileSync(path,'utf8'));
const url='http://127.0.0.1:4175';
const ownersPath='/functions/v1/community-dreamsnap-owner';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
let checks=0, pageErrors=[], observed=[], urls=[];
let phase='BOOT';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
 const context=await browser.newContext({viewport:{width:1280,height:820}});
 const page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push('PAGE_EXCEPTION'));
 page.on('request',r=>{
   const u=new URL(r.url());
   if(u.hostname==='127.0.0.1'&&u.port==='54321')urls.push(u.pathname);
 });
 page.on('response',r=>{
   const u=new URL(r.url());
   if(u.pathname===ownersPath)observed.push(r.status());
 });
 phase='INITIAL_ANON';
 const initial=await page.goto(url+'/dreamsnaps/my/manage/?work='+v.original,{waitUntil:'domcontentloaded'});
 assert.equal(initial?.status(),200);
 const section=page.locator('[data-local-owner-browser="isolated-only"]');
 await section.waitFor({state:'visible',timeout:18000});
 assert.equal(await page.locator('[data-local-owner-state="source-candidate-only"]').count(),0);
 assert.equal(observed.length,0);
 checks++; // no anonymous owner API request

 const signIn=async actor=>{
   await page.locator('#test-owner-email').fill(v.users[actor].email);
   await page.locator('#test-owner-password').fill(v.users[actor].password);
   await page.locator('[data-local-owner-browser] button[type=submit]').click();
 };
 phase='OWNER_A_LOGIN';
 await signIn('A');
 try {
   await page.locator('[data-local-owner-state="source-candidate-only"]').waitFor({state:'visible',timeout:18000});
 } catch {
   const a=await section.getAttribute('data-local-auth-status')??'UNKNOWN';
   const d=await section.getAttribute('data-local-decoder-status')??'UNKNOWN';
   phase='OWNER_A_LOGIN_'+a.replace(/[^A-Z0-9_]/g,'')+'_'+d.replace(/[^A-Z0-9_]/g,'');
   throw Error('REDACTED_OWNER_A_BROWSER_CANDIDATE_NOT_PRESENT');
 }
 assert.equal(await page.locator('[data-local-owner-kind="OriginalCompetition"]').count(),1);
 assert.equal(await page.locator('[data-local-owner-entry="frozen-entry-present"]').count(),1);
 assert.equal(observed.at(-1),200);
 checks++; // genuine GoTrue session A -> HTTP200 -> unchanged strict decoder -> safe candidate

 const spa=async search=>{
   const full=url+'/dreamsnaps/my/manage/'+search;
   await page.evaluate(href=>{
     const a=document.createElement('a');a.href=href;a.textContent='Dev-only SPA browser probe';
     a.setAttribute('data-local-spa-probe',''); document.body.appendChild(a);
   },full);
   await page.locator('[data-local-spa-probe]').last().click();
   await page.waitForURL(full);
 };
 phase='POST_EVENT_SPA';
 await spa('?work='+v.post);
 await page.locator('[data-local-owner-entry="post-event-no-entry"]').waitFor({state:'visible',timeout:18000});
 assert.equal(await page.locator('[data-local-owner-kind="PostEventCreation"]').count(),1);
 await page.goBack({waitUntil:'domcontentloaded'});
 await page.locator('[data-local-owner-entry="frozen-entry-present"]').waitFor({state:'visible'});
 await page.goForward({waitUntil:'domcontentloaded'});
 await page.locator('[data-local-owner-entry="post-event-no-entry"]').waitFor({state:'visible'});
 checks++; // Original Entry distinct from PostEvent without Entry, SPA back/forward

 phase='INVALID_QUERY';
 const beforeInvalid=observed.length;
 for(const qs of ['?work=bad','?work='+v.original+'&work='+v.original,
       '?work='+v.original+'&tip='+v.original]){
   await spa(qs);
   await page.locator('[data-local-owner-state="invalid"]').waitFor({state:'visible'});
   assert.equal(await page.locator('[data-local-owner-state="source-candidate-only"]').count(),0);
 }
 assert.equal(observed.length,beforeInvalid);
 checks++; // never fetch invalid/duplicate/mixed Work URL

 await spa('?work='+v.original);
 await page.locator('[data-local-owner-entry="frozen-entry-present"]').waitFor({state:'visible'});
 phase='LOCALES_320';
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
   await page.locator('#site-locale').selectOption(loc);
   await page.waitForFunction(l=>document.documentElement.lang===l,loc);
   await page.setViewportSize({width:320,height:760});
   const viewport=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:window.innerWidth}));
   assert.ok(viewport.scroll<=viewport.width+2,loc);
   assert.equal(await page.locator('[data-owner-actions-enabled="false"]').count(),1);
   await page.setViewportSize({width:1280,height:820});
 }
 const focus=page.locator('[data-local-owner-browser] button').first();
 await focus.focus();
 assert.equal(await focus.evaluate(el=>document.activeElement===el),true);
 checks++; // eight locales, mobile, keyboard/A11Y

 phase='REDACTION';
 const visible=await page.locator('[data-local-owner-browser]').innerText();
 const pageText=await page.locator('body').innerText();
 const locationString=page.url();
 const browserStorage=await page.evaluate(()=>JSON.stringify({
   local:Object.entries(localStorage),session:Object.entries(sessionStorage)
 }));
 for(const forbidden of [
   v.users.A.email,v.users.A.password,v.users.A.accessToken??'not-a-token',
   v.users.B.email,v.users.M.email,v.mediaOriginal,v.mediaPost,
   v.accountA??'account-a', 'e1/disposable/'
 ])if(forbidden && forbidden.length>7){
   assert.ok(!visible.includes(forbidden),'SENSITIVE_OWNER_PANEL_TEXT');
   assert.ok(!browserStorage.includes(forbidden),'SENSITIVE_BROWSER_STORAGE');
 }
 assert.ok(!pageText.includes(v.mediaOriginal) && !pageText.includes(v.mediaPost));
 assert.ok(!locationString.includes(v.mediaOriginal));
 assert.ok(urls.every(x=>x==='/auth/v1/token'||x==='/auth/v1/user'||x===ownersPath||
    x.startsWith('/auth/v1/token?')),'UNEXPECTED_BACKEND_CALL');
 checks++; // redaction and no public media/signing/grant/delete network

 await page.locator('[data-local-owner-browser] .actions button').last().click();
 await page.locator('#test-owner-email').waitFor({state:'visible'});
 phase='NON_OWNER_B';
 await signIn('B');
 await page.locator('[data-local-owner-state="unavailable"]').waitFor({state:'visible',timeout:18000});
 assert.equal(await page.locator('[data-local-owner-state="source-candidate-only"]').count(),0);
 assert.ok([401,403,404].includes(observed.at(-1)));
 checks++; // actual ES256 nonowner B denial

 await page.locator('[data-local-owner-browser] .actions button').last().click();
 phase='MODERATOR_M';
 await signIn('M');
 await page.locator('[data-local-owner-state="unavailable"]').waitFor({state:'visible',timeout:18000});
 assert.ok([401,403,404].includes(observed.at(-1)));
 checks++; // registered Moderator M not Owner

 phase='PAGE_ERRORS';
 assert.deepEqual(pageErrors,[]);
 checks++; // no JS exceptions
 await context.close();
} catch(e) {
 console.error('WEB_X05_BROWSER_DIAGNOSTIC_'+phase+'_'+(e?.name??'UNKNOWN'));
 throw Error('REDACTED_CHROMIUM_FAILURE');
} finally {await browser.close();}
assert.equal(checks,9);
console.log('WEB_X05_GENUINE_GOTRUE_ES256_BROWSER_9_OF_9_PASS');
