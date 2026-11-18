import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
assert.ok(process.env.CHROME_BIN,'CHROME_BIN is required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 for(const width of [1366,320]){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:4298/web/moodboards/',{waitUntil:'domcontentloaded',timeout:30000});
   const create=page.locator('form.new-board');
   await create.locator('input').first().fill('DECUX21 local test');
   await create.locator('button[type=submit]').click();
   await page.locator('[data-moodboard-root-card]').first().waitFor({state:'visible'});
   await page.goto('http://127.0.0.1:4298/web/explore/',{waitUntil:'domcontentloaded',timeout:30000});
   const card=page.locator('article.card').first();
   await card.waitFor({state:'visible',timeout:30000});
   const action=card.locator('[data-explore-moodboard-toggle]');
   const review=card.locator('[data-explore-card-review]');
   assert.equal(await action.isEnabled(),true,'Moodboard exists');
   assert.equal(await action.getAttribute('aria-pressed'),'false');
   const itemId=await action.getAttribute('data-item-id');
   assert.ok(itemId);
   const label=await review.getAttribute('aria-label');
   assert.ok(label);
   assert.ok((await action.getAttribute('aria-label')).includes((await card.locator('.body h2').innerText()).trim()));
   const rect=await action.boundingBox();
   assert.ok(rect?.width>=44&&rect.height>=44,'minimum 44px touch target');
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')??'{}').boards?.[0]?.references?.length??-1);
   assert.equal(before,0);
   await action.click();
   assert.equal(await page.getByRole('dialog').count(),0,'independent add must not open Quick Review');
   assert.equal(await action.getAttribute('aria-pressed'),'true');
   assert.equal(await action.getAttribute('data-item-id'),itemId);
   assert.equal(await action.evaluate(el=>getComputedStyle(el).borderTopStyle),'double','pressed styling must be visibly distinct without color');
   const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')??'{}').boards?.[0]?.references?.length??-1);
   assert.equal(after,1,'add exactly once');
   await action.focus();
   await page.keyboard.press('Enter');
   assert.equal(await action.getAttribute('aria-pressed'),'false');
   assert.notEqual(await action.evaluate(el=>getComputedStyle(el).borderTopStyle),'double','removed state restores ordinary border');
   assert.equal(await page.getByRole('dialog').count(),0,'independent removal must not open Quick Review');
   const removed=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')??'{}').boards?.[0]?.references?.length??-1);
   assert.equal(removed,0);
   const previous=await page.evaluate(()=>localStorage.getItem('dreamwishwand:moodboards:v1:backup'));
   assert.ok(previous,'previous snapshot exists for rollback');
   await review.click();
   const dialog=page.getByRole('dialog');
   await dialog.waitFor({state:'visible'});
   assert.ok((await dialog.innerText()).includes((await card.locator('.body h2').innerText()).trim()));
   assert.equal(await action.getAttribute('aria-pressed'),'false','Quick Review must not add item');
   await dialog.getByRole('button').first().click();
   await dialog.waitFor({state:'hidden'});
   assert.equal(await review.evaluate(el=>el===document.activeElement),true,'review opener regains focus');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no responsive horizontal overflow');
   console.log('08WEB_DECUX21_CARD_REVIEW_MOODBOARD_TWO_ACTIONS_CHROME_PASS_'+width);
  }finally{await page.close();await ctx.close();}
 }
 assert.deepEqual(errors,[]);
 console.log('08WEB_DECUX21_44PX_TAP_ADDED_REMOVED_LOCAL_BACKUP_2VIEWPORT_PASS');
}finally{await browser.close();}
