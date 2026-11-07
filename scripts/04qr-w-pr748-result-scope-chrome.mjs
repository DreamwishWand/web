// 04 QR-W independent installed local Chromium for PR748 COL-UX-42 result scope.
// Public synthetic catalog only; NO encrypted Save, ownership, Provider, Native Writer or hosted release.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const chromeBin=process.env.CHROME_BIN;
if(!chromeBin)throw Error('QR748_CHROME_BIN_REQUIRED');
const origin=(process.env.QR748_URL??'http://127.0.0.1:4299').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:chromeBin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage();
const errors=[],writes=[],sockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>sockets.push(w.url()));
ctx.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||r.method()!=='GET')writes.push(r.method()+' '+r.url());});
const section=()=>page.locator('[data-stage1-collection-root]');
const search=()=>page.locator('[data-stage1-search]');
const rootSnapshot=()=>page.evaluate(()=>{
 const r=document.querySelector('[data-stage1-collection-root]')?.getBoundingClientRect();
 if(!r)throw Error('QR748_MISSING_ROOT');
 const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
 return {y:window.scrollY,x:window.scrollX,target:Math.min(Math.max(0,window.scrollY+r.top),max),max,rootTop:r.top};
});
const afterFrames=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const atRoot=async label=>{
 await page.waitForFunction(()=>{
  const b=document.querySelector('[data-stage1-collection-root]')?.getBoundingClientRect();
  if(!b)return false;
  const target=Math.min(Math.max(0,scrollY+b.top),Math.max(0,document.documentElement.scrollHeight-innerHeight));
  return Math.abs(scrollY-target)<=4;
 },null,{timeout:7000});
 const before=await rootSnapshot();
 await afterFrames();
 const after=await rootSnapshot();
 assert.ok(Math.abs(after.y-after.target)<=4,label+' stable root '+JSON.stringify({before,after}));
};
const scrollDeep=async(distance=460)=>{
 const r=await page.evaluate(n=>{
  const el=document.querySelector('[data-stage1-collection-root]');
  const base=scrollY+el.getBoundingClientRect().top;
  const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
  const target=Math.min(max,base+n);
  window.scrollTo({top:target,behavior:'instant'});
  return {base,at:scrollY,max};
 },distance);
 assert.ok(r.at-r.base>60,'must prove genuinely deep fixture: '+JSON.stringify(r));
 return r;
};
const editSearch=async text=>{
 await search().evaluate((el,value)=>{
  el.value=value;
  el.dispatchEvent(new Event('input',{bubbles:true}));
 },text);
};
try{
 await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded',timeout:30000});
 await section().waitFor({timeout:25000});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:25000});
 assert.equal(await page.locator('.category-card').count(),29);
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
 await page.locator('#site-locale').selectOption('ja');
 const searchEl=search();
 await searchEl.focus();
 const deep1=await scrollDeep(530);
 await editSearch('40000047');
 await page.locator('[data-stage1-search-groups] .item-section').first().waitFor({timeout:25000});
 await atRoot('deep search changes result scope');
 assert.equal(await search().inputValue(),'40000047');
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-stage1-search')),true,'keyboard focus remains with search');
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0,'stale Info closed');
 console.log('QR748_CHROME_DEEP_SEARCH_POST_TICK_INSTANT_SCOPE_AND_KEYBOARD_FOCUS_PASS '+JSON.stringify(deep1));

 // Rapid successive input changes before Svelte tick: latest query and reset win, not stale callback.
 await scrollDeep(300).catch(()=>{});
 await page.evaluate(()=>{
  const el=document.querySelector('[data-stage1-search]');
  for(const value of ['not-a-real-item-qr748','40000047','40000048','40000047']){
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));
  }
 });
 await page.waitForFunction(()=>document.querySelector('[data-stage1-search]')?.value==='40000047');
 await page.locator('[data-stage1-search-groups] .item-section').first().waitFor();
 await atRoot('last request generation wins');
 assert.equal(await search().inputValue(),'40000047');
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0);
 console.log('QR748_CHROME_RAPID_STALE_ASYNC_LATEST_QUERY_FAIL_CLOSED_PASS');

 await editSearch('');
 await page.locator('[data-stage1-category-grid]').waitFor();
 await scrollDeep(390);
 await page.locator('[data-category="Furniture"]').evaluate(el=>el.click());
 await page.locator('[data-stage1-category-browse] .item-section').first().waitFor();
 await atRoot('category browse after changed root');
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0);
 // Revert to root while deep in furniture view, not stranded at prior item position.
 await scrollDeep(400);
 await page.locator('.back-category').evaluate(el=>el.click());
 await page.locator('[data-stage1-category-grid]').waitFor();
 await atRoot('back to root');
 console.log('QR748_CHROME_CATEGORY_AND_BACK_SCOPE_SCROLL_AFTER_DOM_PASS');

 // Desktop facet mutation scrolls only changed result scope; clicking test uses DOM click to avoid Playwright auto-scroll.
 await page.locator('.filter-toggle').click();
 const world=page.locator('#collection-filters fieldset').first().locator('button');
 const universe=page.locator('#collection-filters fieldset').nth(1).locator('button');
 assert.ok(await world.count()>=2&&await universe.count()>=1);
 await scrollDeep(450);
 await world.first().evaluate(el=>el.click());
 assert.equal(await world.first().getAttribute('aria-pressed'),'true');
 await atRoot('desktop world facet');
 await world.nth(1).evaluate(el=>el.click());
 await universe.first().evaluate(el=>el.click());
 await atRoot('desktop World OR Universe AND');
 assert.equal(await page.locator('.active-filters button').count(),4);
 await page.locator('.active-filters .clear').evaluate(el=>el.click());
 await atRoot('desktop clear facet');
 assert.equal(await page.locator('.active-filters').count(),0);
 await page.locator('.filter-toggle').click();
 console.log('QR748_CHROME_DESKTOP_FACETS_OR_AND_AND_CLEAR_SCOPE_PASS');

 // 320px modal must not change the background scroll when choices modify results.
 await page.setViewportSize({width:320,height:800});
 // Inherited locale switching accepted by prior QR745; avoid hidden mobile selector auto-wait.
 await page.locator('[data-stage1-category-grid]').waitFor();
 await scrollDeep(620);
 const savedOverflow=await page.evaluate(()=>document.body.style.overflow);
 await page.locator('.filter-toggle').evaluate(el=>el.click());
 const dialog=page.locator('#collection-filters[role="dialog"][aria-modal="true"]');
 await dialog.waitFor();
 await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-stage1-filter-close'));
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 const snapBackground=()=>page.evaluate(()=>({y:scrollY,h:document.documentElement.scrollHeight,overflow:document.body.style.overflow,active:document.activeElement?.getAttribute('data-stage1-filter-close')!==null,rootTop:document.querySelector('[data-stage1-collection-root]')?.getBoundingClientRect().top,chipCount:document.querySelectorAll('.active-filters button').length}));
 const beforeFacet=await snapBackground();
 const mw=dialog.locator('fieldset').first().locator('button');
 const mu=dialog.locator('fieldset').nth(1).locator('button');
 await mw.first().evaluate(el=>el.click());
 await afterFrames();
 const afterWorld1=await snapBackground();
 await mw.nth(1).evaluate(el=>el.click());
 await afterFrames();
 const afterWorld2=await snapBackground();
 await mu.first().evaluate(el=>el.click());
 await afterFrames();
 const afterUniverse1=await snapBackground();
 console.log('QR748_MOBILE_DEFER_SCROLL_DIAGNOSTIC '+JSON.stringify({beforeFacet,afterWorld1,afterWorld2,afterUniverse1}));
 const initialBackgroundY=beforeFacet.y;
 const duringBackgroundY=afterUniverse1.y;
 const backgroundDrift=duringBackgroundY-initialBackgroundY;
 if(backgroundDrift!==0)console.log('QR748_TRUE_RED_MOBILE_BACKGROUND_SCROLL_DURING_OPEN_SHEET '+JSON.stringify({initialBackgroundY,duringBackgroundY,backgroundDrift}));
 // Continue positive checks to isolate failures; final assertion still fails closed on this red.
 assert.equal(await mw.first().getAttribute('aria-pressed'),'true');
 assert.equal(await mw.nth(1).getAttribute('aria-pressed'),'true');
 assert.equal(await mu.first().getAttribute('aria-pressed'),'true');
 await page.locator('[data-stage1-filter-close]').focus();
 await page.keyboard.press('Shift+Tab');
 assert.equal(await mu.last().evaluate(el=>el===document.activeElement),true,'reverse Tab remains trapped');
 await page.keyboard.press('Tab');
 assert.equal(await page.locator('[data-stage1-filter-close]').evaluate(el=>el===document.activeElement),true,'Tab remains trapped');
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 assert.equal(await page.evaluate(()=>document.body.style.overflow),savedOverflow);
 await atRoot('deferred mobile scope after close');
 assert.equal(await page.locator('.active-filters button').count(),4);
 console.log('QR748_CHROME_320_MOBILE_THREE_FACETS_NO_BACKGROUND_SCROLL_DEFERRED_ONE_CLOSE_PASS '+JSON.stringify({initialBackgroundY,duringBackgroundY}));

 // Fresh mobile filter close through backdrop also returns keyboard focus and scroll.
 await page.locator('.filter-toggle').evaluate(el=>el.click());
 await dialog.waitFor();
 const beforeBackdrop=await page.evaluate(()=>scrollY);
 await mw.first().evaluate(el=>el.click());
 assert.equal(await page.evaluate(()=>scrollY),beforeBackdrop);
 await page.locator('[data-stage1-filter-backdrop]').evaluate(el=>el.click());
 await dialog.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 await atRoot('backdrop deferred reset');
 console.log('QR748_CHROME_BACKDROP_SCOPE_RESET_AND_FOCUS_PASS');

 await page.locator('.active-filters .clear').evaluate(el=>el.click());
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await page.locator('.filter-toggle').evaluate(el=>el.click());
 await dialog.waitFor();
 const geo=await page.locator('[data-stage1-filter-close]').boundingBox();
 assert.ok(geo&&geo.y>=0&&geo.y+geo.height<=904,'close reachable at CSS zoom200');
 await page.locator('[data-stage1-filter-close]').evaluate(el=>el.click());
 await dialog.waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>document.body.style.overflow),savedOverflow,'zoom-only close should unlock body; no fake result-change reset expected');
 assert.equal(await page.locator('.personal-state button:disabled').count(),2);
 assert.deepEqual(writes,[],'no off-origin or nonGET/Writer/Save calls');
 assert.deepEqual(sockets.filter(u=>!/^ws:\/\/127\.0\.0\.1:4299\/\?token=[A-Za-z0-9_-]+$/.test(u)),[],'only localhost Vite HMR websocket allowed');
 assert.deepEqual(errors,[],'no unhandled page errors');
 console.log('QR748_CHROME_ZOOM200_FOCUS_NO_WRITER_PROVIDER_OR_EXTERNAL_NETWORK_PASS');
 assert.equal(backgroundDrift,0,'mobile modal MUST defer background scroll during three facet updates; changed root layout must not auto-anchor');
}finally{await ctx.close();await browser.close();}
console.log('QR748_INDEPENDENT_LOCAL_CHROME_ALL_PASS');