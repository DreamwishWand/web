import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const origin='http://127.0.0.1:4175';
const work='11111111-1111-4111-8111-111111111111';
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await ctx.newPage();
 const ownerRequests=[];
 page.on('request',r=>{if(r.url().includes('/functions/v1/community-dreamsnap-owner'))ownerRequests.push(1);});
 const r=await page.goto(origin+'/dreamsnaps/my/manage/?work='+work,{waitUntil:'domcontentloaded'});
 assert.equal(r?.status(),200);
 await page.locator('[data-owner-management="private-preview"]').waitFor();
 assert.equal(await page.locator('[data-owner-product-projection]').count(),0);
 assert.equal(await page.locator('[data-owner-action="image-grant"]').isDisabled(),true);
 assert.equal(await page.locator('[data-owner-action="request-delete"]').isDisabled(),true);
 await page.goto(origin+'/dreamsnaps/my/manage/?work=invalid',{waitUntil:'domcontentloaded'});
 await page.locator('[data-owner-state="invalid-url"]').waitFor();
 await page.goto(origin+'/dreamsnaps/my/manage/',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('[data-owner-product-projection]').count(),0);
 assert.equal(ownerRequests.length,0);
 await ctx.close();
 console.log('WEB_OWNER_REAL_PRODUCT_OFF_CHROME_PASS_LOCAL');
}finally{await browser.close();}
