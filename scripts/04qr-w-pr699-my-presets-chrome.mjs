// 04 QR-W independent actual Chrome NEW_ONLY PR699, synthetic local fixture only.
// No private Steam P1G, Creator credentials, or public-ownership claims.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {myPresetsCopy} from '../src/lib/presets/my-presets-router.mjs';
import {presetsStage1Copy} from '../src/lib/presets/stage1-root.mjs';

const executablePath=process.env.CHROME_BIN;
if(!executablePath) throw Error('QR699_REAL_CHROME_BIN_REQUIRED');
const origin=(process.env.QR699_CHROME_URL??'http://127.0.0.1:4297').replace(/\/$/,'');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:840},acceptDownloads:false,serviceWorkers:'block'});
const page=await context.newPage();
const offOriginOrWrite=[],pageErrors=[];
page.on('pageerror',x=>pageErrors.push(x.message));
context.on('request',request=>{
 const url=request.url();
 if(request.method()!=='GET'||new URL(url).origin!==origin){
  offOriginOrWrite.push(request.method()+' '+url);
 }
});
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const expectViewport=async (name)=> {
 const widths=await page.evaluate(()=>({
  client:document.documentElement.clientWidth,
  content:document.documentElement.scrollWidth
 }));
 assert.ok(widths.content<=widths.client+2, name+' horizontal overflow '+JSON.stringify(widths));
};
const chooseLocale=async l=>{
 await page.locator('#site-locale').selectOption(l);
 await page.waitForFunction(({locale,label})=>
  document.documentElement.dataset.locale===locale&&
  document.querySelector('[data-preset-child="wand"] strong')?.textContent?.trim()===label,
  {locale:l,label:presetsStage1Copy(l).wand},{timeout:16000});
};
try{
 await page.goto(origin+'/presets/',{waitUntil:'networkidle',timeout:30000});
 await page.locator('[data-stage1-presets-four-cards]').waitFor();
 // A new My root appears exactly once; never add a second global My or replace the root.
 assert.equal(await page.locator('[data-preset-child="my"]').count(),1);
 for(const l of locales){
  await chooseLocale(l);
  await page.locator('[data-preset-child="my"]').click();
  await page.locator('[data-my-domains]').waitFor();
  assert.deepEqual(await page.locator('[data-my-domain]').evaluateAll(els=>els.map(el=>el.getAttribute('data-my-domain'))),
    ['wand','touchOfMagic','inGame'],l+' inner domains');
  assert.equal(await page.locator('[data-my-domain="wand"]').getAttribute('aria-pressed'),'true',l+' default Wand');
  assert.equal(await page.locator('[data-my-community-list="off"][data-my-verified="false"][data-personal-owned="unknown"]').count(),1);
  assert.equal(await page.locator('[data-my-wand-view="created"]').count(),1);
  assert.ok((await page.locator('[data-my-wand-view="created"]').innerText()).includes(myPresetsCopy(l).createdUnknown),l+' created UNKNOWN');
  await page.locator('[data-my-view-button="saved"]').click();
  assert.equal(await page.locator('[data-my-view-button="saved"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-my-wand-view="saved"]').count(),1);
  assert.ok((await page.locator('[data-my-wand-view="saved"]').innerText()).includes(myPresetsCopy(l).savedUnknown),l+' saved UNKNOWN');
  assert.notEqual(myPresetsCopy(l).savedUnknown,myPresetsCopy(l).createdUnknown);
  await page.locator('[data-my-domain="touchOfMagic"]').click();
  assert.equal(await page.locator('[data-my-tom-verified="false"][data-my-import="off"][data-personal-owned="unknown"]').count(),1);
  assert.ok((await page.locator('[data-my-domain-view="touchOfMagic"]').innerText()).includes(myPresetsCopy(l).tomBoundary));
  await page.locator('[data-my-domain="inGame"]').click();
  assert.equal(await page.locator('[data-my-current-save="unknown"]').count(),1,l+' no forged Native current Save');
  assert.equal(await page.locator('[data-my-pc-backup="manual"]').count(),1,l+' manual backup');
  assert.equal(await page.locator('[data-my-creator="unverified"]').count(),1,l+' no forged Creator');
  assert.equal(await page.locator('[data-my-pc-local]').count(),0,l+' no eager file reader');
  await page.locator('.preset-back').click();
  await page.locator('[data-stage1-presets-four-cards]').waitFor();
 }
 console.log('QR699_CHROME_8LOCALE_SINGLE_MY_THREE_DOMAINS_CREATED_SAVED_NO_OWNERSHIP_PASS');

 // Unlike Source Owner checks which only mount the input, actually select a
 // small non-private schema624 synthetic JSON and retain the decoded local view.
 await chooseLocale('ja');
 await page.locator('[data-preset-child="my"]').click();
 assert.equal(await page.locator('[data-my-pc-local]').count(),0);
 await page.locator('[data-my-domain="inGame"]').click();
 const open=page.locator('[data-my-open-pc]');
 await open.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-my-open-pc')),'');
 await page.keyboard.press('Enter');
 await page.locator('[data-my-pc-local] input[type=file]').first().waitFor();
 const synthetic={
  GameInfo:{Version:624},
  World:{DecorationPresets:[{
   PresetName:'QR SYNTHETIC ONLY',StateFlags:0,ThumbnailItems:[],ShareInfo:null,
   GridCollection:{Grids:{'0':{ID:0,Objects:{},NextGridObjectID:0}},NextGridID:1,DiffGrids:{}}
  }]}
 };
 await page.locator('[data-my-pc-local] input[type=file]').first().setInputFiles({
  name:'qr-synthetic624.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(synthetic))
 });
 await page.locator('[data-my-pc-local] .source-summary strong').first().waitFor({timeout:20000});
 assert.equal((await page.locator('[data-my-pc-local] .source-summary strong').first().innerText()).trim(),'qr-synthetic624.json');
 assert.equal(await page.locator('[data-my-native-writer="off"][data-auto-cloud="off"]').count(),1);
 await page.locator('[data-my-domain="wand"]').click();
 assert.equal(await page.locator('[data-my-pc-local]').count(),1,'local file manager must remain mounted');
 assert.notEqual(await page.locator('[data-my-pc-local]').getAttribute('hidden'),null,'hide but keep local state');
 await page.locator('[data-my-view-button="saved"]').click();
 await page.locator('[data-my-domain="touchOfMagic"]').click();
 await page.locator('[data-my-domain="inGame"]').click();
 assert.equal(await page.locator('[data-my-pc-local]').getAttribute('hidden'),null);
 assert.equal((await page.locator('[data-my-pc-local] .source-summary strong').first().innerText()).trim(),'qr-synthetic624.json','decoded local file must survive domain switches');
 assert.equal(await page.locator('[data-my-current-save="unknown"]').count(),1,'local PC JSON never mints Current Save');
 assert.equal(await page.locator('[data-my-creator="unverified"]').count(),1,'local PC JSON never mints Creator ownership');
 console.log('QR699_CHROME_USER_SELECTED_SYNTHETIC_PC_FILE_RETAINED_NO_NATIVE_AUTHORITY_PASS');

 await page.setViewportSize({width:320,height:820});
 await expectViewport('320px with local inspector');
 await page.locator('[data-my-domain="wand"]').focus();
 await page.keyboard.press('Enter');
 assert.equal(await page.locator('[data-my-domain="wand"]').getAttribute('aria-pressed'),'true','keyboard navigation');
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await expectViewport('200 percent zoom');
 assert.deepEqual(offOriginOrWrite,[],'no automatic provider/cloud/off-origin fetch or POST');
 assert.deepEqual(pageErrors,[],'no unhandled browser errors');
 console.log('QR699_CHROME_320_ZOOM200_KEYBOARD_NO_AUTOCLOUD_NO_OFFORIGIN_PASS');
}finally{
 await context.close();
 await browser.close();
}
console.log('QR699_INDEPENDENT_CHANGED_ONLY_CHROME_PASS');