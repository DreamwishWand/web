// 08 WEB first Account UI in actual installed Chrome. Unconfigured staging must
// remain visibly OFF; no live signup, no public profile, no private bytes.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {firstAccountCopy} from '../src/lib/account-ui/copy.mjs';
const bin=process.env.CHROME_BIN;
if(!bin)throw Error('CHROME_BIN_REQUIRED');
const origin=(process.env.WAND_ACCOUNT_URL||'http://127.0.0.1:4292').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',r=>{
 if(r.method()!=='GET'||new URL(r.url()).origin!==origin)writes.push(r.method()+' '+r.url());
});
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const fit=async label=>{
 const info=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(info.scroll<=info.w+2,label+' '+JSON.stringify(info));
};
try{
 await page.goto(origin+'/account/',{waitUntil:'domcontentloaded'});
 const root=page.locator('[data-account-entry]');
 await root.waitFor();
 assert.equal(await root.getAttribute('data-account-test-runtime'),'off');
 assert.equal(await root.getAttribute('data-account-public'),'off');
 assert.equal(await root.getAttribute('data-private-library'),'off');
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-first-account-register]').isDisabled(),true);
 assert.equal(await page.locator('[data-first-account-login]').isDisabled(),true);
 assert.equal(await page.locator('[data-first-account-logout]').count(),0);
 assert.equal(await page.locator('form[data-first-account-form] fieldset').getAttribute('disabled')!==null,true,'fieldset DOM disabled attribute');
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.waitForFunction(code=>document.documentElement.dataset.locale===code,locale);
  assert.equal(await page.locator('h1').first().innerText(),firstAccountCopy(locale).title);
  assert.equal(await page.locator('[data-account-off]').innerText(),firstAccountCopy(locale).off);
 }
 console.log('WEB_FIRST_ACCOUNT_EIGHT_LOCALE_OFF_AND_EMAIL_CONFIRM_UI_PASS');

 // The private Library has NO static route (host contract keeps direct 404).
 // Assert visible denial on the Account page without inventing Library HTTP200.
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.waitForFunction(code=>document.documentElement.dataset.locale===code,locale);
  assert.ok((await page.locator('[data-account-private-warning]').innerText()).includes(firstAccountCopy(locale).libraryOff));
  assert.ok((await page.locator('[data-private-library-route-off]').innerText()).includes(firstAccountCopy(locale).library));
 }
 assert.equal(await page.locator('a[href="/library/"]').count(),0);
 console.log('WEB_FIRST_ACCOUNT_LIBRARY_STATIC_ROUTE_OFF_EIGHT_LOCALE_PASS');

 for(const width of [320,640]){await page.setViewportSize({width,height:800});await fit('account-'+width);}
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('account-200percent');
 const link=page.locator('a:visible').first();
 await link.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A');
 assert.equal(await page.locator('[data-account-entry]').getAttribute('data-account-test-runtime'),'off');
 console.log('WEB_FIRST_ACCOUNT_320_ZOOM200_KEYBOARD_FOCUS_PASS');
 assert.deepEqual(writes,[],'unconfigured Account never posts/Auth/Uploads');
 assert.deepEqual(errors,[],'no JS errors');
 console.log('WEB_FIRST_ACCOUNT_UNCONFIGURED_ZERO_POST_ZERO_PRIVATE_LEAK_PASS');
}finally{await context.close();await browser.close();}
