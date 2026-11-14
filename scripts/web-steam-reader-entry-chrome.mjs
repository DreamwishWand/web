import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {savedDiffGridsCopy,STEAM_DIFFGRIDS_LOCALES} from '../src/lib/wep/steam-saved-diffgrids-copy.mjs';
const origin='http://127.0.0.1:4299',base='/web';
if(!process.env.CHROME_BIN)throw Error('CHROME_REQUIRED');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),unsafe=[],errors=[];
let readerAssets=0;
ctx.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+u.pathname);if(u.pathname.includes('/worker-wasm/'))readerAssets++});
page.on('pageerror',e=>errors.push(String(e)));
const entry=page.locator('[data-steam-reader-entry]');
async function localized(loc,path){
 await page.locator('#site-locale').selectOption(loc);
 const copy=savedDiffGridsCopy(loc);
 await page.waitForFunction(({title,path})=>document.querySelector(path==='editor'?'[data-steam-reader-entry] h2':'#rc-reader-title')?.textContent?.trim()===title,{title:copy.preformal,path});
 assert.equal(await entry.count(),1);
 assert.equal(await entry.getAttribute('href'),base+'/editor/steam-reader/');
 assert.equal(await page.locator('[data-steam-diffgrids-readonly],input[type=file]').count(),0);
}
try{
 await page.goto(origin+base+'/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-test-site-availability] a').click();
 await page.waitForURL(origin+base+'/rc-status/');
 for(const loc of STEAM_DIFFGRIDS_LOCALES)await localized(loc,'rc');
 await page.goto(origin+base+'/editor/',{waitUntil:'domcontentloaded'});
 for(const loc of STEAM_DIFFGRIDS_LOCALES)await localized(loc,'editor');
 assert.equal(readerAssets,0);
 await entry.focus();await page.keyboard.press('Enter');
 await page.waitForURL(origin+base+'/editor/steam-reader/');
 await page.locator('[data-preformal-steam-reader]').waitFor();
 const panel=page.locator('[data-steam-diffgrids-readonly]');
 assert.equal(await panel.getAttribute('data-preformal-read'),'scoped');
 assert.equal(await panel.getAttribute('data-writer'),'off');
 assert.equal(await panel.getAttribute('data-cloud'),'off');
 assert.equal(await panel.getAttribute('data-product-read'),'off');
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-diffgrids-count]').count(),0);
 await page.goto(origin+base+'/rc-status/',{waitUntil:'domcontentloaded'});
 await page.setViewportSize({width:320,height:790});
 await entry.waitFor({state:'visible'});
 assert.ok(await entry.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth+1}));
 await page.setViewportSize({width:640,height:860});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 assert.ok(await entry.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth+1}));
 assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);
 console.log('STEAM_READER_ENTRY_HOME_RC_EDITOR_8LOCALE_KEYBOARD_MOBILE_READONLY_PASS');
}finally{await ctx.close();await browser.close()}
