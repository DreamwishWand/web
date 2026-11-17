import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const executablePath=process.env.CHROME_BIN;
assert.ok(executablePath,'Chrome executable is required');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const failures=[];
try{
  for(const width of [1366,320]){
    const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
    const page=await context.newPage();
    page.on('pageerror',error=>failures.push(String(error)));
    try{
      await page.goto('http://127.0.0.1:4298/web/explore/',{waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('.controls').waitFor({state:'visible',timeout:30000});
      const toggle=page.locator('[data-explore-search-toggle]');
      const panel=page.locator('[data-explore-search-panel]');
      const input=panel.locator('input[type="search"]');
      assert.equal(await toggle.count(),1);
      assert.equal(await toggle.getAttribute('aria-controls'),'explore-search-panel');
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      assert.equal(await panel.isVisible(),false);
      assert.equal(await input.isDisabled(),true);
      const originalResults=(await page.locator('.summary strong').innerText()).trim();
      assert.ok(await page.locator('.card').count()>0,'verified decorating catalog should have items');
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'),'true');
      assert.equal(await panel.isVisible(),true);
      assert.equal(await input.isEnabled(),true);
      assert.equal(await input.evaluate(el=>el===document.activeElement),true);
      await input.fill('decux07-no-such-verified-item-923749');
      await page.locator('.empty').waitFor({state:'visible',timeout:15000});
      assert.equal(await page.locator('.card').count(),0);
      await input.press('Escape');
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      assert.equal(await panel.isVisible(),false);
      assert.equal(await input.isDisabled(),true);
      assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
      await page.waitForFunction(text=>document.querySelector('.summary strong')?.textContent?.trim()===text,originalResults,{timeout:15000});
      assert.ok(await page.locator('.card').count()>0,'closing Search must restore visual browse');
      assert.equal(await page.locator('.controls select').count(),3,'family/universe/moodboard unchanged');
      await toggle.click();
      assert.equal(await input.inputValue(),'','previous query must not survive collapse');
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      const fit=await toggle.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.width>0});
      assert.equal(fit,true,'Search control must fit responsive viewport');
      console.log('08WEB_DECUX07_EXPLORE_SEARCH_ACTUAL_CHROME_PASS '+width);
    }finally{await page.close();await context.close();}
  }
  assert.deepEqual(failures,[],'no browser runtime errors');
  console.log('08WEB_DECUX07_COLLAPSED_EXPANDED_ESCAPE_CLEAR_2VIEWPORT_PASS');
}finally{await browser.close();}
