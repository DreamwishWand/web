// 08 WEB real Chrome Home copy locale and permission-safe orientation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
if(!process.env.CHROME_BIN)throw Error('HOME_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH)throw Error('PRIVATE_P1G_NOT_ALLOWED');
const origin=(process.env.STAGE1_HOME_URL||'http://127.0.0.1:4297').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),errors=[],unsafe=[];
page.on('pageerror',e=>errors.push(String(e)));
ctx.on('request',r=>{
 const target=new URL(r.url());
 if(target.origin!==origin||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+target.href);
});
const fields=[
 ['decorate','decorate','decorateDetail'],['collection','collection','collectionDetail'],
 ['guide','guide','guideDetail'],['presets','presets','presetsDetail'],
 ['gallery','gallery','galleryDetail'],['dreamsnaps','dreamsnaps','dreamsnapsDetail']
];
const cards=page.locator('.home-product-grid a.visual-card');
const fit=async name=>{
 const rect=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(rect.scroll<=rect.width+2,name+' '+JSON.stringify(rect));
};
try{
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await cards.first().waitFor({timeout:25000});
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(locale);
  const copy=homeCopy(locale);
  await page.waitForFunction(({locale,guide})=>document.documentElement.dataset.locale===locale &&
    document.querySelector('.home-product-grid a[href*="/guide/"] .visual-card-copy >span')?.textContent?.trim()===guide,
    {locale,guide:copy.guideDetail},{timeout:17000});
  assert.equal(await cards.count(),6,locale+' six equal Core');
  for(const [id,title,detail]of fields){
   const card=page.locator('.home-product-grid a[href="'+('/'+id+'/')+'"]');
   assert.equal(await card.count(),1,locale+' '+id+' route');
   assert.equal((await card.locator('.visual-card-copy strong').innerText()).trim(),copy[title],locale+'/'+title);
   assert.equal((await card.locator('.visual-card-copy >span').innerText()).trim(),copy[detail],locale+'/'+detail);
  }
  const help=page.locator('.home-qa-entry a[href="/help/"]');
  assert.equal(await help.count(),1);
  assert.equal((await help.locator('strong').innerText()).trim(),helpStage1Copy(locale).title);
  assert.equal((await help.locator('.visual-card-copy >span').innerText()).trim(),copy.qaDetail,locale+' Help visible BODY locale, QR553 true red');
  assert.equal(await page.locator('[data-test-site-availability]').count(),1);
  assert.equal(await page.locator('img,video').count(),0);
 }
 console.log('WEB_STAGE1_HOME_SIX_EQUAL_HELP_8LOCALE_ACTUAL_COPY_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(v=>document.querySelector('.home-product-grid a[href="/guide/"] .visual-card-copy >span')?.textContent?.trim()===v,homeCopy('ja').guideDetail);
 const help=page.locator('.home-qa-entry a[href="/help/"]');
 await help.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/help/');
 await page.keyboard.press('Enter');
 await page.locator('[data-help-root="four-children"]').waitFor({timeout:20000});
 await page.goBack({waitUntil:'domcontentloaded'});
 await cards.first().waitFor();
 console.log('WEB_STAGE1_HOME_HELP_CANONICAL_KEYBOARD_PASS');
 await page.setViewportSize({width:320,height:790});
 await fit('320px');
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>5500);
 await page.setViewportSize({width:640,height:860});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('zoom200');
 assert.equal(await cards.count(),6);
 const zoom=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(zoom.length>5500);
 console.log('WEB_STAGE1_HOME_COPY_MOBILE_ZOOM_SHA '+createHash('sha256').update(zoom).digest('hex').slice(0,16));
 assert.deepEqual(errors,[],'no renderer errors');
 assert.deepEqual(unsafe,[],'no off-host/POST/Cloud/Writer');
 console.log('WEB_STAGE1_HOME_NO_PUBLIC_WRITER_OR_PROVIDER_PASS');
}finally{await ctx.close();await browser.close();}
console.log('WEB_STAGE1_HOME_ACTUAL_CHROMIUM_PASS');
