// Actual Chrome acceptance for Stage 1 Collection visual structure, not Native Save proof.
// No unlicensed game imagery, real P1G, personal state, Provider or public publishing.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { STAGE1_COLLECTION_ORDER,stage1CategoryLabel } from '../src/lib/collection/stage1-root.mjs';
const bin=process.env.CHROME_BIN;
if(!bin)throw Error('CHROME_BIN_REQUIRED');
const root=(process.env.STAGE1_COLLECTION_URL||'http://127.0.0.1:4285').replace(/\/$/,'');
const locales=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});
const page=await context.newPage();
const errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',r=>{
 const u=new URL(r.url());
 if(u.origin!==root||r.method()!=='GET')writes.push(r.method()+' '+r.url());
});
const fit=async name=>{
 const r=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
 assert.ok(r.s<=r.w+2,name+' horizontal overflow '+JSON.stringify(r));
};
try{
 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] [data-category="Furniture"]').waitFor({timeout:45000});
 for(const locale of locales){
  await page.selectOption('#site-locale',locale);
  await page.locator('[data-stage1-category-grid] [data-category="Furniture"]').waitFor();
  assert.equal(await page.locator('.category-card').count(),29,locale);
  const order=await page.locator('.category-card').evaluateAll(cards=>cards.map(x=>x.getAttribute('data-category')));
  assert.deepEqual(order,STAGE1_COLLECTION_ORDER,locale+' category order');
  const diagnostic=await page.evaluate(()=>({lang:document.documentElement.lang,language:document.documentElement.dataset.locale,desktop:document.querySelector('#site-locale')?.value,mobile:document.querySelector('#site-locale-mobile')?.value,stored:localStorage.getItem('dreamwishwand-locale-manual-v1')}));
  console.log('WEB_STAGE1_COLLECTION_LOCALE_DIAGNOSTIC',locale,JSON.stringify(diagnostic));
  const expected=stage1CategoryLabel(locale,'Furniture');
  await page.locator('[data-category="Furniture"] .category-name').getByText(expected,{exact:true}).waitFor({timeout:20000});
  assert.equal(await page.locator('[data-category="Furniture"] .category-name').innerText(),expected);
  assert.equal(await page.locator('.category-measure').count(),29);
  assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
  assert.equal(await page.locator('.view-switch').count(),0);
  assert.equal(await page.locator('.collection-card').count(),0,'no flat item root');
 }
 console.log('WEB_STAGE1_COLLECTION_29_CATEGORY_8LOCALE_PASS');
 await page.selectOption('#site-locale','ja');
 await page.locator('[data-category="Furniture"]').click();
 await page.locator('[data-stage1-category-browse] .item-card').first().waitFor({timeout:25000});
 assert.ok(await page.locator('[data-stage1-category-browse] .item-section').count()>0);
 await page.locator('[data-stage1-category-browse] .item-card').first().click();
 await page.locator('[data-stage1-item-info]').waitFor();
 const full=await page.locator('[data-stage1-item-info] a').getAttribute('href');
 assert.match(full,/\/[1-9][0-9]*\/$/);
 await page.locator('[data-stage1-item-info] button').click();
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0);
 // COL-UX-29 keyboard: deep scroll + focus return, then newer card supersedes old.
 const furnitureCards=page.locator('[data-stage1-category-browse] .item-card');
 const furnitureCount=await furnitureCards.count();
 assert.ok(furnitureCount>=3,'deep-card return fixture');
 const deepIndex=Math.min(18,furnitureCount-2),deep=furnitureCards.nth(deepIndex),another=furnitureCards.nth(deepIndex+1);
 await deep.scrollIntoViewIfNeeded();
 await deep.focus();
 // The product captures scrollY during the card's click handler, NOT at pre-Enter focus.
 // A keyboard default-action can scroll between the focused snapshot and synthetic click.
 const focusedScroll=await page.evaluate(()=>window.scrollY);
 // Negative example: a genuine 14px position change occurs between initial focus and Enter.
 // The product must restore click-time rather than incorrectly comparing to pre-Enter focus.
 await page.evaluate(y=>window.scrollTo(window.scrollX,y+14),focusedScroll);
 const beforeEnterScroll=await page.evaluate(()=>window.scrollY);
 assert.ok(beforeEnterScroll-focusedScroll>=10,'synthetic 14px keyboard pre-click delta not exercised');
 const deepId=await deep.getAttribute('data-stage1-item-id');
 await deep.evaluate(el=>{
   el.addEventListener('click',()=>{
     const rect=el.getBoundingClientRect();
     window.__collectionClickTimeScroll={y:window.scrollY,x:window.scrollX,id:el.getAttribute('data-stage1-item-id'),cardTop:rect.top,cardBottom:rect.bottom};
   },{capture:true,once:true});
 });
 await page.keyboard.press('Enter');
 await page.locator('[data-stage1-item-info]').waitFor();
 const clickTime=await page.evaluate(()=>window.__collectionClickTimeScroll);
 assert.ok(clickTime&&Number.isFinite(clickTime.y),'keyboard click-time scroll capture missing');
 assert.equal(clickTime.id,deepId,'source click-time ID must match origin card');
 assert.ok(clickTime.y-focusedScroll>=10,'click-time must record intentional scroll delta, not earlier focus');
 const beforeClose=await page.evaluate(()=>window.scrollY);
 await page.locator('[data-stage1-info-close]').focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-stage1-item-id')===id,deepId);
 const returnedScroll=await page.evaluate(()=>window.scrollY);
 console.log('WEB_STAGE1_COLLECTION_COL_UX29_SCROLL_EVENT_TRACE',JSON.stringify({focusedScroll,beforeEnterScroll,clickTime,beforeClose,returnedScroll}));
 assert.ok(Math.abs(returnedScroll-clickTime.y)<=4,'scroll restored to actual click-time '+clickTime.y+' -> '+returnedScroll);
 assert.equal(await furnitureCards.count(),furnitureCount,'filter and page context retained');
 await deep.click(); await page.locator('[data-stage1-item-info]').waitFor();
 await another.click();
 const newId=await another.getAttribute('data-stage1-item-id');
 await page.locator('[data-stage1-info-close]').click();
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-stage1-item-id')===id,newId);
 assert.notEqual(newId,deepId);
 console.log('WEB_STAGE1_COLLECTION_COL_UX29_DEEP_SCROLL_FOCUS_STALE_SELECTION_PASS');
 // COL-UX-42 actual result-set change must not strand the keyboard user at old item depth.
 const scopeTop=async()=>page.evaluate(()=>{
   const root=document.querySelector('[data-stage1-collection-root]');
   if(!root)throw new Error('COL_UX42_ROOT_MISSING');
   const top=Math.max(0,window.scrollY+root.getBoundingClientRect().top);
   return Math.min(top,Math.max(0,document.documentElement.scrollHeight-innerHeight));
 });
 await page.locator('[data-stage1-search]').focus();
 const beforeScopeTop=await scopeTop();
 const beforeSearchDeep=await page.evaluate(top=>{
   const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
   window.scrollTo({top:Math.min(max,top+350),behavior:'instant'});
   return window.scrollY;
 },beforeScopeTop);
 assert.ok(beforeSearchDeep>beforeScopeTop+50,'deep-result scroll test fixture must be genuinely deep');
 await page.locator('[data-stage1-search]').evaluate(input=>{
   input.value='40000047';
   input.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.locator('[data-stage1-search-groups] .item-section').first().waitFor();
 await page.waitForFunction(()=>{
   const root=document.querySelector('[data-stage1-collection-root]');
   const top=Math.max(0,window.scrollY+root.getBoundingClientRect().top);
   const expected=Math.min(top,Math.max(0,document.documentElement.scrollHeight-innerHeight));
   return Math.abs(window.scrollY-expected)<=4;
 });
 assert.equal(await page.locator('[data-stage1-search]').inputValue(),'40000047');
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-stage1-search')),true,'search retains focus');
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0,'old item Info must not persist');
 console.log('WEB_STAGE1_COLLECTION_COL_UX42_SEARCH_SCOPE_SCROLL_RESET_PASS');
 await page.locator('[data-stage1-search]').fill('');
 await page.locator('[data-stage1-category-browse]').waitFor();
 await page.locator('.back-category').click();
 await page.locator('[data-stage1-category-grid]').waitFor();
 console.log('WEB_STAGE1_COLLECTION_CATEGORY_TO_UNIVERSE_TO_INFO_RETURN_PASS');
 await page.locator('.filter-toggle').click();
 const options=page.locator('.filter-panel fieldset').first().locator('button');
 await options.first().click();
 await options.nth(1).click();
 assert.equal(await page.locator('.active-filters button').count(),3,'two world chips + clear');
 assert.equal(await options.first().getAttribute('aria-pressed'),'true');
 assert.equal(await options.nth(1).getAttribute('aria-pressed'),'true');
 await page.locator('.active-filters .clear').click();
 assert.equal(await page.locator('.active-filters').count(),0);
 console.log('WEB_STAGE1_COLLECTION_SCOPE_MULTI_OR_AND_CHIPS_PASS');
 await page.locator('[data-stage1-search]').fill('40000047');
 await page.locator('[data-stage1-search-groups] .item-section').first().waitFor({timeout:20000});
 assert.equal(await page.locator('[data-stage1-search-groups] .item-section').count()>0,true);
 assert.equal(await page.locator('[data-stage1-category-grid]').count(),0);
 console.log('WEB_STAGE1_COLLECTION_SOURCE_SEARCH_GROUPS_PASS');
 // Query persists through close; edited query revokes old Info origin.
 const searchCard=page.locator('[data-stage1-search-groups] .item-card').first();
 await searchCard.click(); await page.locator('[data-stage1-item-info]').waitFor();
 await page.locator('[data-stage1-info-close]').click();
 assert.equal(await page.locator('[data-stage1-search]').inputValue(),'40000047');
 await searchCard.click(); await page.locator('[data-stage1-item-info]').waitFor();
 await page.locator('[data-stage1-search]').fill('no-such-item-COL-UX-29');
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0);
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-stage1-search')),true);
 console.log('WEB_STAGE1_COLLECTION_COL_UX29_CHANGED_SOURCE_DENY_PASS');
 await page.locator('[data-stage1-search]').fill('');
 // Existing desktop regression deliberately leaves Filter open; close before isolated mobile sheet test.
 if(await page.locator('#collection-filters').count())await page.locator('.filter-toggle').click();
 assert.equal(await page.locator('#collection-filters').count(),0,'pre-mobile filter state is closed');
 await page.setViewportSize({width:320,height:800});
 await page.locator('[data-stage1-category-grid]').waitFor();
 await fit('320px');
 // COL-UX-44: modal mobile filters preserve query, personal-state access and scope semantics.
 const filterButton=page.locator('.filter-toggle');
 const savedBodyOverflow=await page.evaluate(()=>document.body.style.overflow);
 assert.equal(await page.locator('[data-stage1-filter-shell]').count(),0,'closed sheet does not hide root');
 assert.equal(await page.locator('[data-stage1-search]').isVisible(),true,'Search remains available');
 assert.equal(await page.locator('.personal-state').isVisible(),true,'All/Owned/Missing remain visible');
 assert.equal(await page.locator('.personal-state button[disabled]').count(),2,'Owned and Missing remain UNKNOWN');
 await filterButton.click();
 const mobileDialog=page.locator('#collection-filters[role="dialog"][aria-modal="true"]');
 await mobileDialog.waitFor();
 assert.equal(await filterButton.getAttribute('aria-expanded'),'true');
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-stage1-filter-close'));
 const mobileWorld=mobileDialog.locator('fieldset').first().locator('button');
 const mobileUniverse=mobileDialog.locator('fieldset').nth(1).locator('button');
 const lockedBackgroundY=await page.evaluate(()=>window.scrollY);
 await mobileWorld.first().click();
 await mobileWorld.nth(1).click();
 await mobileUniverse.first().click();
 assert.equal(await page.evaluate(()=>window.scrollY),lockedBackgroundY,'facet selection must not scroll behind mobile modal');
 assert.equal(await mobileWorld.first().getAttribute('aria-pressed'),'true');
 assert.equal(await mobileWorld.nth(1).getAttribute('aria-pressed'),'true');
 assert.equal(await mobileUniverse.first().getAttribute('aria-pressed'),'true');
 await page.locator('[data-stage1-filter-close]').focus();
 await page.keyboard.press('Shift+Tab');
 assert.equal(await mobileUniverse.last().evaluate(el=>el===document.activeElement),true,'reverse Tab cycles to last');
 await page.keyboard.press('Tab');
 assert.equal(await page.locator('[data-stage1-filter-close]').evaluate(el=>el===document.activeElement),true,'Tab cycles to first');
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#collection-filters').count(),0);
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 assert.equal(await page.evaluate(()=>document.body.style.overflow),savedBodyOverflow,'body scroll restored');
 await page.waitForFunction(()=>{
   const root=document.querySelector('[data-stage1-collection-root]');
   const top=Math.max(0,window.scrollY+root.getBoundingClientRect().top);
   return Math.abs(window.scrollY-Math.min(top,Math.max(0,document.documentElement.scrollHeight-innerHeight)))<=4;
 });
 console.log('WEB_STAGE1_COLLECTION_COL_UX42_MOBILE_SCOPE_DEFER_UNTIL_CLOSE_PASS');
 assert.equal(await page.locator('.active-filters button').count(),4,'two World, one Universe and clear remain');
 await filterButton.click();
 await page.locator('[data-stage1-filter-backdrop]').click({position:{x:10,y:10}});
 assert.equal(await page.locator('#collection-filters').count(),0,'backdrop closes sheet');
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 await page.locator('.active-filters .clear').click();
 assert.equal(await page.locator('.active-filters button').count(),0,'clear preserves original semantics');
 console.log('WEB_STAGE1_COLLECTION_COL_UX44_MOBILE_SHEET_FOCUS_ESCAPE_BACKDROP_FACETS_PASS');
 await page.keyboard.press('Tab');
 assert.ok(await page.evaluate(()=>document.activeElement instanceof HTMLElement));
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await fit('200percent');
 await filterButton.click();
 await page.locator('#collection-filters[role="dialog"][aria-modal="true"]').waitFor();
 await fit('zoom200-sheet');
 const geometry=await page.evaluate(()=>{
   const r=(el)=>{const b=el?.getBoundingClientRect();return b?{x:b.x,y:b.y,bottom:b.bottom,right:b.right,width:b.width,height:b.height}:null};
   return {viewport:{w:innerWidth,h:innerHeight,visual:{w:visualViewport?.width,h:visualViewport?.height},scrollX,scrollY},htmlZoom:getComputedStyle(document.documentElement).zoom,
     shell:r(document.querySelector('.filter-shell')),panel:r(document.querySelector('#collection-filters')),close:r(document.querySelector('[data-stage1-filter-close]')),
     panelScrollTop:document.querySelector('#collection-filters')?.scrollTop,bodyOverflow:document.body.style.overflow};
 });
 console.log('WEB_STAGE1_COLLECTION_COL_UX44_ZOOM200_DIAGNOSTIC',JSON.stringify(geometry));
 assert.ok(geometry.panel.y>=-4,'sheet top remains in viewport at 200%');
 assert.ok(geometry.close.y>=0&&geometry.close.bottom<=geometry.viewport.h+4,'close control remains reachable at 200%');
 await page.locator('[data-stage1-filter-close]').click();
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 assert.equal(await page.evaluate(()=>document.body.style.overflow),savedBodyOverflow);
 console.log('WEB_STAGE1_COLLECTION_COL_UX44_ZOOM200_MOBILE_SHEET_PASS');
 assert.equal(await page.locator('.category-card').count(),29);
 console.log('WEB_STAGE1_COLLECTION_320_ZOOM200_KEYBOARD_PASS');
 // Desktop still expands facets inline and never declares modal semantics.
 await page.setViewportSize({width:1366,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await filterButton.click();
 await page.locator('#collection-filters').waitFor();
 assert.equal(await page.locator('#collection-filters').getAttribute('role'),null,'desktop is not a dialog');
 assert.equal(await page.locator('[data-stage1-filter-close]').isVisible(),false);
 assert.equal(await page.locator('.filter-backdrop').isVisible(),false);
 await filterButton.click();
 assert.equal(await page.locator('#collection-filters').count(),0);
 console.log('WEB_STAGE1_COLLECTION_COL_UX44_DESKTOP_INLINE_NOT_MODAL_PASS');
 assert.deepEqual(writes,[],'no external origin, POST or save upload');
 assert.deepEqual(errors,[],'no browser exception');
 console.log('WEB_STAGE1_COLLECTION_NO_UPLOAD_ERRORS_PASS');
}finally{await context.close();await browser.close();}
console.log('WEB_STAGE1_COLLECTION_ACTUAL_CHROME_PASS');
