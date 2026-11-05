/** Independent real system Chrome Home: six Core reactivity + 8-locale Help BODY, not just title.
 * No external provider/native/private P1G, no unauthorized public media.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {homeCopy} from '../src/lib/product-home/copy.js';
import {helpStage1Copy} from '../src/lib/community/help-stage1-copy.js';
if(!process.env.CHROME_BIN)throw Error('QR552_ACTUAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR552_PRIVATE_P1G_CI_FORBIDDEN');
const url=new URL(process.env.QR552_URL??'http://127.0.0.1:4298/');
if(url.href!=='http://127.0.0.1:4298/')throw Error('QR552_EXACT_LOCALHOST_ONLY');
const langs=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'],idAndCopy=[
 ['decorate','decorate','decorateDetail'],['collection','collection','collectionDetail'],
 ['guide','guide','guideDetail'],['presets','presets','presetsDetail'],
 ['gallery','gallery','galleryDetail'],['dreamsnaps','dreamsnaps','dreamsnapsDetail']
];
const denied=[],errors=[],mismatchedHelp=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR552_WEBSOCKET_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4298')route.connectToServer();
  else{denied.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{denied.push(route.request().method()+' '+route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 const cards=page.locator('.home-product-grid a.visual-card');
 await cards.first().waitFor({state:'visible',timeout:30000});
 const help=page.locator('.home-qa-entry a[href="/help/"]');
 await help.waitFor();
 await page.locator('#site-locale').selectOption('en');
 await page.waitForFunction(t=>document.querySelector('.home-product-grid a[href="/guide/"] .visual-card-copy >span')?.textContent?.trim()===t,homeCopy('en').guideDetail);
 const originalEnglish=(await help.locator('.visual-card-copy >span').innerText()).trim();
 assert.ok(originalEnglish.length>30);
 for(const lang of langs){
  await page.locator('#site-locale').selectOption(lang);
  const expected=homeCopy(lang);
  await page.waitForFunction(({lang,detail})=>
   document.documentElement.dataset.locale===lang &&
   document.querySelector('.home-product-grid a[href="/guide/"] .visual-card-copy >span')?.textContent?.trim()===detail,
   {lang,detail:expected.guideDetail},{timeout:15000});
  assert.equal(await cards.count(),6);
  for(const [id,title,detail] of idAndCopy){
   const card=page.locator('.home-product-grid a[href="/'+id+'/"]');
   assert.equal((await card.locator('.visual-card-copy strong').innerText()).trim(),expected[title],lang+' '+id+' title');
   assert.equal((await card.locator('.visual-card-copy >span').innerText()).trim(),expected[detail],lang+' '+id+' detail');
  }
  assert.equal((await help.locator('.visual-card-copy strong').innerText()).trim(),helpStage1Copy(lang).title);
  const actual=(await help.locator('.visual-card-copy >span').innerText()).trim();
  if(lang!=='en'&&lang!=='ja'&&expected.qaDetail!==homeCopy('en').qaDetail&&actual===originalEnglish)
   mismatchedHelp.push({lang,actual,localizedAvailable:expected.qaDetail});
  assert.equal(await page.locator('[data-test-site-availability]').count(),1);
  assert.equal(await page.locator('img,video').count(),0);
 }
 console.log('QR552 ACTUAL 8 LOCALES X6 CORE TITLES/DESCRIPTIONS + ALL8 HELP TITLE PASS');
 if(mismatchedHelp.length)console.log('QR552 HELP BODY ENGLISH FALLBACK FOUND '+JSON.stringify(mismatchedHelp.map(x=>({lang:x.lang,actual:x.actual.slice(0,90),canonicalTranslation:x.localizedAvailable.slice(0,90)}))));
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(t=>document.querySelector('.home-product-grid a[href="/guide/"] .visual-card-copy >span')?.textContent?.trim()===t,homeCopy('ja').guideDetail);
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>6000);
 console.log('QR552 HOME DESKTOP REAL UI PNG RAM SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 await page.setViewportSize({width:320,height:750});
 const small=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(small.s<=small.w+2,JSON.stringify(small));
 await help.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/help/');
 await page.keyboard.press('Enter');
 await page.locator('[data-help-root="four-children"]').waitFor();
 await page.goBack({waitUntil:'networkidle'});
 await cards.first().waitFor();
 await page.setViewportSize({width:640,height:840});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(zoom.s<=zoom.w+2,JSON.stringify(zoom));
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>5500);
 assert.deepEqual(denied,[]);
 assert.deepEqual(errors,[]);
 console.log('QR552 MOBILE320/ZOOM200 KEYBOARD HELP + NO OFFHOST/WS/POST/PAGEERR PASS');
 assert.deepEqual(mismatchedHelp,[], 'QR552_SOURCE_UI_TRUE_RED: six non-Japanese launch locale Help card bodies remain English despite available localized Home qaDetail');
 await ctx.close();
}finally{await browser.close();}
