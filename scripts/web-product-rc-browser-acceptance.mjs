import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin=(process.env.WEB_RC_BASE_URL ?? 'http://127.0.0.1:4176').replace(/\/$/,'');
const chrome=process.env.CHROME_BIN;
if(!chrome) throw new Error('CHROME_BIN required for actual Chromium acceptance');
const results=[];
const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:320,height:812},locale:'ja-JP',serviceWorkers:'block'});
const page=await context.newPage();
const errors=[];
const providerRequests=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{
  if(/supabase\.co|storage\/v1|community-dreamsnap-owner|community-command|community-media/.test(r.url()))
    providerRequests.push(r.url().split('?')[0]);
});
const record=(name,extra={})=>{results.push({name,status:'PASS',...extra});console.log('WEB_RC_'+name+'_PASS');};
const fit=async () => {
 const v=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(v.scroll<=v.width+2,'Horizontal overflow '+JSON.stringify(v));
};
try {
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.home-product-grid .visual-card').count(),6);
  assert.ok((await page.locator('.home-qa-entry a').getAttribute('href'))?.endsWith('/help/'));
  assert.equal(await page.locator('[data-product-rc-boundary="off"]').count(),1);
  await fit();
  record('SIX_CORE_HELP_HOME_320');

  await page.goto(origin+'/rc-status/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('[data-rc-product]').count(),7);
  assert.equal(await page.locator('[data-rc-legend]').count(),3);
  assert.ok(await page.locator('[data-rc-job="OFF"]').count()>=5);
  assert.match(await page.locator('[data-rc-owner-off]').innerText(),/OFF/);
  assert.match(await page.locator('[data-rc-version]').innerText(),/1\.25\.0/);
  const links=await page.locator('[data-rc-product] a').evaluateAll(a=>a.map(n=>n.getAttribute('href')));
  for(const path of ['/decorate/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/','/help/']){
    assert.ok(links.some(h=>h?.endsWith(path)),'Missing product route '+path);
  }
  await fit();
  await page.locator('.back').focus();
  assert.equal(await page.locator('.back').evaluate(n=>n===document.activeElement),true);
  record('ROUTE_LEDGER_KEYBOARD_JA_320',{core:6,help:1});

  await page.locator('#site-locale').selectOption('en');
  await page.waitForFunction(()=>document.querySelector('[data-rc-owner-off]')?.textContent?.includes('publishing'));
  assert.match(await page.locator('h1').innerText(),/Availability/);
  await fit();
  record('EN_LOCALE_NO_OVERFLOW');

  await page.setViewportSize({width:640,height:1000});
  await page.evaluate(()=>{ document.documentElement.style.zoom='2'; });
  await fit();
  assert.equal(await page.locator('[data-rc-product]').count(),7);
  record('CHROME_CSS_ZOOM_200_LAYOUT');

  await page.evaluate(()=>{document.documentElement.style.zoom='';});
  await page.setViewportSize({width:320,height:812});
  await page.goto(origin+'/help/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.help-children a').count(),4);
  await fit();
  record('HELP_FOUR_JOBS_320');

  await page.goto(origin+'/gallery/dreamsnaps/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('[data-legacy-dreamsnaps="fail-closed"]').count(),1);
  await fit();
  await page.goto(origin+'/dreamsnaps/community/?work=11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-dreamsnap-work-state="authority-pending"]');
  assert.equal(await page.locator('[data-community-dreamsnaps="fail-closed"]').count(),1);
  assert.deepEqual(providerRequests,[],'Blocked DreamSnaps page must not call managed services');
  record('OLD_URL_AND_TYPED_DREAMSNAPS_NO_LEAK');

  assert.deepEqual(errors,[],'Uncaught errors in RC browser flows');
  record('NO_PAGE_ERRORS');
} finally {
  await mkdir('.artifacts/web-rc',{recursive:true});
  await writeFile('.artifacts/web-rc/chromium-result.json',JSON.stringify({origin,results,pageErrors:errors,providerRequestCount:providerRequests.length},null,2));
  await browser.close();
}
console.log('WEB_PRODUCT_RC_ACTUAL_CHROMIUM_PASS');
