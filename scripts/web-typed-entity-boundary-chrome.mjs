// 08 WEB: real Chromium SOURCE_ONLY/NO PRIVATE SAVE evidence for typed page boundary.
// A test-only unverified route is intentionally not an indexed public Creator/Work/Preset detail.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { readFile, access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { sharedTypedCopy } from '../src/lib/foundation/shared-typed-entity-copy.mjs';

const BIN=process.env.CHROME_BIN;
if (!BIN) throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.SHARED_TYPED_E2E_URL||'http://127.0.0.1:4198').replace(/\/$/,'');
const build=process.env.SHARED_TYPED_STATIC_BUILD||'build';
const browser=await chromium.launch({executablePath:BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const checks=[],requests=[],errors=[];
const pass=n=>{checks.push(n);console.log('WEB_TYPED_'+n+'_PASS');};
let ctx=null;
let server=null;
try {
 ctx=await browser.newContext({viewport:{width:1280,height:860},serviceWorkers:'block'});
 const page=await ctx.newPage();
 ctx.on('request',req=>{
   const uri=new URL(req.url());
   if(uri.origin!==root||req.method()!=='GET')requests.push({method:req.method(),path:uri.pathname,external:uri.origin!==root});
 });
 page.on('pageerror',e=>errors.push(String(e)));
 const localeCodes=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const lang of localeCodes){
   await page.goto(root+'/'+lang+'/entity/quest/12345/',{waitUntil:'domcontentloaded'});
   await page.locator('[data-typed-entity-gate="closed"]').waitFor({timeout:15000});
   assert.equal(await page.locator('[data-typed-entity-gate]').getAttribute('lang'),lang);
   assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
   assert.ok((await page.locator('h1').innerText()).includes(sharedTypedCopy(lang).unavailable));
   assert.ok((await page.locator('[data-typed-unavailable]').innerText()).includes(sharedTypedCopy(lang).notVerified));
   assert.equal(await page.locator('[data-relations-verified="false"]').count(),1);
   assert.equal(await page.locator('[data-public-indexable="false"][data-writer="off"][data-provider="off"]').count(),1);
   assert.equal(await page.locator('[data-shared-card="version"]').innerText().then(x=>x.includes(sharedTypedCopy(lang).noSource)),true);
   assert.equal(await page.locator('[data-shared-card="relations"]').innerText().then(x=>x.includes(sharedTypedCopy(lang).noRelations)),true);
 }
 pass('ALL_EIGHT_TYPED_QUEST_DETAIL_LOCALES_FAILCLOSED');

 for (const kind of ['creator','work','preset']){
  await page.goto(root+'/ja/entity/'+kind+'/owner-provided-id/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-typed-entity-gate="closed"]').waitFor();
  assert.ok((await page.locator('h1').innerText()).includes('検証済み詳細は利用不可'));
  assert.equal(await page.locator('[data-personal-state="unknown"]').count(),1);
  assert.equal(await page.locator('[data-alias-resolved="false"]').count(),1);
  assert.equal(await page.locator('[data-public-indexable="false"]').count(),1);
  assert.equal(await page.locator('img').count(),0);
 }
 pass('CREATOR_WORK_PRESET_NO_PRIVATE_IDENTITY_OR_MEDIA');

 await page.goto(root+'/en/entity/entry/12345/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-unavailable]').waitFor();
 assert.ok((await page.locator('[data-typed-unavailable]').innerText()).includes(sharedTypedCopy('en').invalid));
 assert.equal(await page.locator('[data-shared-card="identity"] code').count(),0);
 await page.goto(root+'/en/entity/quest/0001/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-unavailable]').waitFor();
 assert.ok((await page.locator('[data-typed-unavailable]').innerText()).includes(sharedTypedCopy('en').invalid));
 assert.equal(await page.locator('[data-shared-card="identity"] code').count(),0);
 pass('INVALID_KIND_AND_LEADING_ZERO_ID_WITHHELD');

 await page.goto(root+'/ja/40000047/12345/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-entity-gate="closed"]').waitFor();
 assert.ok((await page.locator('[data-typed-unavailable]').innerText()).includes(sharedTypedCopy('ja').notVerified));
 assert.equal(await page.locator('[data-shared-card="relations"]').count(),1);
 assert.equal(await page.locator('link[rel="canonical"]').count(),0);
 await page.goto(root+'/40000047/12345/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-entity-gate="closed"]').waitFor();
 assert.equal(await page.locator('link[rel="canonical"]').count(),0);
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 pass('UNVERIFIED_PRIMARY_SECONDARY_NO_ALIAS_REDIRECT_OR_CANONICAL');

 // P=S must no longer be displayed as an invalid syntax, but is never a
 // verified Native specialization or a public/indexable/owned record.
 for(const lang of localeCodes) {
   await page.goto(root+'/'+lang+'/40000047/40000047/',{waitUntil:'domcontentloaded'});
   await page.locator('[data-typed-entity-gate="closed"]').waitFor();
   assert.ok((await page.locator('[data-typed-unavailable]').innerText())
     .includes(sharedTypedCopy(lang).notVerified),lang+' equal P/S syntax-only');
   assert.equal(await page.locator('[data-shared-card="identity"] code').innerText(),'40000047/40000047');
   assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
   assert.equal(await page.locator('link[rel="canonical"]').count(),0);
   assert.equal(await page.locator('[data-relations-verified="false"][data-alias-resolved="false"][data-writer="off"]').count(),1);
 }
 pass('EQUAL_PS_EIGHT_LOCALE_SYNTAX_ONLY_UNVERIFIED_NO_PUBLIC_GRANT');
 const forged=await page.goto(root+'/en/0001/0001/',{waitUntil:'domcontentloaded'});
 // sharedId route matcher rejects leading zero *before* the gate can render.
 assert.equal(forged?.status(),404);
 assert.equal(await page.locator('[data-typed-entity-gate]').count(),0);
 pass('FORGED_EQUAL_PS_LEADING_ZERO_ROUTE_404_DENIED');

 await page.setViewportSize({width:320,height:800});
 await page.goto(root+'/ja/entity/quest/12345/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-typed-entity-gate="closed"]').waitFor();
 const fit=async label=>{
  const w=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(w.scroll<=w.client+2,label+': '+JSON.stringify(w));
 };
 await fit('320px');
 await page.locator('[data-typed-entity-gate] nav a').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A');
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('200zoom');
 pass('MOBILE320_ZOOM200_KEYBOARD_FOCUS');

 // GitHub Pages uses adapter-static fallback and MUST NOT equate this page's
 // Vite SSR route with real hosted public HTTP 200 or an accepted 301 redirect.
 await access(join(build,'404.html'));
 try{
  await access(join(build,'ja','entity','quest','12345','index.html'));
  throw Error('UNEXPECTED_PUBLISHED_UNVERIFIED_DETAIL_HTML');
 }catch(e){if(e.code!=='ENOENT')throw e;}
 server=createServer(async(req,res)=>{
  if(req.url?.startsWith('/ja/entity/quest/12345/')){
    res.writeHead(404,{'content-type':'text/html; charset=utf-8'});
    res.end(await readFile(join(build,'404.html')));
  } else {res.writeHead(404);res.end();}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const testResp=await fetch('http://127.0.0.1:'+server.address().port+'/ja/entity/quest/12345/');
 assert.equal(testResp.status,404);
 pass('STATIC_FALLBACK_HTTP404_NOT_PUBLIC_HTTP200');
 assert.deepEqual(requests,[],'no Provider, POST, external media or user Save upload');
 assert.deepEqual(errors,[],'no unhandled browser exception');
 pass('NO_EXTERNAL_UPLOAD_OR_JS_ERRORS');
} finally {
 if(server) await new Promise(ok=>server.close(ok));
 await ctx?.close();
 await browser.close();
}
console.log('WEB_TYPED_ENTITY_ACTUAL_CHROMIUM_PASS');
