// 08 WEB actual Chrome owner UX, strict no-P1G/no-public-Provider. This does not approve publication.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {dreamsnapsStage1Copy,DREAMSNAPS_STAGE1_DESTINATIONS} from '../src/lib/community/dreamsnaps-stage1-root.mjs';
const bin=process.env.CHROME_BIN;
if(!bin)throw Error('STAGE1_DREAMSNAPS_CHROME_REQUIRED');
const root=(process.env.STAGE1_DREAMSNAPS_URL||'http://127.0.0.1:4288').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage(),errors=[],blocked=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(url.origin===root&&['GET','HEAD'].includes(route.request().method()))route.continue();
 else {blocked.push(route.request().method()+' '+url.href);route.abort('blockedbyclient');}
});
const layout=async name=>{
 const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.width+2,name+': '+JSON.stringify(size));
};
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
try{
 await page.goto(root+'/dreamsnaps/',{waitUntil:'domcontentloaded'});
 const nav=page.locator('[data-stage1-dreamsnaps-root="1-3-1"]');
 await nav.waitFor({timeout:30000});
 const cards=nav.locator('a[data-dreamsnaps-child]');
 for(const locale of locales){
  await page.locator('#site-locale').selectOption(locale);
  await page.waitForFunction(({code,expected})=>
   document.documentElement.dataset.locale===code &&
   document.querySelector('[data-dreamsnaps-child="community"] strong')?.textContent?.trim()===expected,
   {code:locale,expected:dreamsnapsStage1Copy(locale).community},{timeout:20000});
  assert.equal(await cards.count(),5);
  const ids=await cards.evaluateAll(els=>els.map(a=>a.getAttribute('data-dreamsnaps-child')));
  assert.deepEqual(ids,DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.id));
  const expected=dreamsnapsStage1Copy(locale);
  for(const [id,key] of [['community','community'],['submit','submit'],['judge','judge'],['results','results'],['my','my']]){
   assert.equal((await nav.locator('[data-dreamsnaps-child="'+id+'"] strong').innerText()).trim(),expected[key],locale+':'+id);
  }
  const paths=await cards.evaluateAll(a=>a.map(el=>new URL(el.href).pathname));
  assert.deepEqual(paths,DREAMSNAPS_STAGE1_DESTINATIONS.map(x=>x.href));
  assert.equal(await nav.locator('[data-stage1-dreamsnaps-peers] a').count(),3);
  assert.equal(await page.locator('[href*="/gallery/dreamsnaps/"]').count(),0);
 }
 console.log('WEB_STAGE1_DREAMSNAPS_EIGHT_LOCALE_TRUE_131_LINKS_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.setViewportSize({width:320,height:800});
 await layout('mobile320');
 await page.locator('[data-dreamsnaps-child="community"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-dreamsnaps-child')),'community');
 await page.keyboard.press('Enter');
 await page.locator('[data-community-dreamsnaps="gated"]').waitFor();
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-public-provider="off"][data-writer="off"][data-private-results="off"]').count(),1);
 assert.equal(await page.locator('img,video').count(),0);
 await page.locator('.community-dreamsnaps-off .back').click();
 await nav.waitFor();
 await page.setViewportSize({width:640,height:800});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await layout('zoom200');
 assert.equal(await cards.count(),5);
 console.log('WEB_STAGE1_DREAMSNAPS_COMMUNITY_GATED_KEYBOARD_320_200_PASS');
 assert.deepEqual(errors,[],'no renderer exceptions');
 assert.deepEqual(blocked,[],'no external/POST/upload request');
 console.log('WEB_STAGE1_DREAMSNAPS_NO_PUBLIC_PROVIDER_UPLOAD_PASS');
}finally{await context.close();await browser.close();}
console.log('WEB_STAGE1_DREAMSNAPS_ACTUAL_CHROMIUM_PASS');
