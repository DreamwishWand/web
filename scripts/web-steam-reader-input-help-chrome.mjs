import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {steamReaderInputHelp,STEAM_INPUT_HASH_COMMAND} from '../src/lib/wep/steam-reader-input-help.mjs';
import {STEAM_DIFFGRIDS_LOCALES} from '../src/lib/wep/steam-saved-diffgrids-copy.mjs';

const origin='http://127.0.0.1:4298',base='/web';
if(!process.env.CHROME_BIN)throw Error('CHROME_REQUIRED');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),unsafe=[],errors=[];
ctx.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+u.pathname)});
page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(origin+base+'/editor/steam-reader/',{waitUntil:'domcontentloaded'});
 const help=page.locator('[data-steam-input-help]'),summary=help.locator('summary');
 const reader=page.locator('[data-steam-diffgrids-readonly]');
 assert.equal(await help.evaluate(e=>e.open),false);
 assert.equal(await reader.evaluate(e=>e.open),true);
 assert.equal(await reader.getAttribute('data-writer'),'off');
 assert.equal(await reader.getAttribute('data-product-read'),'off');
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 for(const loc of STEAM_DIFFGRIDS_LOCALES){
  const copy=steamReaderInputHelp(loc);
  await page.locator('#site-locale').selectOption(loc);
  await page.waitForFunction(title=>document.querySelector('[data-steam-input-help] summary')?.textContent?.trim()===title,copy.title);
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await help.evaluate(e=>e.open),true);
  assert.equal(await help.locator('pre code').innerText(),STEAM_INPUT_HASH_COMMAND);
  const actual=await help.locator('p').allInnerTexts();
  assert.deepEqual(actual,[copy.version,copy.hash,copy.open]);
  assert.equal(await help.locator('input,button,a,form').count(),0);
  assert.equal(await reader.evaluate(e=>e.open),true);
  await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await help.evaluate(e=>e.open),false);
 }
 await page.setViewportSize({width:320,height:820});
 await summary.focus();await page.keyboard.press('Enter');
 assert.equal(await help.evaluate(e=>e.open),true);
 async function fits(){
  assert.ok(await help.evaluate(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=-1&&r.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1}));
  assert.ok(await help.locator('pre').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 }
 await fits();
 await page.setViewportSize({width:640,height:860});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fits();
 assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);
 console.log('STEAM_WINDOWS_INPUT_HELP_8LOCALE_KEYBOARD_MOBILE_ZOOM_READONLY_PASS');
}finally{await ctx.close();await browser.close()}
