import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

assert.ok(process.env.CHROME_BIN,'Installed Chrome required');
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const failures=[];
try {
 for (const width of [1366,320]) {
  const context=await browser.newContext({viewport:{width,height:880},serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(String(e)));
  const unexpected=[];
  page.on('request',r=>{if(r.method()!=='GET')unexpected.push(r.method()+':'+r.url());});
  try {
   await page.goto('http://127.0.0.1:4298/web/moodboards/',{waitUntil:'domcontentloaded',timeout:30000});
   const form=page.locator('form.new-board');
   const list=page.locator('[data-moodboard-root-grid]');
   const grid=list.locator('.board-card-grid');
   const entries=list.locator('[data-moodboard-root-card]');
   assert.equal(await form.locator('input').count(),1,'direct creation has one field');
   assert.equal(await form.locator('textarea').count(),0,'description is no longer mandatory upfront');
   assert.equal(await entries.count(),0);
   async function create(title,count){
    await form.locator('input').fill(title);
    const button=form.locator('button[type=submit]');
    const rect=await button.boundingBox();
    assert.ok(rect?.height>=44,'New Moodboard is a 44px action');
    await button.click();
    await page.waitForFunction(expected=>document.querySelectorAll('[data-moodboard-root-card]').length===expected,count);
    await page.waitForFunction(expected=>document.querySelector('[data-moodboard-workspace-title]')?.textContent?.trim()===expected,title);
    await page.waitForFunction(()=>document.querySelector('[data-moodboard-workspace-title]')===document.activeElement);
    assert.equal(await form.locator('input').inputValue(),'','creation clears only the title form');
   }
   await create('Garden inspiration',1);
   const add=page.locator('form.add-reference');
   await add.locator('select').first().selectOption('NOTE');
   await add.locator('input').first().fill('Flower corner');
   await add.locator('textarea').fill('soft greens');
   await add.locator('button[type=submit]').click();
   assert.equal(await page.locator('.reference-card').count(),1);
   await create('Cozy kitchen',2);
   await create('Winter village',3);
   assert.equal(await grid.count(),1);
   const bounds=await Promise.all([entries.nth(0).boundingBox(),entries.nth(1).boundingBox()]);
   assert.ok(bounds[0]&&bounds[1]);
   if(width===1366)assert.ok(Math.abs(bounds[0].y-bounds[1].y)<=1,'desktop root board cards must be in grid row');
   else assert.ok(bounds[1].y>bounds[0].y+20,'phone root board cards must stack without overflow');
   assert.equal(await entries.nth(2).locator('button').first().getAttribute('aria-pressed'),'true');
   await entries.nth(0).locator('button').first().click();
   assert.equal((await page.locator('[data-moodboard-workspace-title]').innerText()).trim(),'Garden inspiration');
   assert.ok((await page.locator('.reference-card').first().innerText()).includes('Flower corner'),'existing board content retained');
   assert.equal(await entries.nth(0).locator('[data-moodboard-root-menu] summary').count(),1);
   const data=await page.evaluate(()=>({
     keys:Object.keys(localStorage),
     boards:JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')||'{}').boards?.map(b=>({title:b.title,refs:b.references.length}))??[]
   }));
   assert.deepEqual(data.boards.map(b=>b.title),['Garden inspiration','Cozy kitchen','Winter village']);
   assert.equal(data.boards[0].refs,1);
   assert.ok(data.keys.includes('dreamwishwand:moodboards:v1:backup'),'previous valid snapshot still available');
   assert.ok(await page.locator('input[data-moodboard-import-file]').count()===1,'existing backup and import unchanged');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no horizontal overflow');
   assert.deepEqual(unexpected,[],'no off-device mutation');
   console.log('08WEB_DECUX24_ROOT_GRID_DIRECT_CREATE_WORKSPACE_FOCUS_PASS_'+width);
  } finally {await page.close();await context.close();}
 }
 assert.deepEqual(failures,[]);
 console.log('08WEB_DECUX24_LOCAL_3BOARDS_CONTENT_BACKUP_RESPONSIVE_CHROME_PASS');
} finally {await browser.close();}
