// 04 QR independent ACTUAL Chromium PR399, new UI-only unverified Entity gate.
// No authoritative PR396 import, no real private Save, no managed HTTP SEO claim.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const executablePath=process.env.CHROME_BIN;
assert.ok(executablePath,'SYSTEM_CHROMIUM_MISSING');
const url='http://127.0.0.1:4204';
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1024,height:830},serviceWorkers:'block'});
const page=await ctx.newPage(),requests=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
ctx.on('request',r=>{
 const u=new URL(r.url());
 if(r.method()!=='GET'||u.origin!==url)requests.push(r.method()+' '+u.href);
});
const mark=s=>console.log('QR_399_'+s+'_PASS');
async function closed(path){
 const response=await page.goto(url+path,{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-entity-gate="closed"]').waitFor({timeout:20000});
 const gate=page.locator('[data-typed-entity-gate]');
 for(const [key,val] of Object.entries({'data-public-indexable':'false','data-writer':'off',
  'data-provider':'off','data-personal-state':'unknown','data-relations-verified':'false',
  'data-alias-resolved':'false'}))assert.equal(await gate.getAttribute(key),val);
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('link[rel=canonical]').count(),0);
 assert.equal(await page.locator('a[rel=alternate][hreflang]').count(),0);
 assert.equal(await page.locator('img').count(),0);
 assert.equal(await page.locator('[data-typed-unavailable]').count(),1);
 assert.equal(await page.locator('[data-shared-card]').count(),4);
 return response?.status();
}
try {
 const locales=['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'];
 for(const lang of locales){
  await closed('/'+lang+'/entity/quest/12345/');
  assert.equal(await page.locator('[data-typed-entity-gate]').getAttribute('lang'),lang);
  assert.equal(await page.locator('[data-shared-card="version"]').count(),1);
  assert.equal(await page.locator('[data-shared-card="relations"]').count(),1);
  assert.equal(await page.locator('[data-shared-card="visibility"]').count(),1);
 }
 mark('EIGHT_LOCALES_UNVERIFIED_TYPED_DETAIL_PRIVACY_NO_CANONICAL');
 for(const type of ['creator','work','preset']){
  await closed('/ja/entity/'+type+'/synthetic-uuid-value/');
  assert.equal(await page.locator('[data-shared-card="identity"] code').count(),1);
  assert.equal(await page.locator('[data-shared-card="visibility"]').count(),1);
 }
 mark('THREE_COMMUNITY_KINDS_NO_FAKE_CREATOR_WORK_PRESET');
 await closed('/en/entity/unknown/12345/');
 assert.equal(await page.locator('[data-shared-card="identity"] code').count(),0);
 await closed('/en/entity/item/0001/');
 assert.equal(await page.locator('[data-shared-card="identity"] code').count(),0);
 mark('INVALID_KIND_AND_ID_HIDE_ID');
 for(const path of ['/ja/40000047/12345/','/40000047/12345/']){
  await closed(path);
  assert.equal(await page.locator('[data-shared-card="identity"] code').count(),1);
  assert.equal(await page.locator('link[rel=canonical]').count(),0);
 }
 mark('COMPOSITE_P_S_HAS_NO_PUBLIC_ALIAS_AUTHORITY');
 await page.setViewportSize({width:320,height:740});
 await closed('/ja/entity/quest/12345/');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2));
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2));
 mark('320_CSS_ZOOM200_NO_HORIZONTAL_OVERFLOW');
 assert.deepEqual(requests,[],'source-only gate must never send unauthorized writes or provider request');
 assert.deepEqual(errors,[]);
 mark('NO_SERVER_WRITES_PROVIDER_OR_JS_EXCEPTIONS');
 console.log('QR_399_INDEPENDENT_ACTUAL_CHROMIUM_LOCAL_BOUNDARY_TARGETED_PASS');
} finally {await ctx.close();await browser.close();}
