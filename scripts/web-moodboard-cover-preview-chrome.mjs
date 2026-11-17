import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 for(const width of [1366,320]){
  const ctx=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'});
  const page=await ctx.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  try{
   await page.goto('http://127.0.0.1:4298/web/moodboards/',{waitUntil:'domcontentloaded'});
   const entries=page.locator('[data-moodboard-root-card]');
   assert.equal(await entries.count(),0);
   const create=page.locator('form.new-board');
   await create.locator('input').fill('First local Moodboard');
   await create.locator('button[type=submit]').click();
   await entries.first().waitFor();
   assert.equal(await entries.count(),1);
   const add=page.locator('form.add-reference');
   await add.locator('select').selectOption('NOTE');
   await add.locator('input').first().fill('Local plant composition');
   await add.locator('textarea').fill('soft green and warm light');
   await add.locator('button[type=submit]').click();
   const first=entries.first();
   const cover=first.locator('[data-moodboard-cover]');
   assert.equal(await cover.locator('span').count(),4);
   assert.equal(await cover.locator('span').first().innerText(),'soft green and warm light');
   assert.equal(await cover.locator('span[data-cover-type="NOTE"]').count(),1);
   await create.locator('input').fill('Second local Moodboard');
   await create.locator('button[type=submit]').click();
   assert.equal(await entries.count(),2);
   assert.equal(await entries.nth(1).locator('button').first().getAttribute('aria-pressed'),'true');
   const firstMenu=entries.first().locator('[data-moodboard-root-menu]');
   assert.equal(await firstMenu.evaluate(el=>el.open),false);
   await firstMenu.locator('summary').focus();
   assert.equal(await firstMenu.locator('summary').evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press('Enter');
   assert.equal(await firstMenu.evaluate(el=>el.open),true);
   await firstMenu.locator('button').click();
   assert.equal(await entries.count(),1);
   assert.ok((await entries.first().innerText()).includes('Second local Moodboard'),'targeted delete must preserve selected other board');
   assert.equal(await entries.first().locator('button').first().getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-moodboard-workspace-menu]').count(),1);
   const backup=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('dreamwishwand:moodboards')));
   assert.ok(backup.includes('dreamwishwand:moodboards:v1'));
   assert.ok(backup.includes('dreamwishwand:moodboards:v1:backup'));
   assert.equal(await page.locator('input[data-moodboard-import-file]').count(),1);
   const horizontal=await page.evaluate(()=>Math.abs(document.documentElement.scrollWidth-innerWidth)<=2);
   assert.equal(horizontal,true,'mobile overflow not permitted');
   console.log('08WEB_MOODBOARD_LOCAL_COVER_TARGET_DELETE_CHROME_PASS_'+width);
  }finally{await page.close();await ctx.close();}
 }
 assert.deepEqual(errors,[]);
 console.log('08WEB_DECUX43_MANAGEMENT_LOCAL_STORAGE_2VIEWPORT_CHROME_PASS');
}finally{await browser.close()}
