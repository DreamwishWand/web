import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 for(const width of [1366,320]){
  const ctx=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:4298/web/explore/',{waitUntil:'domcontentloaded',timeout:30000});
   const action=page.locator('article.card [data-explore-moodboard-toggle]').first();
   await action.waitFor({state:'visible',timeout:30000});
   const glyph=action.locator('[data-moodboard-state-icon]');
   assert.equal(await action.isDisabled(),true,'no Board: must not activate state');
   assert.equal(await glyph.getAttribute('data-moodboard-state-icon'),'plus');
   assert.equal(await glyph.locator('svg').count(),2,'controlled Board plus icon assets only');
   assert.equal(await glyph.locator('svg[aria-hidden="true"]').count(),2,'icons decorative; text is accessible');
   await page.goto('http://127.0.0.1:4298/web/moodboards/',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('form.new-board input').first().fill('Board icon state proof');
   await page.locator('form.new-board button[type=submit]').click();
   await page.locator('[data-moodboard-root-card]').first().waitFor();
   await page.goto('http://127.0.0.1:4298/web/explore/',{waitUntil:'domcontentloaded',timeout:30000});
   const card=page.locator('article.card').first();await card.waitFor({state:'visible'});
   const button=card.locator('[data-explore-moodboard-toggle]');
   const icon=button.locator('[data-moodboard-state-icon]');
   const review=card.locator('[data-explore-card-review]');
   assert.equal(await button.getAttribute('aria-pressed'),'false');
   assert.equal(await icon.getAttribute('data-moodboard-state-icon'),'plus');
   assert.ok((await icon.locator('svg').last().locator('path').first().getAttribute('d')).includes('M12 5v14'));
   const rc=await button.boundingBox();assert.ok(rc?.width>=44&&rc.height>=44);
   await button.click();
   assert.equal(await page.getByRole('dialog').count(),0);
   assert.equal(await button.getAttribute('aria-pressed'),'true');
   assert.equal(await icon.getAttribute('data-moodboard-state-icon'),'check');
   assert.ok((await icon.locator('svg').last().locator('path').first().getAttribute('d')).includes('M4 12.5'));
   assert.equal(await button.evaluate(el=>getComputedStyle(el).borderTopStyle),'double');
   await button.focus();await page.keyboard.press('Enter');
   assert.equal(await button.getAttribute('aria-pressed'),'false');
   assert.equal(await icon.getAttribute('data-moodboard-state-icon'),'plus');
   assert.equal(await page.getByRole('dialog').count(),0);
   assert.ok(await page.evaluate(()=>localStorage.getItem('dreamwishwand:moodboards:v1:backup')!==null));
   await review.click();
   const dialog=page.getByRole('dialog');await dialog.waitFor({state:'visible'});
   assert.equal(await button.getAttribute('aria-pressed'),'false');
   await dialog.getByRole('button').first().click();
   await dialog.waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
   console.log('08WEB_DECUX28_BOARD_ICON_PLUS_CHECK_LOCALSTATE_CHROME_PASS_'+width);
  }finally{await page.close();await ctx.close();}
 }
 assert.deepEqual(errors,[]);
 console.log('08WEB_DECUX28_CONTROLLED_MOODBOARD_ICONS_TWO_VIEWPORT_PASS');
}finally{await browser.close();}
