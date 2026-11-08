// Independent user-visible navigation SVG, NOT game asset media or private Save.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {HOME_STAGE1_CONSUMER,DECORATE_STAGE1_CONSUMER} from '../src/lib/ui/consumer-fixtures.js';
const bin=process.env.CHROME_BIN;
if(!bin)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.WEB_VISUAL_ICONS_URL||'http://127.0.0.1:4298').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',request=>{
 const u=new URL(request.url());
 if(request.method()!=='GET'||u.origin!==root)writes.push(request.method()+' '+request.url());
});
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const fit=async label=>{
 const x=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.width+2,label+' horizontal overflow '+JSON.stringify(x));
};
try{
 await page.goto(root+'/',{waitUntil:'domcontentloaded'});
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  const cards=page.locator('.home-product-grid .visual-card');
  assert.equal(await cards.count(),6);
  const icons=await cards.locator('[data-visual-card-icon]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-visual-card-icon')));
  assert.deepEqual(icons,HOME_STAGE1_CONSUMER.coreProducts.map(x=>x.icon));
  assert.equal(new Set(icons).size,6);
  assert.equal(await cards.locator('.visual-card-icon svg[aria-hidden="true"]').count(),6);
  for(const element of await cards.all()){
   assert.ok((await element.innerText()).trim().length>0);
   assert.ok(await element.locator('.visual-card-icon svg path').count()>0);
  }
 }
 console.log('WEB_FIRST_PARTY_SVG_HOME_CORE6_EIGHT_LOCALES_PASS');
 await page.goto(root+'/decorate/',{waitUntil:'domcontentloaded'});
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  const cards=page.locator('.visual-card');
  assert.equal(await cards.count(),3);
  assert.deepEqual(await cards.locator('[data-visual-card-icon]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-visual-card-icon'))),
   DECORATE_STAGE1_CONSUMER.entryCards.map(x=>x.icon));
  assert.equal(await cards.locator('.visual-card-icon svg[aria-hidden="true"]').count(),3);
 }
 console.log('WEB_FIRST_PARTY_SVG_DECORATE3_EIGHT_LOCALES_PASS');
 for(const width of [320,640]){await page.setViewportSize({width,height:800});await fit('decorate-'+width);}
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('decorate-zoom200');
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await page.setViewportSize({width:1366,height:900});
 const boardLink=page.locator('.visual-card[href$="/moodboards/"]');
 await boardLink.focus();
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/moodboards\/$/);
 assert.ok((await page.locator('h1').first().innerText()).length>0);
 console.log('WEB_FIRST_PARTY_SVG_320_ZOOM200_KEYBOARD_PASS');
 assert.deepEqual(writes,[],'No POST or off-origin asset requests');
 assert.deepEqual(errors,[],'No browser exceptions');
 console.log('WEB_FIRST_PARTY_SVG_NO_ITEM_ART_UPLOAD_PASS');
}finally{await context.close();await browser.close();}
