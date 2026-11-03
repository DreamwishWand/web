import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin=(process.env.WEB_HELP_BASE_URL??'http://127.0.0.1:4177').replace(/\/$/,'');
const executablePath=process.env.CHROME_BIN;
if(!executablePath) throw new Error('Requires actual Chromium binary');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:320,height:850},locale:'ja-JP',serviceWorkers:'block'});
const checks=[],network=[],errors=[];
page.on('pageerror',(error)=>errors.push(String(error)));
page.on('request',(request)=>{
  const u=request.url();
  if (/supabase\.co|storage\/v1|\/rest\/v1|\/functions\/v1|community-query|community-command|community-media/.test(u)) {
    network.push(u.split('?')[0]);
  }
});
const pass=(name)=>{checks.push(name);console.log('WEB_HELP_'+name+'_PASS');};
const fit=async(label)=>{
  const widths=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(widths.scroll<=widths.client+2,label+' horizontal overflow '+JSON.stringify(widths));
};
try{
  // Locale initialization on a hard navigation can replace the browser default;
  // select JA through the visible application control for EVERY visited destination.
  const kinds=['questions','tips','issues','my'];
  const titles={questions:'質問',tips:'ヒント',issues:'問題',my:'アクティビティ'};
  for(const kind of kinds) {
    await page.setViewportSize({width:1280,height:850});
    await page.goto(origin+'/help/'+kind+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#site-locale').selectOption('ja');
    await page.waitForFunction((expected)=>document.querySelector('.help-heading h1')?.textContent?.includes(expected),titles[kind]);
    await page.setViewportSize({width:320,height:850});
    const shell=page.locator('[data-help-child="'+kind+'"][data-help-local-only="true"]');
    assert.equal(await shell.count(),1,kind+' local shell missing');
    assert.match(await shell.getByRole('heading',{level:1}).innerText(),new RegExp(titles[kind]));
    assert.equal(await shell.locator('[data-help-empty-state="unverified"]').count(),1);
    assert.equal(await shell.locator('.help-local-nav li').count(),4);
    assert.equal(await shell.locator('[aria-current="page"]').count(),1);
    assert.equal(await shell.locator('.help-back').count(),1);
    if(kind==='questions'||kind==='tips'){
      assert.equal(await shell.locator('[data-help-status="CONDITIONAL"]').count(),1);
      assert.equal(await shell.locator('input[type="search"]:disabled').count(),1);
      assert.equal(await shell.locator('[data-help-existing-conditional="true"]').count(),1);
      assert.match(await shell.locator('[data-help-existing-conditional="true"]').getAttribute('href'),new RegExp('\\/qa\\/\\?type='+kind+'$'));
    }else{
      assert.equal(await shell.locator('[data-help-status="OFF"]').count(),1);
      assert.equal(await shell.locator('[data-help-no-auth="true"]').count(),1);
      assert.equal(await shell.locator('[data-help-existing-conditional]').count(),0);
      assert.equal(await shell.locator('input').count(),0);
    }
    await fit(kind+' ja 320');
  }
  pass('FOUR_JA_LOCAL_EMPTY_STATES_320');

  await page.goto(origin+'/help/my/',{waitUntil:'domcontentloaded'});
  await page.locator('.help-back').focus();
  assert.equal(await page.locator('.help-back').evaluate(el=>el===document.activeElement),true);
  const outline=await page.locator('.help-back').evaluate(el=>getComputedStyle(el).outlineStyle);
  assert.notEqual(outline,'none');
  assert.deepEqual(network,[],'private/remote request from local Help child');
  pass('OFF_OWNER_NO_PRIVATE_REQUEST_KEYBOARD');

  await page.setViewportSize({width:1280,height:900});
  await page.locator('#site-locale').selectOption('en');
  await page.setViewportSize({width:320,height:850});
  await page.goto(origin+'/help/questions/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.help-heading h1')?.textContent?.trim()==='Questions');
  assert.match(await page.locator('[data-help-empty-state="unverified"]').innerText(),/No verified questions have been loaded/);
  await fit('en 320');
  pass('EN_LOCALIZED_EMPTY_STATE_320');

  await page.setViewportSize({width:640,height:980});
  await page.evaluate(()=>{document.documentElement.style.zoom='2';});
  await fit('zoom200');
  assert.equal(await page.locator('.help-local-nav [aria-current="page"]').count(),1);
  pass('CSS_ZOOM_200_ACCESSIBILITY');
  assert.deepEqual(network,[],'No remote requests are allowed from local route shell');
  assert.deepEqual(errors,[],'No page exceptions are allowed');
  pass('NO_REMOTE_OR_PAGE_ERRORS');
} finally {
  await mkdir('.artifacts/web-help-local',{recursive:true});
  await writeFile('.artifacts/web-help-local/result.json',JSON.stringify({origin,checks,networkCount:network.length,errors},null,2));
  await browser.close();
}
console.log('WEB_HELP_LOCAL_CHROMIUM_PASS');
