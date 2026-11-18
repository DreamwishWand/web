import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

assert.ok(process.env.CHROME_BIN,'Chrome executable must be provided');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try {
 for(const width of [1366,320]) {
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  try {
   await page.goto('http://127.0.0.1:4298/web/explore/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('.explore-page .card').first().waitFor({state:'visible',timeout:30000});
   const family=page.locator('[data-explore-family-select]');
   const universe=page.locator('[data-explore-universe-select]');
   assert.equal(await family.count(),1);
   assert.equal(await universe.count(),1);
   const values=async()=>universe.locator('option').evaluateAll(nodes=>nodes.map(x=>x.value).filter(Boolean));
   const all=await values();
   assert.ok(all.length>0,'verified decoration Universe metadata required for this test');
   const familyOptions=await family.locator('option').evaluateAll(nodes=>nodes.map(x=>x.value).filter(Boolean));
   assert.ok(familyOptions.includes('Furniture')&&familyOptions.includes('Buildings'));
   const byFamily={};
   for(const name of familyOptions){
    await family.selectOption(name);
    await page.waitForFunction(selected=>document.querySelector('[data-explore-family-select]')?.value===selected,name);
    byFamily[name]=await values();
    assert.ok(byFamily[name].every(v=>all.includes(v)),'family Universe must be subset of decoration-wide choices');
    assert.equal(new Set(byFamily[name]).size,byFamily[name].length,'no duplicate Universe');
    const renderedNames=await universe.locator('option').allInnerTexts();
    assert.ok(renderedNames.every(v=>v.trim().length>0),'real locale official Universe labels');
   }
   const pair=familyOptions.flatMap(a=>familyOptions.filter(b=>b!==a).map(b=>({a,b,only:byFamily[a].filter(v=>!byFamily[b].includes(v))}))).find(x=>x.only.length);
   assert.ok(pair,'real source should expose family-scoped Universe distinctions, not a global dictionary');
   await family.selectOption(pair.a);
   await universe.selectOption(pair.only[0]);
   assert.equal(await universe.inputValue(),pair.only[0],'valid Universe selected in family');
   await family.selectOption(pair.b);
   await page.waitForFunction(()=>document.querySelector('[data-explore-universe-select]')?.value==='');
   assert.equal(await universe.inputValue(),'','switching to incompatible family must clear stale Universe');
   assert.ok(!(await values()).includes(pair.only[0]),'stale family Universe not exposed in target family');
   const reselect=byFamily[pair.b][0];
   if(reselect){
    await universe.selectOption(reselect);
    assert.equal(await universe.inputValue(),reselect,'compatible Universe remains usable');
    await page.locator('[data-explore-search-toggle]').click();
    assert.equal(await page.locator('[data-explore-search-toggle]').getAttribute('aria-expanded'),'true','secondary search still usable');
    await page.locator('[data-explore-search-panel] input[type=search]').press('Escape');
   }
   await family.selectOption('');
   const rest=await values();
   assert.deepEqual(new Set(rest),new Set(all),'clear family restores decoration Universe choices');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no responsive horizontal overflow');
   console.log('08WEB_DECUX06_REAL_VERIFIED_FAMILY_UNIVERSE_STALE_RESET_PASS_'+width);
  }finally{await page.close();await context.close();}
 }
 assert.deepEqual(errors,[],'no page errors');
 console.log('08WEB_DECUX06_FAMILY_FIRST_UNIVERSE_2VIEWPORT_PASS');
}finally{await browser.close();}
