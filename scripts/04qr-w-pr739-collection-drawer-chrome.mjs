// 04 QR-W independent installed local Chromium, PR739 Collection mobile Filter Sheet.
// Synthetic public catalog only; NO real P1G, ownership, account, media, Writer or Cloud.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {STAGE1_COLLECTION_ORDER,stage1CollectionCopy,stage1CategoryLabel} from '../src/lib/collection/stage1-root.mjs';

const bin=process.env.CHROME_BIN;
if(!bin)throw Error('QR739_CHROME_BIN_REQUIRED');
const origin=(process.env.QR739_URL??'http://127.0.0.1:4297').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const issues=[],writes=[],ws=[];
page.on('pageerror',e=>issues.push(String(e)));
page.on('websocket',w=>ws.push(w.url()));
context.on('request',r=>{if(r.method()!=='GET'||new URL(r.url()).origin!==origin)writes.push(r.method()+' '+r.url());});
const filter=()=>page.locator('.filter-toggle');
const panel=()=>page.locator('#collection-filters');
const sheet=()=>page.locator('#collection-filters[role="dialog"][aria-modal="true"]');
const active=()=>page.evaluate(()=>({
 tag:document.activeElement?.tagName,
 close:document.activeElement?.hasAttribute('data-stage1-filter-close'),
 toggle:document.activeElement?.classList.contains('filter-toggle')
}));
const fit=async name=>{
 const g=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(g.scroll<=g.w+2,name+': '+JSON.stringify(g));
};
const open=async()=>{
 await filter().click();
 await sheet().waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-stage1-filter-close'));
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 assert.equal(await filter().getAttribute('aria-expanded'),'true');
 assert.equal(await filter().getAttribute('aria-haspopup'),'dialog');
};
const closed=async prev=>{
 await panel().waitFor({state:'detached',timeout:15000});
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 assert.equal(await page.evaluate(()=>document.body.style.overflow),prev);
 assert.equal(await filter().getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('[data-stage1-filter-shell]').count(),0);
};
try{
 await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('[data-stage1-category-grid] [data-category="Furniture"]').waitFor({timeout:30000});
 assert.deepEqual(await page.locator('.category-card').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-category'))),STAGE1_COLLECTION_ORDER);
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
 assert.equal(await page.locator('.personal-state button:disabled').count(),2);
 for(const lang of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(lang);
  await page.locator('html[data-locale="'+lang+'"]').waitFor({timeout:15000});
  assert.equal(await page.locator('[data-category="Furniture"] .category-name').innerText(),stage1CategoryLabel(lang,'Furniture'));
  assert.ok((await filter().innerText()).includes(stage1CollectionCopy(lang).filter),lang);
 }
 console.log('QR739_CHROME_8LOCALE_29CATEGORY_OWNED_MISSING_UNKNOWN_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.setViewportSize({width:320,height:800});
 await fit('320px root');
 const prev=await page.evaluate(()=>document.body.style.overflow);
 assert.equal(await panel().count(),0);
 assert.equal(await page.locator('[data-stage1-search]').isVisible(),true);
 assert.equal(await page.locator('.personal-state').isVisible(),true);
 await page.locator('[data-stage1-search]').fill('40000047');
 await open();
 assert.equal(await page.locator('#collection-filters[aria-label]').getAttribute('aria-label'),stage1CollectionCopy('ja').filter);
 const first=page.locator('[data-stage1-filter-close]');
 const last=sheet().locator('fieldset').last().locator('button').last();
 await first.focus();
 await page.keyboard.press('Shift+Tab');
 assert.equal(await last.evaluate(el=>el===document.activeElement),true,'Shift-Tab traps last');
 await page.keyboard.press('Tab');
 assert.equal(await first.evaluate(el=>el===document.activeElement),true,'Tab traps first');
 assert.equal((await active()).close,true);
 await page.keyboard.press('Escape');
 await closed(prev);
 assert.equal(await page.locator('[data-stage1-search]').inputValue(),'40000047','search query preserved');
 console.log('QR739_CHROME_320_DIALOG_TAB_REVERSE_ESC_FOCUS_SCROLL_RESTORE_PASS');

 await page.locator('[data-stage1-search]').fill('');
 await open();
 const world=sheet().locator('fieldset').first().locator('button');
 const universe=sheet().locator('fieldset').nth(1).locator('button');
 assert.ok(await world.count()>=2);
 assert.ok(await universe.count()>=1);
 await world.nth(0).click();
 await world.nth(1).click();
 await universe.nth(0).click();
 assert.equal(await world.nth(0).getAttribute('aria-pressed'),'true');
 assert.equal(await world.nth(1).getAttribute('aria-pressed'),'true');
 assert.equal(await universe.nth(0).getAttribute('aria-pressed'),'true');
 await page.locator('[data-stage1-filter-close]').click();
 await closed(prev);
 assert.equal(await page.locator('.active-filters button').count(),4,'2 World OR+1 Universe AND+clear');
 await open();
 assert.equal(await world.nth(0).getAttribute('aria-pressed'),'true');
 assert.equal(await world.nth(1).getAttribute('aria-pressed'),'true');
 assert.equal(await universe.nth(0).getAttribute('aria-pressed'),'true');
 await page.locator('[data-stage1-filter-backdrop]').click({position:{x:4,y:4}});
 await closed(prev);
 assert.equal(await page.locator('.active-filters button').count(),4,'backdrop does not clear selection');
 await page.locator('.active-filters .clear').click();
 assert.equal(await page.locator('.active-filters').count(),0);
 console.log('QR739_CHROME_WORLD_OR_UNIVERSE_AND_CLEAR_BACKDROP_PERSIST_PASS');

 // Dynamic breakpoint transition must release scroll lock and restore modal on return.
 await open();
 await page.setViewportSize({width:1000,height:900});
 await page.waitForFunction(()=>document.querySelector('#collection-filters')?.getAttribute('role')===null);
 assert.equal(await panel().getAttribute('aria-modal'),null,'desktop mode not modal');
 assert.equal(await page.evaluate(()=>document.body.style.overflow),prev,'mobile lock removed on desktop');
 assert.equal(await page.locator('[data-stage1-filter-close]').isVisible(),false,'mobile only close hidden');
 await page.setViewportSize({width:320,height:800});
 await sheet().waitFor();
 await page.waitForFunction(()=>document.body.style.overflow==='hidden'&&document.activeElement?.hasAttribute('data-stage1-filter-close'));
 await page.keyboard.press('Escape');
 await closed(prev);
 console.log('QR739_CHROME_MOBILE_DESKTOP_MOBILE_OPEN_LOCK_AND_FOCUS_PASS');

 // Independent 200%-scale mobile negative: close remains in actual viewport.
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await fit('200 percent root');
 await open();
 const geo=await page.evaluate(()=>{
  const r=document.querySelector('#collection-filters')?.getBoundingClientRect();
  const b=document.querySelector('[data-stage1-filter-close]')?.getBoundingClientRect();
  return {top:r?.top,bottom:r?.bottom,right:r?.right,closeTop:b?.top,closeBottom:b?.bottom,w:innerWidth,h:innerHeight};
 });
 assert.ok(geo.top>=-4,'dialog top visible at 200%: '+JSON.stringify(geo));
 assert.ok(geo.closeTop>=0&&geo.closeBottom<=geo.h+4,'close reachable at 200%: '+JSON.stringify(geo));
 await fit('200 percent open');
 await page.locator('[data-stage1-filter-close]').click();
 await closed(prev);
 await page.evaluate(()=>{document.documentElement.style.zoom='1'});
 console.log('QR739_CHROME_ZOOM200_VISIBLE_DIALOG_AND_CLOSE_PASS');

 // Desktop continues to be an inline facet region without document scroll lock.
 await page.setViewportSize({width:1366,height:900});
 await filter().click();
 await panel().waitFor();
 assert.equal(await panel().getAttribute('role'),null);
 assert.equal(await panel().getAttribute('aria-modal'),null);
 assert.equal(await page.locator('[data-stage1-filter-close]').isVisible(),false);
 assert.equal(await page.locator('.filter-backdrop').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.body.style.overflow),prev);
 assert.equal(await page.locator('[data-stage1-category-grid] .category-card').count(),29);
 await filter().click();
 assert.equal(await panel().count(),0);
 assert.deepEqual(writes,[],'NO local POST or off-origin Cloud/Save call');
 assert.deepEqual(ws.filter(u=>!/^ws:\/\/127\.0\.0\.1:4297\/\?token=[A-Za-z0-9_-]+$/.test(u)),[],'NO foreign WS beyond known local Vite HMR');
 assert.deepEqual(issues,[],'NO unhandled JS errors');
 console.log('QR739_CHROME_DESKTOP_INLINE_AND_NO_WRITER_OR_NETWORK_PASS');
}finally{
 await context.close();
 await browser.close();
}
console.log('QR739_INDEPENDENT_LOCAL_CHROME_ALL_PASS');