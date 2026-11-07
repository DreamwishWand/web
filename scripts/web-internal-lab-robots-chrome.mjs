// Source-only local installed Chrome check: noindex is not authorization or a hosted SEO guarantee.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const bin=process.env.CHROME_BIN;
if(!bin)throw Error('CHROME_BIN_REQUIRED');
const origin=(process.env.INTERNAL_LAB_URL||'http://127.0.0.1:4292').replace(/\/$/,'');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1360,height:900},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],untrusted=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',req=>{
 if(req.method()!=='GET'||new URL(req.url()).origin!==origin)untrusted.push(req.method()+' '+req.url());
});
const robots=async()=>{
 const tags=await page.locator('head meta[name="robots"]').evaluateAll(tags=>tags.map(x=>x.getAttribute('content')));
 assert.deepEqual(tags,['noindex,nofollow']);
};
const fit=async label=>{
 const x=await page.evaluate(()=>({view:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.view+2,label+' overflow '+JSON.stringify(x));
};
try{
 const r=await page.goto(origin+'/community-lab/',{waitUntil:'domcontentloaded',timeout:40000});
 assert.equal(r?.status(),200);
 await page.getByRole('heading',{level:1,name:'Community Lab'}).waitFor();
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.locator('html[data-locale="'+locale+'"]').waitFor();
  await robots();
  assert.equal(await page.locator('a[href="profiles/"]').count(),1);
  assert.equal(await page.locator('a[href="account/"]').count(),1);
 }
 console.log('WEB_INTERNAL_LAB_NOINDEX_EIGHT_LOCALE_PASS');
 await page.setViewportSize({width:320,height:800});
 await fit('320px');
 await page.keyboard.press('Tab');
 assert.ok(await page.evaluate(()=>document.activeElement instanceof HTMLElement));
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('200 percent');
 console.log('WEB_INTERNAL_LAB_320_ZOOM200_KEYBOARD_PASS');
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:1360,height:900});
 for(const path of ['profiles/','account/','recovery/']){
  const res=await page.goto(origin+'/community-lab/'+path,{waitUntil:'domcontentloaded',timeout:40000});
  assert.equal(res?.status(),200,'child route '+path);
  await robots();
 }
 const ops=await page.goto(origin+'/community-ops/',{waitUntil:'domcontentloaded'});
 assert.equal(ops?.status(),200);
 await robots();
 console.log('WEB_INTERNAL_LAB_CHILD_OPS_NOINDEX_ROUTES_PRESERVED_PASS');
 assert.deepEqual(errors,[],'browser exceptions');
 assert.deepEqual(untrusted,[],'no off-origin/POST/Provider calls on cold unauthenticated visit');
 console.log('WEB_INTERNAL_LAB_NO_EXTERNAL_POST_OR_ERRORS_PASS');
} finally {await context.close();await browser.close();}
console.log('WEB_INTERNAL_LAB_LOCAL_CHROME_PASS');
