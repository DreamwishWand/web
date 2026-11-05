// Owner 2026-10-24 Guide Systems 7-category presentation only. No rights approval or personal P1G.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {GUIDE_SYSTEMS_CATEGORIES,guideSystemsCategoryLabel} from '../src/lib/guide/systems-stage1-taxonomy.mjs';
if(!process.env.CHROME_BIN)throw Error('GUIDE_SYSTEMS_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK)throw Error('PRIVATE_P1G_FORBIDDEN');
const origin=(process.env.GUIDE_SYSTEMS_URL||'http://127.0.0.1:4294').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),errors=[],unsafe=[];
page.on('pageerror',e=>errors.push(String(e)));
ctx.on('request',r=>{
 if(new URL(r.url()).origin!==origin||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+r.url());
});
const categories=page.locator('[data-systems-category-grid]');
async function fit(name){
 const m=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(m.scroll<=m.width+2,name+': '+JSON.stringify(m));
}
try{
 await page.goto(origin+'/guide/systems/',{waitUntil:'domcontentloaded'});
 await categories.waitFor({timeout:30000});
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
 assert.equal(await page.locator('[data-guide-rights=unverified][data-published-articles=off][data-writer=off]').count(),1);
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(locale);
  await page.waitForFunction(({locale,label})=>document.documentElement.dataset.locale===locale &&
   document.querySelector('[data-systems-category=basics] strong')?.textContent?.trim()===label,
   {locale,label:guideSystemsCategoryLabel('basics',locale)},{timeout:18000});
  assert.equal(await categories.locator('button').count(),7,locale);
  const ids=await categories.locator('button').evaluateAll(els=>els.map(x=>x.getAttribute('data-systems-category')));
  assert.deepEqual(ids,GUIDE_SYSTEMS_CATEGORIES.map(c=>c.id),locale+' order');
  for(const item of GUIDE_SYSTEMS_CATEGORIES){
   const text=(await categories.locator('[data-systems-category="'+item.id+'"] strong').innerText()).trim();
   assert.equal(text,guideSystemsCategoryLabel(item.id,locale),locale+':'+item.id);
  }
  assert.equal(await page.locator('a[href*="/guide/systems/"]').count(),0,'no recursive guide navigation');
  assert.equal(await page.locator('img,video').count(),0,'no game imagery');
 }
 console.log('WEB_STAGE1_GUIDE_SYSTEMS_7CATEGORY_8_LOCALE_REAL_DOM_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(()=>document.querySelector('[data-systems-category=basics] strong')?.textContent?.trim()==='基本・進行・設定');
 const png=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(png.length>7000);
 console.log('WEB_STAGE1_GUIDE_SYSTEMS_RENDER_SHA '+createHash('sha256').update(png).digest('hex').slice(0,16));
 for(const c of GUIDE_SYSTEMS_CATEGORIES){
  await categories.locator('[data-systems-category="'+c.id+'"]').focus();
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-systems-category')),c.id);
  await page.keyboard.press('Enter');
  await page.locator('[data-systems-subgroups]').waitFor();
  assert.equal(await page.locator('[data-systems-group]').count(),c.subgroups.length,c.id+' subgroups');
  assert.equal(await page.locator('.systems-stage1 [role=status]').count(),1,'published articles blocked');
  assert.equal(await page.locator('[data-guide-rights=unverified]').count(),1);
  await page.locator('.systems-return').click();
  await categories.waitFor();
 }
 console.log('WEB_STAGE1_GUIDE_SYSTEMS_7_NAV_KEYBOARD_GROUPS_BACK_PASS');
 await page.locator('.systems-query input').fill('Timebending');
 assert.deepEqual(await categories.locator('button').evaluateAll(els=>els.map(x=>x.getAttribute('data-systems-category'))),['gathering']);
 await page.locator('.systems-query input').fill('NO_THIS_SOURCE_DOES_NOT_EXIST_123456');
 assert.equal(await categories.locator('button').count(),0);
 assert.equal(await page.locator('.systems-empty[role=status]').count(),1);
 await page.locator('.systems-query input').fill('');
 await page.setViewportSize({width:320,height:800});
 await fit('320px');
 assert.equal(await categories.locator('button').count(),7);
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('zoom200');
 assert.equal(await categories.locator('button').count(),7);
 const narrow=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(narrow.length>5000);
 assert.deepEqual(unsafe,[],'no external/POST/Provider/Writer/Cloud request');
 assert.deepEqual(errors,[],'no JS crashes');
 console.log('WEB_STAGE1_GUIDE_SYSTEMS_320_200_SEARCH_NO_PROVIDER_PASS');
}finally{await ctx.close();await browser.close();}
console.log('WEB_STAGE1_GUIDE_SYSTEMS_ACTUAL_CHROMIUM_PASS');
