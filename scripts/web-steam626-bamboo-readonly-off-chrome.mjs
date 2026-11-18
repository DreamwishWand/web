import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

assert.ok(process.env.CHROME_BIN,'Installed Chrome required for actual route validation');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 for(const width of [1366,320]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
  const unauthorized=[];
  page.on('request',req=>{if(!req.url().startsWith('http://127.0.0.1:4298/'))unauthorized.push(req.url());});
  try{
   await page.goto('http://127.0.0.1:4298/web/editor/bamboo/steam/?bambooReaderAuthorized=true&writer=true',{waitUntil:'domcontentloaded',timeout:30000});
   const section=page.locator('[data-bamboo-reader-ui="scoped-preparation"]');
   await section.waitFor({state:'visible',timeout:30000});
   for(const [key,value] of Object.entries({
    'data-bamboo-runtime':'off',
    'data-bamboo-writer-authorized':'false',
    'data-bamboo-source-file-enabled':'false',
    'data-bamboo-operation-on':'false',
    'data-bamboo-item-id':'40700007',
    'data-bamboo-schema':'626',
    'data-bamboo-signed-feature-available':'false'
   }))assert.equal(await section.getAttribute(key),value,key);
   assert.equal(await section.locator('input,button,form,textarea,select').count(),0,'no false game-save File or Stage controls');
   const slots=section.locator('[data-bamboo-receipt-field]');
   assert.equal(await slots.count(),4);
   for(let i=0;i<4;i++)assert.equal((await slots.nth(i).locator('output').innerText()).trim(),'—');
   assert.ok((await section.locator('[data-bamboo-readiness="off"]').innerText()).trim().length>12);
   const link=section.locator('a[href$="/editor/"]').first();
   assert.equal(await link.count(),1);
   await link.focus();assert.equal(await link.evaluate(el=>el===document.activeElement),true,'keyboard return to Editor');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no horizontal overflow');
   await page.evaluate(()=>localStorage.setItem('wand:bamboo:feature',{signedScopedReaderAvailable:true,writerAuthorized:true}.toString()));
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('[data-bamboo-runtime]').getAttribute('data-bamboo-runtime'),'off','localStorage/query cannot create signed Reader');
   if(width===320){
    await page.setViewportSize({width:640,height:900});
    await page.evaluate(()=>{document.documentElement.style.zoom='2'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no 200% zoom clipping');
    assert.equal(await page.locator('[data-bamboo-operation-on]').getAttribute('data-bamboo-operation-on'),'false');
   }
   assert.deepEqual(unauthorized,[],'no remote Save or account/network request');
   console.log('08WEB_BAMBOO_STEAM626_READONLY_OFF_2VIEWPORT_CHROME_PASS_'+width);
  }finally{await page.close();await ctx.close();}
 }
 assert.deepEqual(errors,[]);
 console.log('08WEB_BAMBOO_NO_PRIVATE_FILE_OR_FORGED_READER_UI_PASS');
}finally{await browser.close();}
