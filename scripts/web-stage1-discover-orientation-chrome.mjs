// 08 WEB owner actual Chrome orientation-only acceptance.
// No private DDV save, Community authorization, Provider, publishing or writer capability is exercised.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {orientationCopy,ORIENTATION_DESTINATIONS} from '../src/lib/product-home/orientation-stage1-copy.mjs';
const chrome=process.env.CHROME_BIN;
if(!chrome)throw Error('STAGE1_DISCOVER_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK)throw Error('PRIVATE_SAVE_NOT_ALLOWED');
const origin=(process.env.STAGE1_DISCOVER_URL||'http://127.0.0.1:4296').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1380,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),errors=[],unsafe=[];
page.on('pageerror',e=>errors.push(String(e)));
ctx.on('request',r=>{
  const url=new URL(r.url());
  if(url.origin!==origin||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+url.href);
});
const products=page.locator('[data-discover-seven-products] [data-discover-product]');
async function fit(label){
  const q=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(q.scroll<=q.width+2,label+': '+JSON.stringify(q));
}
try{
  await page.goto(origin+'/discover/',{waitUntil:'domcontentloaded'});
  await page.locator('[data-discover-stage1="orientation-not-dashboard"]').waitFor({timeout:25000});
  for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    await page.locator('#site-locale').selectOption(locale);
    const copy=orientationCopy(locale);
    await page.waitForFunction(({code,purpose})=>
      document.documentElement.dataset.locale===code &&
      document.querySelector('[data-discover-product="decorate"] .discover-product-purpose p')?.textContent?.trim()===purpose,
      {code:locale,purpose:copy.products[0].purpose},{timeout:17000});
    assert.equal(await products.count(),7,locale+' product total');
    assert.deepEqual(await products.evaluateAll(els=>els.map(x=>x.getAttribute('data-discover-product'))),
      copy.products.map(x=>x.id),locale+' product order');
    for(const p of copy.products){
      const card=page.locator('[data-discover-product="'+p.id+'"]');
      assert.equal((await card.locator('.discover-product-purpose p').innerText()).trim(),p.purpose,locale+'/'+p.id+' purpose');
      assert.equal((await card.locator('.discover-product-start p').innerText()).trim(),p.step,locale+'/'+p.id+' first action');
      assert.equal((await card.locator('[data-discover-destination]').getAttribute('href')),p.path,locale+'/'+p.id+' canonical route');
    }
    assert.equal(await page.locator('[data-discover-account-optional]').count(),1);
    assert.equal(await page.locator('[data-discover-save-optional]').count(),1);
    assert.equal(await page.locator('[data-discover-capability-gated]').count(),1);
    assert.equal((await page.locator('[data-discover-account-optional] p').innerText()).trim(),copy.account);
    assert.equal((await page.locator('[data-discover-save-optional] p').innerText()).trim(),copy.save);
    assert.equal(await page.locator('[data-public-writer="off"][data-save-auto-upload="off"]').count(),1);
    assert.equal(await page.locator('.discovery-status-link').count(),2);
    assert.equal(await page.locator('img,video').count(),0);
  }
  console.log('WEB_STAGE1_DISCOVER_SEVEN_PRODUCT_PURPOSE_FIRSTSTEP_8LOCALE_DOM_PASS');
  assert.deepEqual(ORIENTATION_DESTINATIONS[6],'/help/');
  await page.locator('#site-locale').selectOption('ja');
  await page.waitForFunction(text=>document.querySelector('[data-discover-product="guide"] .discover-product-purpose p')?.textContent?.trim()===text,orientationCopy('ja').products[2].purpose);
  const help=page.locator('[data-discover-destination="help"]');
  await help.focus();
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-discover-destination')),'help');
  await page.keyboard.press('Enter');
  await page.locator('[data-help-root="four-children"]').waitFor({timeout:25000});
  assert.equal(new URL(page.url()).pathname,'/help/');
  await page.goBack({waitUntil:'domcontentloaded'});
  await products.first().waitFor({timeout:20000});
  console.log('WEB_STAGE1_DISCOVER_CANONICAL_HELP_KEYBOARD_ROUTE_PASS');

  await page.setViewportSize({width:320,height:790});
  await fit('320px');
  const small=await page.screenshot({type:'png',animations:'disabled'});
  assert.ok(small.length>6000);
  await page.setViewportSize({width:640,height:860});
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  await fit('zoom200');
  assert.equal(await products.count(),7);
  const zoom=await page.screenshot({type:'png',animations:'disabled'});
  assert.ok(zoom.length>6000);
  console.log('WEB_STAGE1_DISCOVER_MOBILE_320_ZOOM_200_SHA '+createHash('sha256').update(zoom).digest('hex').slice(0,16));
  assert.deepEqual(unsafe,[],'no remote/POST/cloud/save requests');
  assert.deepEqual(errors,[],'no renderer exceptions');
  console.log('WEB_STAGE1_DISCOVER_ACCOUNT_SAVE_OPTIONAL_NO_PROVIDER_WRITER_PASS');
}finally{
  await ctx.close();await browser.close();
}
console.log('WEB_STAGE1_DISCOVER_ACTUAL_CHROMIUM_PASS');
