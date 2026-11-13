import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { guideCopy } from '../src/lib/guide/copy.js';
const origin='http://127.0.0.1:4194';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
 for(const loc of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  const ctx=await browser.newContext({locale:loc,viewport:{width:320,height:900},serviceWorkers:'block'});
  try{
   const page=await ctx.newPage(),errors=[],bad=[];
   page.on('pageerror',e=>errors.push(String(e)));
   ctx.on('request',r=>{if(r.method()!=='GET'||!r.url().startsWith(origin+'/'))bad.push(r.method());});
   await page.goto(origin+'/guide/',{waitUntil:'networkidle'});
   await page.waitForFunction(l=>document.documentElement.dataset.locale===l,loc);
   await page.locator('[data-guide-root="starPaths"]').click();
   const list=page.locator('[data-guide-reference-list] button');
   await list.first().waitFor();
   assert.equal(await list.count(),2);
   const ordinary=page.locator('[data-guide-duty-group="duties"]'),routine=page.locator('[data-guide-duty-group="routine"]');
   await list.first().click();
   await ordinary.locator('[data-guide-duty-label]').first().waitFor();
   assert.equal(await ordinary.locator('[data-guide-duty-label]').count(),121);
   assert.equal(await routine.locator('[data-guide-duty-label]').count(),0);
   assert.equal(await routine.locator('[data-guide-duty-unresolved]').getAttribute('data-guide-duty-unresolved'),'21');
   assert.ok((await routine.innerText()).includes(guideCopy(loc).unresolvedDutyText));
   assert.ok((await routine.locator('h4').innerText()).includes(guideCopy(loc).routineDuties));
   assert.ok(!(await routine.innerText()).includes('Liveops.'));
   await list.nth(1).focus();
   await list.nth(1).press('Enter');
   await routine.locator('[data-guide-duty-label]').first().waitFor();
   assert.equal(await ordinary.locator('[data-guide-duty-label]').count(),15);
   assert.equal(await routine.locator('[data-guide-duty-label]').count(),3);
   assert.equal(await routine.locator('[data-guide-duty-unresolved]').count(),0);
   assert.equal(await list.nth(1).getAttribute('aria-pressed'),'true');
   assert.equal(await list.nth(0).getAttribute('aria-pressed'),'false');
   assert.match(await routine.innerText(),/Take a Picture of the Event Board/);
   for(const [width,zoom] of [[320,1],[640,2]]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(z=>document.documentElement.style.zoom=String(z),zoom);
    const fit=await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2);
    assert.ok(fit,loc+' overflow');
   }
   assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
   assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
   console.log('GUIDE_ROUTINE_DUTIES_BROWSER_PASS '+loc);
  }finally{await ctx.close()}
 }
}finally{await browser.close()}
