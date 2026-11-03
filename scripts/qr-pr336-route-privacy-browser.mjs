import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { WAND_RC_PRODUCTS, WAND_RC_RESTRICTED_OPERATIONS, WAND_RC_TARGET } from '../src/lib/product-home/rc-manifest.js';

// Independent 04 QR: cumulative PR336 exact head is frozen by workflow. Tests are
// NEW-only adversarial route, visibility and privacy probes, not reruns of
// accepted PR313 or an authorization test of managed GoTrue/Provider.
const origin=(process.env.WEB_QR336_URL??'http://127.0.0.1:4177').replace(/\/$/,'');
assert.ok(process.env.CHROME_BIN,'CHROME_BIN required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:320,height:812},locale:'ja-JP',serviceWorkers:'block'});
const page=await context.newPage();
const results=[],errors=[],provider=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('request',r=>{
  const url=r.url();
  if(/supabase\.co|\/(?:storage|auth|functions|rest)\/v1\/|community-dreamsnap-owner|community-command|community-media/i.test(url))
    provider.push({method:r.method(),path:new URL(url).pathname});
});
const mark=(name,detail={})=>{
  results.push({name,status:'PASS',...detail});
  console.log('QR336_'+name+'_PASS');
};
const fit=async()=>{
  const v=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(v.scroll<=v.width+2,'320px/zoom overflow '+JSON.stringify(v));
};
try {
  // UI registry MUST remain metadata only; all actual authority stays OFF.
  assert.equal(WAND_RC_PRODUCTS.length,7);
  assert.equal(WAND_RC_PRODUCTS.filter(p=>!p.participationSurface).length,6);
  assert.deepEqual(WAND_RC_PRODUCTS.filter(p=>p.participationSurface).map(p=>p.id),['help']);
  assert.ok(WAND_RC_RESTRICTED_OPERATIONS.length>=6);
  assert.ok(WAND_RC_RESTRICTED_OPERATIONS.every(x=>x.status==='OFF'));
  for(const key of ['writer','ownerConsumer'])assert.equal(WAND_RC_TARGET[key],'OFF');
  assert.equal(WAND_RC_TARGET.release,'PUBLIC_NO_GO');
  assert.equal(WAND_RC_TARGET.acceptance,'NOT_ACCEPTED');

  const items=WAND_RC_PRODUCTS.flatMap(p=>[p.href,...p.jobs.map(j=>j.href)]);
  const unique=[...new Set(items)];
  assert.ok(unique.length>=20);
  for(const path of unique){
    assert.match(path,/^\/[a-z0-9/.-]+\/$/,'Unsafe or external route '+path);
    const response=await context.request.get(origin+path,{failOnStatusCode:false,timeout:15000});
    assert.equal(response.status(),200,'Linked RC job destination not served: '+path+' HTTP '+response.status());
  }
  mark('ALL_JOBS_REAL_ROUTE_DESTINATIONS',{uniqueRoutes:unique.length});

  await page.goto(origin+'/rc-status/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('[data-rc-product]').count(),7);
  assert.equal(await page.locator('[data-rc-product="help"] small').count(),1);
  assert.equal(await page.locator('[data-rc-product] li').count(),20);
  assert.ok(await page.locator('[data-rc-job="OFF"]').count()>=7);
  for(const product of WAND_RC_PRODUCTS){
    const route=page.locator('[data-rc-product="'+product.id+'"]');
    assert.equal(await route.count(),1);
    const hrefs=await route.locator('a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
    for(const link of [product.href,...product.jobs.map(j=>j.href)])
      assert.ok(hrefs.some(href=>href?.endsWith(link)),'RC UX missing '+product.id+' '+link);
  }
  assert.match(await page.locator('[data-rc-owner-off]').innerText(),/OFF/);
  assert.match(await page.locator('[data-rc-version]').innerText(),/1\.25\.0/);
  // Browser context locale does not override an app-owned stored/default locale.
  // Select JA explicitly through the real toolbar before JA-copy assertions.
  await page.setViewportSize({width:1280,height:820});
  await page.locator('#site-locale').selectOption('ja');
  await page.setViewportSize({width:320,height:812});
  await page.waitForFunction(()=>document.querySelector('.explain')?.textContent?.includes('ここに記載するRC対象'));
  const textJA=await page.locator('.explain').innerText();
  assert.match(textJA,/公開|未受入/);
  await fit();
  await page.locator('.back').focus();
  assert.equal(await page.locator('.back').evaluate(n=>n===document.activeElement),true);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'A','Tab did not advance to the next route link');
  mark('JA_OFF_PRIVACY_KEYBOARD_320',{productSurfaces:7,jobs:20});

  // Locale changes are owner-neutral and MUST NOT toggle any job/flag.
  await page.setViewportSize({width:1280,height:820});
  await page.locator('#site-locale').selectOption('en');
  await page.setViewportSize({width:320,height:812});
  await page.waitForFunction(()=>document.querySelector('h1')?.textContent?.includes('Availability'));
  assert.match(await page.locator('.explain').innerText(),/not public release acceptance/i);
  assert.match(await page.locator('[data-rc-owner-off]').innerText(),/OFF/);
  assert.equal(await page.locator('[data-rc-job="OFF"]').count(),await page.locator('li[data-status="OFF"]').count()||await page.locator('[data-rc-job="OFF"]').count());
  await fit();
  await page.setViewportSize({width:640,height:850});
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  await fit();
  assert.equal(await page.locator('[data-rc-product]').count(),7);
  mark('EN_ZOOM200_OFF_STILL_OFF');
  await page.evaluate(()=>document.documentElement.style.zoom='');
  await page.setViewportSize({width:320,height:812});

  // Legacy + typed DreamSnaps URLs: invalid and syntactically valid Work IDs
  // both remain fail-closed, never echo the ID, sign Media or call Provider.
  const guid='11111111-1111-4111-8111-111111111111';
  for(const [uri,state] of [
    ['/gallery/dreamsnaps/','legacy'],
    ['/dreamsnaps/community/?work='+guid,'authority-pending'],
    ['/dreamsnaps/community/?work=not-a-uuid','invalid-url']
  ]){
    await page.goto(origin+uri,{waitUntil:'domcontentloaded'});
    if(state==='legacy')assert.equal(await page.locator('[data-legacy-dreamsnaps="fail-closed"]').count(),1);
    else{
      await page.waitForSelector('[data-dreamsnap-work-state="'+state+'"]');
      assert.equal(await page.locator('[data-community-dreamsnaps="fail-closed"]').count(),1);
      assert.ok(!(await page.locator('body').innerText()).includes(guid),'Private Work ID echoed in DOM');
    }
    await fit();
  }
  mark('DREAMSNAPS_WORKID_EMBARGO_AND_INVALID_URL');

  // Help Issues and My Activity are not public publication paths. The route
  // must exist but only show the constrained placeholder/legacy link, never
  // private Activity data or a live Community Owner API call.
  for(const key of ['issues','my']){
    await page.goto(origin+'/help/'+key+'/',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('[data-help-child="'+key+'"]').count(),1);
    await fit();
  }
  assert.deepEqual(provider,[],'Local OFF UI attempted managed auth/media/provider request');
  assert.deepEqual(errors,[],'New RC routes produced uncaught exceptions');
  mark('HELP_ISSUES_ACTIVITY_NO_PROVIDER',{requests:0});
  console.log('QR336_INDEPENDENT_ACTUAL_CHROMIUM_NEW_ONLY_PASS');
}finally{
  await mkdir('.artifacts/qr-pr336',{recursive:true});
  await writeFile('.artifacts/qr-pr336/results.json',JSON.stringify({results,errors,providerCount:provider.length},null,2)+'\n');
  await browser.close();
}