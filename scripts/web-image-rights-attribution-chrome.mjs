import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {IMAGE_RIGHTS_ATTRIBUTION} from '../src/lib/i18n/image-rights-attribution.js';
import {SUPPORTED_LOCALES} from '../src/lib/i18n/registry.js';
import {t} from '../src/lib/i18n/runtime.js';
import {readFileSync} from 'node:fs';
const origin='http://127.0.0.1:4298',base='/web';
const html=readFileSync('build/index.html','utf8');
assert.match(html,/data-image-rights-attribution/,'static prerender contains notice');
assert.ok(html.includes('Disney Dreamlight Valley'));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),unsafe=[],media=[],errors=[];
ctx.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+u.origin);if(u.pathname.includes('/ddv/item-images/'))media.push(u.pathname)});
page.on('pageerror',e=>errors.push(String(e)));
const notice=page.locator('[data-image-rights-attribution]');
const help=page.locator('footer a[href="/web/help/"]');
const waitCopy=async code=>{
 await page.waitForFunction(({code,text})=>document.documentElement.dataset.locale===code&&document.querySelector('[data-image-rights-attribution]')?.textContent.trim()===text,{code,text:IMAGE_RIGHTS_ATTRIBUTION[code]},{timeout:20000});
 assert.equal(await notice.count(),1);assert.equal(await notice.isVisible(),true);
 assert.equal(await notice.innerText(),IMAGE_RIGHTS_ATTRIBUTION[code]);
};
const fit=async label=>{
 await notice.scrollIntoViewIfNeeded();
 const r=await notice.evaluate(e=>{const b=e.getBoundingClientRect(),f=e.closest('footer').getBoundingClientRect(),s=getComputedStyle(e);return {left:b.left,right:b.right,width:b.width,height:b.height,footerLeft:f.left,footerRight:f.right,viewport:innerWidth,scrollX,overflow:s.overflow,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}});
 assert.ok(r.width>0&&r.height>0&&r.left>=-1&&r.right<=r.viewport+1&&r.footerLeft>=-1&&r.footerRight<=r.viewport+1&&Math.abs(r.scrollX)<=1&&r.scrollWidth<=r.clientWidth+2,label+JSON.stringify(r));
 assert.notEqual(r.overflow,'hidden');
};
try{
 for(const path of ['/','/collection/','/explore/','/help/','/editor/world/']){
  await page.goto(origin+base+path,{waitUntil:'domcontentloaded'});
  await notice.waitFor({timeout:20000});
  assert.equal(await notice.count(),1,path);
  assert.equal(await help.count(),1,path);
 }
 await page.goto(origin+base+'/',{waitUntil:'domcontentloaded'});
 for(const [width,zoom] of [[1366,1],[320,1],[640,2]]){
  await page.setViewportSize({width,height:900});
  await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
  for(const {code} of SUPPORTED_LOCALES){
   const desktop=page.locator('#site-locale');
   if(await desktop.isVisible())await desktop.selectOption(code);
   else{
    const current=await page.locator('html').getAttribute('data-locale');
    const settings=page.locator('.mobile-global-actions').getByRole('button',{name:t('shared.shell.settings',{},current),exact:true});
    await settings.click();
    const mobile=page.locator('#site-locale-mobile');
    await mobile.selectOption(code);
    await waitCopy(code);
    await page.keyboard.press('Escape');
    await page.locator('dialog:has(#site-locale-mobile)').waitFor({state:'hidden'});
   }
   await waitCopy(code);await fit(code+'/'+width+'/'+zoom);
  }
 }
 console.log('08WEB_IMAGE_ATTRIBUTION_8LOCALE_3_VIEWPORTS_VISIBLE_PASS');
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:320,height:800});
 await help.focus();assert.equal(await help.evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Enter');await page.waitForURL('**/web/help/');
 await notice.waitFor();await waitCopy('pt-BR');
 assert.deepEqual(await page.locator('footer a').allTextContents(),[await help.innerText()]);
 assert.deepEqual(media,[],'media OFF no image request');
 assert.deepEqual(unsafe,[],'no offorigin or mutation');
 assert.deepEqual(errors,[]);
 console.log('08WEB_IMAGE_ATTRIBUTION_HELP_KEYBOARD_NO_MEDIA_OR_CONTACT_PASS');
}finally{await ctx.close();await browser.close()}
