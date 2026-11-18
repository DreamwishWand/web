import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
const root='http://127.0.0.1:4298/web/explore/';
const storageKey='dreamwishwand:explore:wand-favorites:v1';
const backupKey=storageKey+':previous';
try{
 for(const width of [1366,320]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  const writes=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+':'+r.url());});
  try{
   await page.goto(root,{waitUntil:'domcontentloaded',timeout:30000});
   const card=page.locator('article.card').first();
   await card.waitFor({state:'visible',timeout:30000});
   const id=Number(await card.locator('[data-explore-wand-favorite]').getAttribute('data-item-id'));
   assert.ok(Number.isSafeInteger(id)&&id>0);
   const wand=card.locator('[data-explore-wand-favorite]');
   const moodboard=card.locator('[data-explore-moodboard-toggle]');
   assert.equal(await moodboard.isDisabled(),true,'no Moodboard required to use Wand Favorite');
   assert.equal(await wand.getAttribute('aria-pressed'),'false');
   assert.equal(await wand.locator('svg[aria-hidden="true"]').count(),1);
   assert.ok((await wand.locator('svg path').first().getAttribute('d')).startsWith('M12 2c.8 5.3'),'first-party four-point sparkle path');
   const rect=await wand.boundingBox();assert.ok(rect?.height>=44&&rect.width>=44,'accessible touch size');
   await wand.click();
   assert.equal(await wand.getAttribute('aria-pressed'),'true');
   assert.equal(await moodboard.isDisabled(),true,'Wand toggle must not create a Moodboard');
   assert.equal(await page.locator('[data-explore-card-review]').first().count(),1);
   const raw=await page.evaluate(k=>localStorage.getItem(k),storageKey);
   assert.deepEqual(JSON.parse(raw),{schema:'wand.explore.local-favorites@1',version:1,itemIds:[id]});
   const filter=page.locator('[data-explore-wand-favorites-only]');
   await filter.click();
   assert.equal(await filter.getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('article.card').count(),1,'favorite-only filter reflects local actual saved state');
   await filter.click();
   assert.equal(await filter.getAttribute('aria-pressed'),'false');
   const second=await context.newPage();
   try{
    second.on('pageerror',e=>errors.push(String(e)));
    await second.goto(root,{waitUntil:'domcontentloaded',timeout:30000});
    const same=second.locator('article.card [data-explore-wand-favorite]').first();
    await same.waitFor({state:'visible'});
    assert.equal(await same.getAttribute('aria-pressed'),'true','second tab independently reopens local favorite');
    await same.focus();await second.keyboard.press('Enter');
    assert.equal(await same.getAttribute('aria-pressed'),'false');
    await page.waitForFunction(id=>{
      const el=document.querySelector('[data-explore-wand-favorite][data-item-id="'+id+'"]');
      return el?.getAttribute('aria-pressed')==='false';
    },id);
   }finally{await second.close()}
   const state=await page.evaluate(([key,previous])=>({
    current:JSON.parse(localStorage.getItem(key)),
    prev:JSON.parse(localStorage.getItem(previous)),
    keys:Object.keys(localStorage).filter(k=>k.startsWith('dreamwishwand:'))
   }),[storageKey,backupKey]);
   assert.deepEqual(state.current.itemIds,[]);
   assert.deepEqual(state.prev.itemIds,[id],'previous local snapshot survives second tab update');
   assert.ok(state.keys.includes(storageKey)&&state.keys.includes(backupKey));
   assert.ok(!state.keys.includes('dreamwishwand:moodboards:v1'),'Wand Favorite does not create or mutate Moodboard');
   await page.reload({waitUntil:'domcontentloaded'});
   const reopened=page.locator('article.card [data-explore-wand-favorite]').first();
   await reopened.waitFor({state:'visible'});
   assert.equal(await reopened.getAttribute('aria-pressed'),'false','independent reopen after removal');

   // A real browser may throw after a primary setItem took effect, then deny
   // compensating the primary. Even then the old Previous raw bytes must
   // survive independently; the UI must not assert successful Favorite add.
   const beforePartial=await page.evaluate(([main,prior])=>({
    main:localStorage.getItem(main),prior:localStorage.getItem(prior)
   }),[storageKey,backupKey]);
   await page.evaluate(main=>{
    window.__wandOriginalSetItem=Storage.prototype.setItem;
    window.__wandPrimaryAttempts=0;
    Storage.prototype.setItem=function(key,value){
     if(key===main){
      if(++window.__wandPrimaryAttempts===1){
       window.__wandOriginalSetItem.call(this,key,value);
       throw new DOMException('partial quota','QuotaExceededError');
      }
      throw new DOMException('rollback denied','QuotaExceededError');
     }
     return window.__wandOriginalSetItem.call(this,key,value);
    };
   },storageKey);
   try{
    await reopened.click();
    assert.equal(await reopened.getAttribute('aria-pressed'),'false',
      'a denied commit cannot switch displayed Wand Favorite to saved');
    const status=await page.locator('.status[role="status"]').innerText();
    assert.ok(status.length>12,'storage failure must be visible without internal exception');
    const afterPartial=await page.evaluate(([main,prior])=>({
     main:localStorage.getItem(main),prior:localStorage.getItem(prior)
    }),[storageKey,backupKey]);
    assert.equal(afterPartial.prior,beforePartial.prior,
      'older previous bytes are recoverable despite blocked primary compensation');
    assert.notEqual(afterPartial.main,beforePartial.main,
      'partial mutation cannot be called a confirmed save');
   }finally{
    await page.evaluate(()=>{Storage.prototype.setItem=window.__wandOriginalSetItem});
   }
   await page.reload({waitUntil:'domcontentloaded'});
   const recovered=page.locator('article.card [data-explore-wand-favorite]').first();
   await recovered.waitFor({state:'visible'});
   assert.equal(await recovered.getAttribute('aria-pressed'),'true',
     'independent reload reflects actual partial current, not optimistic failed UI');
   console.log('08WEB_WAND_FAVORITE_PARTIAL_PRIMARY_ROLLBACK_DENIED_PRIOR_RECOVERABLE_'+width+'_PASS');

   if(width===320){
    await page.setViewportSize({width:640,height:900});
    await page.evaluate(()=>{document.documentElement.style.zoom='2'});
    assert.ok(await page.locator('[data-explore-wand-favorites-only]').isVisible());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'200% zoom layout');
   }else{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'desktop no overflow');
   }
   assert.deepEqual(writes,[],'no game Save/Cloud external POST');
   console.log('08WEB_WAND_FAVORITE_SPARKLE_LOCAL_ONLY_BACKUP_CROSSTAB_CHROME_PASS_'+width);
  }finally{await page.close();await context.close()}
 }
 assert.deepEqual(errors,[]);
 console.log('08WEB_DECUX31_34_WAND_FAVORITE_INDEPENDENT_GAMEFAVORITE_TWO_VIEWPORT_PASS');
}finally{await browser.close()}
