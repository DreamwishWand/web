import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const origin='http://127.0.0.1:4175';
const work='11111111-1111-4111-8111-111111111111';
const user='33333333-3333-4333-8333-333333333333';
const observed=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 await page.route('https://auth.example.invalid/**',async route=>{
  const req=route.request();
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{
    'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST',
    'Access-Control-Allow-Headers':'apikey,authorization,content-type'}});
  if(req.url().includes('/auth/v1/token?grant_type=password'))
   return route.fulfill({status:200,headers:{
    'Access-Control-Allow-Origin':'*','content-type':'application/json'},
    body:JSON.stringify({access_token:'local-synthetic-bearer',
      refresh_token:'local-synthetic-refresh',expires_in:3600,
      user:{id:user,email:'fixture@example.invalid'}})});
  if(req.url().includes('/auth/v1/logout'))
   return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}});
  observed.push('UNEXPECTED_AUTH_ENDPOINT');
  return route.fulfill({status:401,headers:{'Access-Control-Allow-Origin':'*'}});
 });
 page.on('request',r=>{
  if(r.url().includes('/functions/v1/community-dreamsnap-owner'))
   observed.push('UNEXPECTED_OWNER_HTTP');
 });
 await page.goto(origin+'/dreamsnaps/my/manage/?work='+work,{waitUntil:'domcontentloaded'});
 await page.locator('[data-owner-state="authentication-required"]').waitFor();
 await page.evaluate(async()=>{
  const m=await import('/src/lib/community/browser-client.ts');
  await m.createCommunityBrowserClient().signInWithPassword('fixture@example.invalid','fixture-pass-only');
 });
 await page.locator('[data-owner-state="backend-unavailable"]').waitFor();
 assert.equal(await page.locator('[data-owner-product-read="disabled"]').count(),1);
 assert.equal(await page.locator('[data-owner-product-projection]').count(),0);
 assert.equal(await page.locator('[data-owner-action="image-grant"]').isDisabled(),true);
 assert.equal(await page.locator('[data-owner-action="request-delete"]').isDisabled(),true);
 await page.evaluate(async()=>{
  const m=await import('/src/lib/community/browser-client.ts');
  await m.createCommunityBrowserClient().signOut();
 });
 await page.locator('[data-owner-state="authentication-required"]').waitFor();
 assert.equal(await page.locator('[data-owner-product-projection]').count(),0);
 assert.equal(observed.length,0);
 const html=await page.locator('body').innerText();
 assert.equal(html.includes('local-synthetic-bearer'),false);
 assert.equal(html.includes('local-synthetic-refresh'),false);
 await page.goto(origin+'/dreamsnaps/my/manage/?work=invalid',{waitUntil:'domcontentloaded'});
 await page.locator('[data-owner-state="invalid-url"]').waitFor();
 assert.equal(observed.length,0);
 await context.close();
 console.log('WEB_OWNER_SHARED_SESSION_REAL_ROUTE_OFF_CHROME_PASS_LOCAL');
}finally{await browser.close();}
