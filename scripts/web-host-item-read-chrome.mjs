// User-visible READ-only inventory evidence. Real Chrome (no genuine P1G).
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { itemCapabilityCopy } from '../src/lib/local/item-capability-copy.mjs';
const BIN=process.env.CHROME_BIN;
if(!BIN)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.ITEM_GATE_E2E_URL||'http://127.0.0.1:4202').replace(/\/$/,'');
const build=process.env.ITEM_GATE_STATIC_BUILD||'build';
const browser=await chromium.launch({executablePath:BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const pass=n=>console.log('WEB_HOST_ITEM_'+n+'_PASS');
const errors=[],forbidden=[];
let context,server;
try{
 context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 context.on('request',request=>{
  const url=new URL(request.url());
  if(url.origin!==root || request.method()!=='GET')forbidden.push({url:url.origin,method:request.method()});
 });
 await page.goto(root+'/editor/items/',{waitUntil:'networkidle'});
 const gate=page.locator('.local-capability');
 await gate.waitFor({timeout:30000});
 assert.equal(await gate.getAttribute('data-owned'),'unknown');
 assert.equal(await gate.getAttribute('data-item-read-available'),'false');
 assert.equal(await gate.getAttribute('data-writer'),'off');
 assert.equal(await gate.getAttribute('data-item-edited-copy'),'off');
 assert.equal(await gate.getAttribute('data-item-original-backup'),'off');
 assert.equal(await page.locator('[data-editor-item-surface]').getAttribute('data-owned'),'unknown');
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:40000});
 await page.locator('[data-shared-query]').fill('40000047');
 await page.locator('[data-shared-results] a').first().waitFor({timeout:20000});
 assert.match(await page.locator('[data-shared-results]').innerText(),/40000047/);
 pass('CATALOG_PRESERVED_PERSONAL_UNKNOWN_WRITER_OFF');

 const locales=['en','ja','fr','it','de','es-ES','zh-CN','pt-BR'];
 for(const locale of locales){
  await page.evaluate(x=>localStorage.setItem('dreamwishwand-locale-manual-v1',x),locale);
  await page.reload({waitUntil:'domcontentloaded'});
  await gate.waitFor({timeout:25000});
  await page.waitForFunction(({text})=>document.querySelector('.local-capability h2')?.textContent===text,
   {text:itemCapabilityCopy(locale).title},{timeout:20000});
  const body=await gate.innerText();
  assert.ok(body.includes(itemCapabilityCopy(locale).unknown),locale);
  assert.ok(body.includes(itemCapabilityCopy(locale).noUpload),locale);
  assert.equal(await gate.getAttribute('data-owned'),'unknown');
  assert.equal(await gate.locator('a[href$="/editor/timing/"]').count(),1);
  assert.equal(await gate.locator('a[href$="/presets/"]').count(),1);
 }
 pass('EIGHT_LOCALE_INVENTORY_UNKNOWN_AND_REAL_W1_PRESET_NAV');

 await page.setViewportSize({width:320,height:850});
 await page.reload({waitUntil:'domcontentloaded'});
 await gate.waitFor();
 let size=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.w+2,'320 '+JSON.stringify(size));
 await gate.locator('nav a').first().focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A');
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 size=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.w+2,'zoom200 '+JSON.stringify(size));
 pass('MOBILE_320_ZOOM200_KEYBOARD');

 // Actual cross-product navigation: no private value or session claimed.
 await gate.locator('nav a[href$="/editor/timing/"]').click();
 await page.locator('[data-timing-readonly="true"]').waitFor({timeout:20000});
 assert.equal(await page.locator('[data-writer="off"]').count()>0,true);
 assert.equal(await page.locator('[data-w1-original-backup]').count(),0,'no original without file');
 await page.goBack({waitUntil:'domcontentloaded'});
 await page.locator('.local-capability').waitFor();
 assert.equal(await page.locator('.local-capability').getAttribute('data-owned'),'unknown');
 pass('INVENTORY_TO_W1_AND_BACK_NO_FAKE_PERSONAL_READ');

 await access(join(build,'404.html'));
 try{await access(join(build,'ja','40000047','index.html'));throw Error('UNEXPECTED_ITEM_STATIC_PUBLIC_HTML');}
 catch(e){if(e.code!=='ENOENT')throw e;}
 server=createServer(async(req,res)=>{
  if(req.url==='/web/ja/40000047/'){
   res.writeHead(404,{'content-type':'text/html; charset=utf-8'});
   res.end(await readFile(join(build,'404.html')));
  }else{res.writeHead(404);res.end();}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/web/ja/40000047/');
 assert.equal(response.status,404);
 pass('STATIC_DIRECT_ITEM_FALLBACK_HTTP404_NOT_SEO200');
 assert.deepEqual(errors,[]);
 assert.deepEqual(forbidden,[]);
 pass('NO_EXTERNAL_UPLOAD_OR_BROWSER_EXCEPTION');
}finally{
 if(server)await new Promise(ok=>server.close(ok));
 await context?.close();
 await browser.close();
}
console.log('WEB_HOST_ITEM_ACTUAL_CHROMIUM_PASS');
