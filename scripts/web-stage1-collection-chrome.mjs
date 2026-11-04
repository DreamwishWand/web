// Actual Chrome acceptance for Stage 1 Collection visual structure, not Native Save proof.
// No unlicensed game imagery, real P1G, personal state, Provider or public publishing.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { STAGE1_COLLECTION_ORDER,stage1CategoryLabel } from '../src/lib/collection/stage1-root.mjs';
const bin=process.env.CHROME_BIN;
if(!bin)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.STAGE1_COLLECTION_URL||'http://127.0.0.1:4285').replace(/\/$/,'');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',r=>{
 const u=new URL(r.url());
 if(u.origin!==root||r.method()!=='GET')writes.push(r.method()+' '+r.url());
});
const fit=async name=>{
 const r=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(r.s<=r.w+2,name+' horizontal overflow '+JSON.stringify(r));
};
try{
 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] [data-category="Furniture"]').waitFor({timeout:45000});
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.locator('[data-stage1-category-grid] [data-category="Furniture"]').waitFor();
  assert.equal(await page.locator('.category-card').count(),29,locale);
  const order=await page.locator('.category-card').evaluateAll(cards=>cards.map(x=>x.getAttribute('data-category')));
  assert.deepEqual(order,STAGE1_COLLECTION_ORDER,locale+' category order');
  assert.equal(await page.locator('[data-category="Furniture"] .category-name').innerText(),stage1CategoryLabel(locale,'Furniture'));
  assert.equal(await page.locator('.category-measure').count(),29);
  assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
  assert.equal(await page.locator('.view-switch').count(),0);
  assert.equal(await page.locator('.collection-card').count(),0,'no flat item root');
 }
 console.log('WEB_STAGE1_COLLECTION_29_CATEGORY_8LOCALE_PASS');
 await page.selectOption('#site-locale','ja');
 await page.locator('[data-category="Furniture"]').click();
 await page.locator('[data-stage1-category-browse] .item-card').first().waitFor({timeout:25000});
 assert.ok(await page.locator('[data-stage1-category-browse] .item-section').count()>0);
 await page.locator('[data-stage1-category-browse] .item-card').first().click();
 await page.locator('[data-stage1-item-info]').waitFor();
 const full=await page.locator('[data-stage1-item-info] a').getAttribute('href');
 assert.match(full,/\/[1-9][0-9]*\/$/);
 await page.locator('[data-stage1-item-info] button').click();
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0);
 await page.locator('.back-category').click();
 await page.locator('[data-stage1-category-grid]').waitFor();
 console.log('WEB_STAGE1_COLLECTION_CATEGORY_TO_UNIVERSE_TO_INFO_RETURN_PASS');
 await page.locator('.filter-toggle').click();
 const options=page.locator('.filter-panel fieldset').first().locator('button');
 await options.first().click();
 await options.nth(1).click();
 assert.equal(await page.locator('.active-filters button').count(),3,'two world chips + clear');
 assert.equal(await options.first().getAttribute('aria-pressed'),'true');
 assert.equal(await options.nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('.active-filters .clear').click();
 assert.equal(await page.locator('.active-filters').count(),0);
 console.log('WEB_STAGE1_COLLECTION_SCOPE_MULTI_OR_AND_CHIPS_PASS');
 await page.locator('[data-stage1-search]').fill('40000047');
 await page.locator('[data-stage1-search-groups] .item-section').first().waitFor({timeout:20000});
 assert.equal(await page.locator('[data-stage1-search-groups] .item-section').count()>0,true);
 assert.equal(await page.locator('[data-stage1-category-grid]').count(),0);
 console.log('WEB_STAGE1_COLLECTION_SOURCE_SEARCH_GROUPS_PASS');
 await page.locator('[data-stage1-search]').fill('');
 await page.setViewportSize({width:320,height:800});
 await page.locator('[data-stage1-category-grid]').waitFor();
 await fit('320px');
 await page.keyboard.press('Tab');
 assert.ok(await page.evaluate(()=>document.activeElement instanceof HTMLElement));
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('200percent');
 assert.equal(await page.locator('.category-card').count(),29);
 console.log('WEB_STAGE1_COLLECTION_320_ZOOM200_KEYBOARD_PASS');
 assert.deepEqual(writes,[],'no external origin, POST or save upload');
 assert.deepEqual(errors,[],'no browser exception');
 console.log('WEB_STAGE1_COLLECTION_NO_UPLOAD_ERRORS_PASS');
}finally{await context.close();await browser.close();}
console.log('WEB_STAGE1_COLLECTION_ACTUAL_CHROME_PASS');
