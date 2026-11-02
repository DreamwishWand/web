import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

// Actual local Chromium /manage route. Intercepted SYNTHETIC Community Auth
// responses only. No real GoTrue, Source153, operator, CDN, Provider or Writer.
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const origin='http://127.0.0.1:4175';
const workA='11111111-1111-4111-8111-111111111111';
const workB='22222222-2222-4222-8222-222222222222';
const actorA='33333333-3333-4333-8333-333333333333';
const actorB='44444444-4444-4444-8444-444444444444';
const observed=[],logins=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 await page.route('https://auth.example.invalid/**',async route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{
   'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST',
   'Access-Control-Allow-Headers':'apikey,authorization,content-type'}});
  if(req.url().includes('/auth/v1/token?grant_type=password')){
   const identity=JSON.parse(req.postData()||'{}').email==='B@example.invalid'?'B':'A';
   logins.push(identity);
   return route.fulfill({status:200,headers:{
    'Access-Control-Allow-Origin':'*','content-type':'application/json'},
    body:JSON.stringify({
     access_token:'synthetic-bearer-'+identity,
     refresh_token:'synthetic-refresh-'+identity,expires_in:3600,
     user:{id:identity==='A'?actorA:actorB,email:identity+'@example.invalid'}
    })});
  }
  if(req.url().includes('/auth/v1/logout'))
   return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}});
  observed.push('UNEXPECTED_AUTH_ENDPOINT');
  return route.fulfill({status:401,headers:{'Access-Control-Allow-Origin':'*'}});
 });
 page.on('request',r=>{
  if(r.url().includes('/functions/v1/community-dreamsnap-owner'))
   observed.push('UNEXPECTED_OWNER_HTTP');
 });
 const url=origin+'/dreamsnaps/my/manage/?work='+workA;
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('[data-owner-state="authentication-required"]').waitFor();
 assert.equal(await page.locator('[data-owner-session-relogin]').count(),1);
 const getCommunity=()=>page.evaluate(async()=>{
  const m=await import('/src/lib/community/browser-client.ts');
  return Boolean(m.createCommunityBrowserClient()?.session);
 });
 assert.equal(await getCommunity(),false);
 // First interactive A, then all Storage writes fail at Logout, leaving A
 // persisted in v2. This must NOT allow A to reappear on a cold page.
 await page.evaluate(async()=>{
  const m=await import('/src/lib/community/browser-client.ts');
  await m.createCommunityBrowserClient().signInWithPassword('A@example.invalid','local-synthetic');
 });
 await page.locator('[data-owner-state="backend-unavailable"]').waitFor();
 const stalePresent=await page.evaluate(()=>{
  const key=Object.keys(sessionStorage).find(k=>k.startsWith('dreamwishwand-community-session-v2:'));
  const value=key?sessionStorage.getItem(key):null;
  return Boolean(value?.includes('synthetic-bearer-A'));
 });
 assert.equal(stalePresent,true,'A must be persisted before denied logout');
 await page.evaluate(async()=>{
  Storage.prototype.setItem=function(){throw new DOMException('Denied','SecurityError');};
  Storage.prototype.removeItem=function(){throw new DOMException('Denied','SecurityError');};
  const m=await import('/src/lib/community/browser-client.ts');
  await m.createCommunityBrowserClient().signOut();
 });
 await page.locator('[data-owner-state="authentication-required"]').waitFor();
 assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>
  k.startsWith('dreamwishwand-community-session-v2:') &&
  sessionStorage.getItem(k)?.includes('synthetic-bearer-A'))),true);
 assert.equal(await page.locator('[data-owner-product-projection]').count(),0);
 // Reload resets deliberately faulted JS methods. Recover all writes before
 // new module evaluation: old A bytes remain but cold import MUST be unsigned.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-owner-state="authentication-required"]').waitFor();
 assert.equal(await getCommunity(),false);
 assert.equal(await page.locator('[data-owner-session-relogin]').count(),1);
 assert.equal(await page.locator('[data-owner-product-projection]').count(),0);
 assert.equal(observed.length,0);
 // Fresh interactive B alone may establish a new signed Session candidate.
 await page.evaluate(async()=>{
  const m=await import('/src/lib/community/browser-client.ts');
  await m.createCommunityBrowserClient().signInWithPassword('B@example.invalid','local-synthetic');
 });
 await page.locator('[data-owner-state="backend-unavailable"]').waitFor();
 assert.equal(await page.evaluate(async()=>{
  const m=await import('/src/lib/community/browser-client.ts');
  return m.createCommunityBrowserClient()?.session?.userId;
 }),actorB);
 assert.deepEqual(logins,['A','B']);
 assert.equal(await page.locator('[data-owner-product-read="disabled"]').count(),1);
 assert.equal(await page.locator('[data-owner-product-projection]').count(),0);
 assert.equal(await page.locator('[data-owner-action="image-grant"]').isDisabled(),true);
 assert.equal(await page.locator('[data-owner-action="request-delete"]').isDisabled(),true);
 assert.equal(observed.length,0);
 // Explicit B logout: tokenless subscribed transition must update the route.
 await page.evaluate(async()=>{
  const m=await import('/src/lib/community/browser-client.ts');
  await m.createCommunityBrowserClient().signOut();
 });
 await page.locator('[data-owner-state="authentication-required"]').waitFor();
 assert.equal(await getCommunity(),false);
 // New Work path after a cold navigation MUST also stay unauthenticated.
 await page.goto(origin+'/dreamsnaps/my/manage/?work='+workB,{waitUntil:'domcontentloaded'});
 await page.locator('[data-owner-state="authentication-required"]').waitFor();
 assert.equal(await getCommunity(),false);
 assert.equal(await page.locator('[data-owner-product-projection]').count(),0);
 const html=await page.locator('body').innerText();
 for(const token of ['synthetic-bearer-A','synthetic-refresh-A',
  'synthetic-bearer-B','synthetic-refresh-B'])assert.equal(html.includes(token),false);
 await page.goto(origin+'/dreamsnaps/my/manage/?work=invalid',{waitUntil:'domcontentloaded'});
 await page.locator('[data-owner-state="invalid-url"]').waitFor();
 assert.equal(observed.length,0);
 await context.close();
 console.log('WEB_OWNER_RECOVERED_STORAGE_COLD_A_DENIED_FRESH_B_ONLY_LOCAL_CHROME_PASS');
 console.log('WEB_OWNER_SHARED_SESSION_REAL_ROUTE_OFF_CHROME_PASS_LOCAL');
}finally{await browser.close();}
