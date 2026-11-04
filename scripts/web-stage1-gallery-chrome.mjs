// Independent real local browser smoke of Stage1 Gallery: root structure, 8 locales, strict OFF.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const bin=process.env.CHROME_BIN;if(!bin)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.STAGE1_GALLERY_URL||'http://127.0.0.1:4287').replace(/\/$/,'');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1360,height:900},serviceWorkers:'block'});
const page=await context.newPage();const errors=[],uploads=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',req=>{if(req.method()!=='GET'||new URL(req.url()).origin!==root)uploads.push(req.method()+' '+req.url());});
const fit=async where=>{const x=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));assert.ok(x.s<=x.w+2,where+': '+JSON.stringify(x));};
try{
 await page.goto(root+'/gallery/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-gallery-hub]').waitFor({timeout:20000});
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.locator('html[data-locale="'+locale+'"]').waitFor({timeout:15000});
  const labels=await page.locator('[data-stage1-gallery-hub] [data-gallery-child]').evaluateAll(els=>els.map(el=>el.getAttribute('data-gallery-child')));
  assert.deepEqual(labels,['decorations','touchOfMagic','myGallery']);
  assert.equal(await page.locator('[data-stage1-gallery-root][data-writer="off"][data-media-rights="unverified"]').count(),1);
  assert.equal(await page.locator('a[href*="/gallery/dreamsnaps/"]').count(),0);
  assert.equal(await page.locator('[data-stage1-gallery-hub] .prominent').count(),1);
 }
 console.log('WEB_STAGE1_GALLERY_3CARDS_EIGHTLOCALE_PASS');
 await page.selectOption('#site-locale','ja');
 await page.locator('[data-gallery-child="decorations"]').click();
 await page.locator('[data-stage1-gallery-facets] button').first().waitFor();
 assert.equal(await page.locator('[data-stage1-gallery-facets] button').count(),3);
 assert.equal(await page.locator('[data-gallery-subtype="decorations"]').count(),0,'provider absent should not fake Gallery works');
 await page.locator('.gallery-back').click();
 await page.locator('[data-gallery-child="touchOfMagic"]').click();
 await page.locator('[data-stage1-gallery-facets] button').first().waitFor();
 assert.equal(await page.locator('[data-stage1-gallery-facets] button').count(),3);
 await page.locator('.gallery-back').click();
 assert.match(await page.locator('[data-gallery-child="myGallery"]').getAttribute('href'),/\/gallery\/my\/$/);
 console.log('WEB_STAGE1_GALLERY_CATEGORY_FACETS_BACK_MYGALLERY_PASS');
 await page.setViewportSize({width:320,height:800});
 await fit('320');
 await page.locator('[data-gallery-child="decorations"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-gallery-child')),'decorations');
 await page.setViewportSize({width:640,height:840});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('200percent');
 assert.deepEqual(errors,[]);
 assert.deepEqual(uploads,[],'no unknown provider upload or mutation');
 console.log('WEB_STAGE1_GALLERY_MOBILE_ZOOM_KEYBOARD_NOUPLOAD_PASS');
}finally{await context.close();await browser.close();}
console.log('WEB_STAGE1_GALLERY_ACTUAL_CHROME_PASS');
