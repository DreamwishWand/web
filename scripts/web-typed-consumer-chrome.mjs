// 08 WEB: actual Chromium new-only single Typed EntityRef / Item browse and unavailable detail consumer.
// Synthetic test only: current verified Catalog 1.25.0; no genuine/private P1G.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const bin=process.env.CHROME_BIN;
if(!bin)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.TYPED_CONSUMER_URL||'http://127.0.0.1:4216').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[],network=[];
const pass=name=>console.log('WEB_TYPED_CONSUMER_'+name+'_PASS');
let context;
try{
 context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 const page=await context.newPage();
 context.on('request',req=>{const u=new URL(req.url());if(u.origin!==root||req.method()!=='GET')network.push(req.method()+' '+req.url());});
 page.on('pageerror',e=>errors.push(String(e)));
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of locales){
  await page.goto(root+'/'+locale+'/40000047/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-shared-entity-detail="preview"] h1').waitFor({timeout:30000});
  assert.equal(await page.locator('[data-public-indexable="false"]').count()>0,true);
  assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('data-writer'),'off');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
  assert.ok((await page.locator('[data-entity-identity]').innerText()).includes('52BD625D9B4E0053'));
  await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:30000});
  const related=page.locator('[data-shared-related] a');
  assert.ok(await related.count()>0);
  const href=await related.first().getAttribute('href');
  assert.match(href,new RegExp('^/'+locale+'/[1-9][0-9]*/$'));
  await page.locator('[data-shared-query]').fill('40000047');
  await page.locator('[data-shared-results] a').first().waitFor({timeout:20000});
  assert.equal(await page.locator('[data-shared-results] a').first().getAttribute('href'),'/'+locale+'/40000047/');
 }
 pass('EIGHT_LOCALE_TYPED_ITEM_SOURCE_RELATED_AND_SEARCH');

 for(const type of ['quest','creator','work','preset']){
  const id=type==='quest'?'12345':type+'-source-not-confirmed';
  await page.goto(root+'/ja/entity/'+type+'/'+id+'/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-typed-entity-gate="closed"]').waitFor({timeout:15000});
  assert.equal(await page.locator('[data-typed-entity-gate]').getAttribute('data-entity-id-contract'),'wand.shared-entity.identity@1');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
  assert.equal(await page.locator('[data-personal-state="unknown"][data-public-indexable="false"][data-writer="off"]').count(),1);
  assert.equal(await page.locator('link[rel="canonical"]').count(),0);
 }
 pass('UNVERIFIED_FOUR_KINDS_SINGLE_TYPE_CONTRACT_NOINDEX');

 await page.goto(root+'/ja/40000047/900001/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-entity-gate="closed"]').waitFor();
 assert.equal(await page.locator('link[rel="canonical"]').count(),0);
 assert.equal(await page.locator('[data-typed-unavailable]').count(),1);
 await page.goto(root+'/ja/entity/quest/00123/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-unavailable]').waitFor();
 assert.ok((await page.locator('[data-typed-unavailable]').innerText()).includes('不正'));
 pass('UNVERIFIED_SPECIALIZATION_AND_MALFORMED_ID_DENIED');

 await page.setViewportSize({width:320,height:830});
 await page.goto(root+'/ja/entity/quest/12345/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-entity-gate="closed"]').waitFor();
 const fit=async where=>{
  const x=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
  assert.ok(x.s<=x.w+2,where+': '+JSON.stringify(x));
 };
 await fit('mobile320');
 await page.locator('[data-typed-entity-gate] nav a').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('zoom200');
 pass('MOBILE320_ZOOM200_KEYBOARD');
 assert.deepEqual(network,[],'no Provider, uploads, private P1G network');
 assert.deepEqual(errors,[],'no browser exceptions');
 pass('NO_UPLOAD_OR_PAGE_ERRORS');
}finally{
 await context?.close();
 await browser.close();
}
console.log('WEB_TYPED_CONSUMER_ACTUAL_CHROMIUM_PASS');
