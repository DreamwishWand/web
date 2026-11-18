import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
assert.ok(process.env.CHROME_BIN,'Installed Chrome is required; never simulate a browser PASS');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,
 headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const base='http://127.0.0.1:4298/web';
try{
 for(const width of [1366,320]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage();const errors=[],unauthorized=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{
   if(!r.url().startsWith('http://127.0.0.1:4298/')||r.method()!=='GET')
    unauthorized.push(r.method()+':'+r.url());
  });
  try{
   await page.goto(base+'/editor/bamboo/steam/read/?reader=true&writer=true&build=Steam626',
    {waitUntil:'domcontentloaded',timeout:30000});
   const surface=page.locator('[data-bamboo-consumer="protected-readonly"]');
   await surface.waitFor({state:'visible',timeout:30000});
   await page.waitForTimeout(800); // give the sealed-worker bootstrap a real browser turn
   assert.equal(await surface.getAttribute('data-bamboo-runtime'),'off');
   assert.equal(await surface.getAttribute('data-bamboo-writer-authorized'),'false');
   assert.equal(await surface.getAttribute('data-bamboo-operation-on'),'false');
   assert.equal(await surface.getAttribute('data-bamboo-item-id'),'40700007');
   assert.equal(await surface.locator('[data-bamboo-gate="closed"]').count(),1);
   assert.equal(await surface.locator('[data-bamboo-gate="signed"]').count(),0);
   assert.equal(await surface.locator('input,form,button,textarea,select').count(),0,
    'null protected Bamboo anchor must never expose File or Read');
   const fields=surface.locator('[data-bamboo-receipt-field]');
   assert.equal(await fields.count(),4);
   for(let i=0;i<4;i++)assert.equal((await fields.nth(i).locator('output').innerText()).trim(),'—');
   assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
   if(width===320){
    await page.setViewportSize({width:640,height:900});
    await page.evaluate(()=>document.documentElement.style.zoom='2');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),
    true,'No horizontal overflow at mobile/200%');
   await page.goto(base+'/editor/bamboo/steam/',{waitUntil:'domcontentloaded'});
   const old=page.locator('[data-bamboo-reader-ui="scoped-preparation"]');
   await old.waitFor({state:'visible',timeout:30000});
   assert.equal(await old.getAttribute('data-bamboo-runtime'),'off',
    'Existing signed TEST/OFF route must remain unchanged');
   assert.equal(await old.locator('input,form,button').count(),0);
   assert.deepEqual(unauthorized,[],'No private POST, Cloud or external request');
   assert.deepEqual(errors,[],'No script errors');
   console.log('08WEB_BAMBOO_SIGNED_GATE_FAILCLOSED_NO_FILE_CHROME_'+width+'_PASS');
  }finally{await page.close();await context.close()}
 }
 console.log('08WEB_BAMBOO_PROTECTED_CONSUMER_OFF_TWO_VIEWPORT_PUBLIC_SAFETY_PASS');
}finally{await browser.close()}
