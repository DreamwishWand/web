import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const root='http://127.0.0.1:4218';
const executablePath=process.env.CHROME_BIN;
assert.ok(executablePath,'SYSTEM_CHROMIUM_REQUIRED');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
const page=await context.newPage(),errors=[],external=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',r=>{
 const u=new URL(r.url());
 if(u.origin!==root||r.method()!=='GET')external.push(r.method()+' '+u.origin);
});
const mark=s=>console.log('QR446_'+s+'_PASS');
try{
 for(const locale of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  await page.goto(root+'/'+locale+'/40000047/',{waitUntil:'networkidle'});
  await page.locator('[data-shared-entity-detail="preview"]').waitFor({timeout:20000});
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
  assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('data-writer'),'off');
  assert.equal(await page.locator('[data-public-indexable="false"]').count()>0,true);
  await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:20000});
  await page.locator('[data-shared-query]').fill('40000047');
  await page.locator('[data-shared-results] a').first().waitFor({timeout:20000});
  const href=await page.locator('[data-shared-results] a').first().getAttribute('href');
  assert.equal(href,'/'+locale+'/40000047/');
 }
 mark('ACTUAL_CHROMIUM_EIGHT_LOCALE_ITEM_ONE_NATIVE_TYPED_LINK_NOINDEX');
 for(const type of ['quest','creator','work','preset']){
  const id=type==='quest'?'12345':type+'-unknown';
  await page.goto(root+'/ja/entity/'+type+'/'+id+'/',{waitUntil:'domcontentloaded'});
  const gate=page.locator('[data-typed-entity-gate="closed"]');
  await gate.waitFor({timeout:20000});
  assert.equal(await gate.getAttribute('data-public-indexable'),'false');
  assert.equal(await gate.getAttribute('data-writer'),'off');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
  assert.equal(await page.locator('link[rel="canonical"]').count(),0);
 }
 mark('ACTUAL_CHROMIUM_FOUR_UNVERIFIED_ENTITY_TYPES_NOINDEX_NO_CANONICAL');
 await page.setViewportSize({width:320,height:780});
 await page.goto(root+'/ja/entity/quest/12345/',{waitUntil:'domcontentloaded'});
 const gate=page.locator('[data-typed-entity-gate="closed"]');
 await gate.waitFor({timeout:20000});
 let measure=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(measure.scroll<=measure.client+2,JSON.stringify(measure));
 await gate.locator('nav a').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A');
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 measure=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(measure.scroll<=measure.client+2,JSON.stringify(measure));
 mark('ACTUAL_CHROMIUM_320_200_KEYBOARD_ACCESS');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 mark('ACTUAL_CHROMIUM_NO_EXTERNAL_UPLOAD_OR_JS_EXCEPTION');
 console.log('QR446_INDEPENDENT_ACTUAL_CHROMIUM_TYPED_ITEM_8LOCALE_SCOPED_PASS');
}finally{await context.close();await browser.close();}
