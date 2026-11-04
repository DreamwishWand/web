// Real Chromium Stage1 Guide four-card root visual/navigation safety. No P1G or writer.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {guideCopy} from '../src/lib/guide/copy.js';
const bin=process.env.CHROME_BIN;if(!bin)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.STAGE1_GUIDE_URL||'http://127.0.0.1:4286').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const page=await context.newPage();const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',req=>{if(new URL(req.url()).origin!==root||req.method()!=='GET')writes.push(req.method()+' '+req.url());});
const destinations=['quests','starPaths','events','systems'];
const fit=async name=>{const d=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));assert.ok(d.s<=d.w+2,name+': '+JSON.stringify(d));};
try{
 await page.goto(root+'/guide/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-guide-hub]').waitFor({timeout:35000});
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  const cards=page.locator('[data-stage1-guide-hub] button');
  assert.equal(await cards.count(),4,locale);
  const keys=await cards.evaluateAll(els=>els.map(el=>el.getAttribute('data-guide-child')));
  assert.deepEqual(keys,destinations,locale+' root IA');
  await page.waitForFunction(({code,expected})=>{
    const live=document.querySelector('[data-guide-child="quests"] strong')?.textContent?.trim();
    return document.documentElement.dataset.locale===code && live===expected;
  },{code:locale,expected:guideCopy(locale).quests},{timeout:20000});
  for(const key of destinations){
    assert.equal((await page.locator('[data-guide-child="'+key+'"] strong').innerText()).trim(),
      guideCopy(locale)[key],locale+':'+key);
  }
  assert.equal(await page.locator('[data-guide-child="issues"]').count(),0);
 }
 console.log('WEB_STAGE1_GUIDE_FOUR_CHILD_8LOCALE_PASS');
 await page.selectOption('#site-locale','ja');
 for(const section of destinations){
  await page.locator('[data-guide-child="'+section+'"]').click();
  await page.locator('.guide-tabs').waitFor();
  assert.equal(await page.locator('.guide-tabs button').count(),4);
  assert.equal((await page.locator('.guide-tabs button.active').innerText()).trim(),
    guideCopy('ja')[section]);
  assert.equal(await page.locator('[data-stage1-guide-hub]').count(),0);
  await page.locator('.guide-back').click();
  await page.locator('[data-stage1-guide-hub]').waitFor();
 }
 console.log('WEB_STAGE1_GUIDE_FOUR_WORKSPACES_BACK_PASS');
 await page.setViewportSize({width:320,height:760});
 await fit('320');
 await page.locator('[data-guide-child="quests"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-guide-child')),'quests');
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('zoom200');
 console.log('WEB_STAGE1_GUIDE_320_200_KEYBOARD_PASS');
 assert.deepEqual(writes,[],'no POST/offorigin/upload');
 assert.deepEqual(errors,[],'no page error');
 console.log('WEB_STAGE1_GUIDE_NO_WRITER_PASS');
}finally{await context.close();await browser.close();}
console.log('WEB_STAGE1_GUIDE_REAL_CHROMIUM_PASS');
