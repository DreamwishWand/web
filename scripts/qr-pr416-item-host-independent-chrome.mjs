// 04 QR PR416 independent actual system Chromium, local developer host only.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {access} from 'node:fs/promises';
const root='http://127.0.0.1:4208',exe=process.env.CHROME_BIN;
assert.ok(exe);
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
const page=await ctx.newPage(),errors=[],unsafe=[];
page.on('pageerror',e=>errors.push(String(e)));
ctx.on('request',r=>{const u=new URL(r.url());if(u.origin!==root||r.method()!=='GET')unsafe.push(r.method()+' '+u.origin);});
const mark=s=>console.log('QR416_'+s+'_PASS');
try{
 await page.goto(root+'/editor/items/',{waitUntil:'networkidle'});
 const section=page.locator('.local-capability');
 await section.waitFor({timeout:25000});
 assert.equal(await section.getAttribute('data-owned'),'unknown');
 assert.equal(await section.getAttribute('data-item-read-available'),'false');
 assert.equal(await section.getAttribute('data-writer'),'off');
 assert.equal(await section.getAttribute('data-item-edited-copy'),'off');
 assert.equal(await section.getAttribute('data-item-original-backup'),'off');
 assert.equal(await section.locator('a[href$="/editor/timing/"]').count(),1);
 assert.equal(await section.locator('a[href$="/presets/"]').count(),1);
 mark('CHROMIUM_MAIN_EDITOR_ITEMS_UNKNOWN_NAV_WRITER_OFF');
 for(const locale of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  await page.evaluate(l=>localStorage.setItem('dreamwishwand-locale-manual-v1',l),locale);
  await page.reload({waitUntil:'domcontentloaded'});
  await section.waitFor({timeout:15000});
  await page.waitForFunction(l=>document.querySelector('.local-capability')?.getAttribute('lang')===l,locale,{timeout:18000});
  assert.equal(await section.getAttribute('data-owned'),'unknown');
  assert.equal(await section.getAttribute('data-item-read-available'),'false');
 }
 mark('CHROMIUM_EIGHT_LOCALE_USER_UNKNOWN_REMAINS_OFF');
 await page.setViewportSize({width:320,height:750});
 await page.reload({waitUntil:'domcontentloaded'});
 await section.waitFor();
 const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.width+2,JSON.stringify(size));
 try{await access('build/ja/40000047/index.html');throw Error('UNVERIFIED_STATIC_ITEM_HTML_ACCIDENTALLY_PUBLISHED');}
 catch(ex){if(ex.code!=='ENOENT')throw ex;}
 assert.deepEqual(errors,[]);assert.deepEqual(unsafe,[]);
 mark('CHROMIUM_MOBILE_320_ZERO_UPLOAD_AND_NO_ITEM_STATIC_HTML');
 console.log('QR416_INDEPENDENT_LOCAL_ACTUAL_CHROMIUM_ITEM_UNKNOWN_TARGETED_PASS');
} finally {await ctx.close();await browser.close();}
