// Owner Stage1 Presets actual Chrome UI, no Native Writer/Shop Provider or private P1G.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {presetsStage1Copy,PRESETS_STAGE1_ROOT,PRESETS_STAGE1_IN_GAME} from '../src/lib/presets/stage1-root.mjs';
const bin=process.env.CHROME_BIN;if(!bin)throw Error('PRESETS_CHROME_REQUIRED');
const root=(process.env.STAGE1_PRESETS_URL||'http://127.0.0.1:4289').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1360,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage(), errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',req=>{
 if(req.method()!=='GET'||new URL(req.url()).origin!==root)writes.push(req.method()+' '+req.url());
});
const fit=async name=>{
 const d=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(d.s<=d.w+2,name+': '+JSON.stringify(d));
};
try{
 await page.goto(root+'/presets/',{waitUntil:'domcontentloaded'});
 const grid=page.locator('[data-stage1-presets-four-cards]');
 await grid.waitFor({timeout:20000});
 const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
 const names=['wand','touchOfMagic','inGame','my'];
 for(const locale of locales){
  await page.locator('#site-locale').selectOption(locale);
  const expected=presetsStage1Copy(locale);
  await page.waitForFunction(({code,label})=>
    document.documentElement.dataset.locale===code &&
    document.querySelector('[data-preset-child="wand"] strong')?.textContent?.trim()===label,
   {code:locale,label:expected.wand},{timeout:15000});
  assert.deepEqual(await grid.locator('button').evaluateAll(els=>els.map(x=>x.getAttribute('data-preset-child'))),PRESETS_STAGE1_ROOT);
  for(const [id,key] of [['wand','wand'],['touchOfMagic','tom'],['inGame','inGame'],['my','my']]){
   assert.equal((await grid.locator('[data-preset-child="'+id+'"] strong').innerText()).trim(),expected[key],locale+':'+id);
  }
  assert.equal(await page.locator('[data-native-writer="off"][data-provider-gate="off"][data-tom-writer="off"]').count(),1);
  assert.equal(await page.locator('.preset-tabs,.panel,.preflight-card').count(),0,'root must not mount workbench');
 }
 console.log('WEB_STAGE1_PRESETS_EIGHT_LOCALE_FOUR_ROOT_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await grid.locator('[data-preset-child="inGame"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-preset-child')),'inGame');
 await page.keyboard.press('Enter');
 await page.locator('[data-stage1-presets-ingame]').waitFor();
 assert.deepEqual(await page.locator('[data-stage1-presets-ingame] button').evaluateAll(e=>e.map(x=>x.getAttribute('data-preset-ingame-child'))),PRESETS_STAGE1_IN_GAME);
 await page.locator('[data-preset-ingame-child="shop"]').click();
 await page.locator('[data-preset-unavailable]').waitFor();
 assert.equal(await page.locator('img').count(),0);
 await page.locator('.preset-back').click();
 await grid.waitFor();
 await grid.locator('[data-preset-child="touchOfMagic"]').click();
 await page.locator('[data-preset-unavailable]').waitFor();
 await page.locator('.preset-back').click();
 await grid.waitFor();
 console.log('WEB_STAGE1_PRESETS_INGAME_TWO_SHOP_TOM_OFF_PASS');
 await page.setViewportSize({width:320,height:790});
 await fit('320');
 await grid.locator('[data-preset-child="wand"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-preset-child')),'wand');
 await page.setViewportSize({width:640,height:790});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('200');
 assert.equal(await grid.locator('button').count(),4);
 assert.deepEqual(writes,[],'root/blocked tabs never request external provider/POST');
 assert.deepEqual(errors,[],'no browser exception');
 console.log('WEB_STAGE1_PRESETS_320_ZOOM200_KEYBOARD_NO_PROVIDER_PASS');
}finally{await context.close();await browser.close();}
console.log('WEB_STAGE1_PRESETS_ACTUAL_CHROMIUM_PASS');
