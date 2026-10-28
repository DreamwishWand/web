import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
const base=(process.env.OWNER_TEST_BASE_URL??'http://127.0.0.1:4175').replace(/[/]$/,'');
if (!process.env.CHROME_BIN) throw Error('CHROME_BIN missing');
const uuid='11111111-1111-4111-8111-111111111111';
const report={scope:'LOCAL_SYNTHETIC_PRIVATE_OWNER_NO_BACKEND',checks:[],forbiddenRequests:[],pageErrors:[],consoleErrors:[],result:'IN_PROGRESS'};
const assert=(v,m)=>{if(!v)throw Error(m)};
const check=x=>report.checks.push(x);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
await mkdir('.artifacts/dreamsnaps-owner-browser',{recursive:true});
try {
  const unauth=await browser.newContext({viewport:{width:320,height:740}});
  const anon=await unauth.newPage();
  anon.on('pageerror',e=>report.pageErrors.push(String(e)));
  await anon.goto(base+'/dreamsnaps/my/manage/',{waitUntil:'domcontentloaded'});
  assert(await anon.locator('[data-owner-state="authentication-required"]').count()===1,'anonymous page must require sign-in');
  assert(await anon.locator('[data-owner-state="local-draft"]').count()===0,'anonymous draft leaked');
  check('ANONYMOUS_AUTH_REQUIRED_NO_OWNER_DRAFT');
  for(const bad of ['?entry='+uuid,'?work=nope','?work='+uuid+'&work='+uuid,'?work='+uuid+'&media='+uuid,'?work='+uuid+'&revision='+uuid,'?work='+uuid+'&creator='+uuid]){
    await anon.goto(base+'/dreamsnaps/my/manage/'+bad,{waitUntil:'domcontentloaded'});
    assert(await anon.locator('[data-owner-state="invalid-url"]').count()===1,'invalid route unexpectedly accepted '+bad);
    assert(await anon.locator('img').count()===0,'invalid route renders image');
  }
  check('INVALID_DUPLICATE_MIXED_ID_NO_MEDIA');

  const context=await browser.newContext({viewport:{width:1280,height:850}});
  await context.addInitScript(()=>{
    sessionStorage.setItem('dreamwishwand-community-session-v1',JSON.stringify({
      accessToken:'FAKE_LOCAL_ONLY',refreshToken:'FAKE_LOCAL_ONLY',
      userId:'22222222-2222-4222-8222-222222222222',
      email:null,expiresAt:Date.now()+600000
    }));
  });
  const page=await context.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
  await page.route('https://x05-synthetic.invalid/**',async route=>{
    report.forbiddenRequests.push(route.request().url());
    await route.fulfill({status:403,body:'NO_BACKEND_ALLOWED'});
  });
  await page.goto(base+'/dreamsnaps/my/manage/',{waitUntil:'domcontentloaded'});
  assert(await page.locator('[data-owner-state="local-draft"]').count()===1,'fake signed actor preview absent');
  assert(await page.locator('[data-owner-action]:not([disabled])').count()===0,'owner operation enabled without backend');
  assert(await page.locator('img').count()===0,'owner route renders image');
  await page.locator('#ds-kind').selectOption('PostEventCreation');
  await page.locator('#ds-challenge').fill('33333333-3333-4333-8333-333333333333');
  await page.locator('#ds-concept').fill('My local concept');
  await page.locator('[data-owner-state="local-draft"] button').click();
  assert(await page.locator('[data-owner-preview="local-only"]').count()===1,'local preview missing');
  await page.locator('#ds-kind').selectOption('OriginalCompetition');
  assert(await page.locator('[data-owner-kind-rule="OriginalCompetition"]').count()===1,'original competition not distinct');
  assert(await page.locator('[data-owner-preview="local-only"]').count()===0,'stale preview survived type change');
  check('OWNER_LOCAL_TYPED_PREVIEW_NO_PERSISTENCE');

  await page.goto(base+'/dreamsnaps/my/manage/?work='+uuid,{waitUntil:'domcontentloaded'});
  assert(await page.locator('[data-owner-state="backend-unavailable"]').count()===1,'valid Work must remain backend gated');
  assert(await page.locator('#ds-concept').count()===0,'WorkID cannot fake owner edit');
  await page.goto(base+'/dreamsnaps/my/manage/?work='+uuid+'&work='+uuid,{waitUntil:'domcontentloaded'});
  assert(await page.locator('[data-owner-state="invalid-url"]').count()===1,'duplicate Work ID accepted after SPA navigation');
  await page.goBack({waitUntil:'domcontentloaded'});
  assert(await page.locator('[data-owner-state="backend-unavailable"]').count()===1,'back navigation stale Work body');
  check('WORK_ID_AUTHORITY_PENDING_STALE_NAVIGATION');

  for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
    await page.goto(base+'/dreamsnaps/my/manage/',{waitUntil:'domcontentloaded'});
    await page.locator('#site-locale').selectOption(locale);
    assert(await page.locator('html').getAttribute('lang')===locale,'locale html lang '+locale);
    await page.setViewportSize({width:320,height:760});
    const dim=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert(dim.scroll<=dim.width+2,'overflow '+locale+' '+JSON.stringify(dim));
    const button=page.locator('[data-owner-action="request-delete"]');
    assert(await button.isDisabled(),'delete enabled '+locale);
    assert(await button.getAttribute('aria-disabled')==='true','a11y disabled '+locale);
    await page.locator('#ds-kind').focus();
    assert(await page.locator('#ds-kind').evaluate(el=>el===document.activeElement),'keyboard type selector '+locale);
    await page.setViewportSize({width:1280,height:850});
  }
  check('EIGHT_LOCALES_320PX_KEYBOARD_ARIA_NO_ACTION');
  assert(report.forbiddenRequests.length===0,'backend request without capability: '+JSON.stringify(report.forbiddenRequests));
  assert(report.pageErrors.length===0,'page errors: '+report.pageErrors);
  assert(report.consoleErrors.length===0,'console errors: '+report.consoleErrors);
  check('ZERO_BACKEND_MEDIA_PUBLIC_OR_STORAGE_REQUESTS');
  report.result='PASS';
} catch(e){report.result='FAIL';report.failed=String(e)}
finally {
 await writeFile('.artifacts/dreamsnaps-owner-browser/result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 await browser.close();
}
if(report.result!=='PASS') throw Error(report.failed);
