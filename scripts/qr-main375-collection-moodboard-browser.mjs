// 04 QR independent actual Chromium of MERGED PR373+PR375 main user operation.
// No personal P1G, Provider, managed service or Game art. Source-only Catalog v1.25.0.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const ROOT='http://127.0.0.1:4199', ITEM='40000047';
const PATH='/en/'+ITEM+'/';
const BIN=process.env.CHROME_BIN;
assert.ok(BIN,'Chrome executable required');
const browser=await chromium.launch({executablePath:BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const page=await ctx.newPage(),errors=[],outbound=[];
page.on('pageerror',error=>errors.push(String(error)));
ctx.on('request',request=>{
 const u=new URL(request.url());
 if(request.method()!=='GET'||u.origin!==ROOT) outbound.push(request.method()+' '+u.href);
});
function mark(name){console.log('QR_MAIN375_'+name+'_PASS');}
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1')||'null'));
try {
 await page.goto(ROOT+'/moodboards/',{waitUntil:'networkidle'});
 await page.locator('form.create-board').waitFor();
 // Ensure Svelte hydration, not merely server rendered form, has completed.
 await page.waitForTimeout(650);
 await page.locator('form.create-board input').first().fill('Independent November Board');
 await page.locator('form.create-board button[type=submit]').click();
 await page.locator('.board-list>button').filter({hasText:'Independent November Board'}).waitFor({timeout:25000});
 let doc=await saved();
 assert.equal(doc.boards.length,1);
 assert.deepEqual(doc.boards[0].references,[]);
 mark('ACTUAL_LOCAL_BOARD_CREATED');
 await page.goto(ROOT+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('.collection-grid .collection-card').first().waitFor({timeout:35000});
 await page.locator('.collection-controls input[type=search]').fill(ITEM);
 await page.locator('.collection-grid .collection-card').filter({hasText:ITEM}).first().waitFor();
 await page.locator('.collection-card h2 a').first().click();
 await page.locator('[data-shared-entity-detail="preview"] h1').waitFor({timeout:30000});
 assert.ok(page.url().endsWith(PATH),page.url());
 assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('data-writer'),'off');
 assert.equal(await page.locator('[data-shared-entity-detail]').getAttribute('data-public-indexable'),'false');
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');
 assert.match(await page.locator('.entity-grid').innerText(),/Nintendo Switch.*DDV v1\.25\.0/s);
 assert.equal(await page.locator('[data-shared-detail-moodboard-action]').count(),1);
 mark('COLLECTION_TO_SOURCE_BOUND_SHARED_ITEM_DETAIL');
 await page.locator('#shared-entity-board').selectOption({index:0});
 await page.locator('[data-shared-detail-moodboard-action] button').click();
 await page.locator('[data-shared-detail-moodboard-action] [role=status]').waitFor();
 doc=await saved();
 assert.equal(doc.boards[0].references.length,1);
 assert.equal(doc.boards[0].references[0].type,'ITEM');
 assert.equal(doc.boards[0].references[0].entityId,ITEM);
 let backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('dreamwishwand:moodboards:v1:backup')));
 assert.equal(backup.boards[0].references.length,0);
 mark('LOCAL_TYPED_REFERENCE_AND_ORIGINAL_FIRST_BACKUP');
 await page.goto(ROOT+'/explore/',{waitUntil:'domcontentloaded'});
 await page.locator('.grid .card').first().waitFor({timeout:30000});
 await page.locator('.controls input[type=search]').fill(ITEM);
 await page.locator('.grid .card').filter({hasText:ITEM}).first().waitFor();
 await page.locator('.card footer a').first().click();
 await page.locator('[data-shared-entity-detail="preview"] h1').waitFor({timeout:30000});
 assert.ok(page.url().endsWith(PATH));
 await page.locator('[data-shared-detail-moodboard-action] button').click();
 await page.locator('[data-shared-detail-moodboard-action] [role=status]').waitFor();
 doc=await saved();
 assert.equal(doc.boards[0].references.length,1,'repeated add must deduplicate stable ItemID');
 mark('EXPLORE_TO_SAME_DETAIL_AND_ITEM_DEDUP');
 await page.goto(ROOT+'/moodboards/',{waitUntil:'domcontentloaded'});
 await page.locator('.reference-card').filter({hasText:ITEM}).waitFor({timeout:20000});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.reference-card').filter({hasText:ITEM}).waitFor({timeout:20000});
 assert.equal(await page.locator('.reference-card').filter({hasText:ITEM}).count(),1);
 mark('MOODBOARD_PERSISTS_ACROSS_FULL_RELOAD');
 await page.goto(ROOT+'/en/999999999/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-shared-entity-detail="preview"] h1').waitFor();
 assert.equal(await page.locator('[data-shared-detail-moodboard-action]').count(),0);
 assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,follow');
 assert.deepEqual((await saved()).boards[0].references.map(r=>r.entityId),[ITEM]);
 mark('INVALID_ITEM_FAILCLOSED_NO_LOCAL_WRITE');
 await page.setViewportSize({width:320,height:780});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2));
 assert.deepEqual(outbound,[],'local file/Board data must never be uploaded');
 assert.deepEqual(errors,[],'no uncaught browser exceptions');
 mark('MOBILE_NO_UNAPPROVED_NETWORK_OR_BROWSER_ERRORS');
 console.log('QR_MAIN375_INDEPENDENT_ACTUAL_CHROMIUM_LOCAL_MOODBOARD_TARGETED_PASS');
} finally {
 await ctx.close();
 await browser.close();
}
