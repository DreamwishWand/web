import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { itemCapabilityCopy } from '../src/lib/local/item-capability-copy.mjs';
const root='http://127.0.0.1:4202';
if(!process.env.CHROME_BIN)throw Error('QR444_SYSTEM_CHROME_REQUIRED');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[],bad=[],passes=[];
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!==root||route.request().method()!=='GET'){
    bad.push({origin:u.origin,method:route.request().method()});return route.abort('blockedbyclient');
  }
  return route.continue();
 });
 await page.goto(root+'/editor/items/',{waitUntil:'networkidle'});
 const cap=page.locator('.local-capability');
 await cap.waitFor({timeout:30000});
 assert.equal(await cap.getAttribute('data-owned'),'unknown');
 assert.equal(await cap.getAttribute('data-writer'),'off');
 assert.equal(await cap.getAttribute('data-item-edited-copy'),'off');
 assert.equal(await cap.getAttribute('data-item-read-available'),'false');
 await page.locator('[data-shared-discovery="READY"]').waitFor({timeout:30000});
 await page.locator('[data-shared-query]').fill('40000047');
 await page.locator('[data-shared-results] a').first().waitFor({timeout:15000});
 passes.push('ITEM_CATALOG_TYPED_SEARCH_PERSONAL_UNKNOWN_WRITER_OFF');
 for(const lang of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  await page.evaluate(code=>localStorage.setItem('dreamwishwand-locale-manual-v1',code),lang);
  await page.reload({waitUntil:'domcontentloaded'});
  await cap.waitFor({timeout:20000});
  await page.waitForFunction(({text})=>document.querySelector('.local-capability h2')?.textContent===text,{text:itemCapabilityCopy(lang).title},{timeout:20000});
  assert.equal(await cap.getAttribute('data-owned'),'unknown');
  assert.ok((await cap.innerText()).includes(itemCapabilityCopy(lang).unknown),lang);
 }
 passes.push('EIGHT_LOCALES_NO_INVENTED_PERSONAL_OWNED');
 await page.setViewportSize({width:320,height:850});
 await page.reload({waitUntil:'domcontentloaded'});
 await cap.waitFor();
 let size=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 assert.ok(size[0]<=size[1]+2,'320px '+JSON.stringify(size));
 await cap.locator('nav a').first().focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A');
 passes.push('MOBILE_320_KEYBOARD_ACCESSIBLE');
 await cap.locator('a[href$="/editor/timing/"]').click();
 await page.locator('[data-timing-readonly="true"]').waitFor({timeout:20000});
 assert.equal(await page.locator('[data-w1-original-backup]').count(),0);
 await page.goBack({waitUntil:'domcontentloaded'});
 await cap.waitFor();
 assert.equal(await cap.getAttribute('data-owned'),'unknown');
 passes.push('ITEM_TO_W1_BACK_NO_FAKE_READ_OR_BACKUP');
 await access(join('build','404.html'));
 try{
  await access(join('build','ja','40000047','index.html'));
  throw Error('UNAPPROVED_STATIC_ITEM_PUBLISHED');
 }catch(e){if(e.code!=='ENOENT')throw e;}
 passes.push('NO_UNREVIEWED_PRERENDERED_ITEM_HTML');
 assert.deepEqual(errors,[]);
 assert.deepEqual(bad,[]);
 passes.push('ZERO_EXTERNAL_HTTP_POST_OR_JS_ERROR');
 await ctx.close();
}finally{await browser.close();}
console.log(JSON.stringify({evidence:'INDEPENDENT_REAL_CHROMIUM_SYNTHETIC_HOST_ITEM_CURRENT_MAIN_NOT_GENUINE',passes,status:'PASS'}));
