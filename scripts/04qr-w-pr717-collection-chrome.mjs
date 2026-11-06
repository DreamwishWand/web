// 04 QR-W independent local installed Chrome for changed PR717 Collection Info.
// NO private Save, account, provider, Creator media, or public publishing fixture.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {STAGE1_COLLECTION_ORDER,stage1CategoryLabel} from '../src/lib/collection/stage1-root.mjs';

const bin=process.env.CHROME_BIN;if(!bin)throw Error('QR717_CHROME_BIN_REQUIRED');
const origin=(process.env.QR717_URL??'http://127.0.0.1:4294').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:bin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),errors=[],requests=[],websockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',ws=>websockets.push(ws.url()));
ctx.on('request',r=>{if(r.method()!=='GET'||new URL(r.url()).origin!==origin)requests.push(r.method()+' '+r.url());});
const cards=()=>page.locator('[data-stage1-category-browse] .item-card');
const info=()=>page.locator('[data-stage1-item-info]');
const close=()=>page.locator('[data-stage1-info-close]');
const fit=async label=>{
 const m=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(m.scroll<=m.w+2,label+' overflow '+JSON.stringify(m));
};
const waitInfo=async()=>info().waitFor({state:'visible',timeout:16000});
const noInfo=async()=>info().waitFor({state:'hidden',timeout:16000});
const activeId=()=>page.evaluate(()=>document.activeElement?.getAttribute('data-stage1-item-id'));
try{
 await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('[data-category="Furniture"]').waitFor({timeout:45000});
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
 assert.deepEqual(await page.locator('.category-card').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-category'))),STAGE1_COLLECTION_ORDER);
 await page.locator('[data-category="Furniture"]').click();
 await cards().first().waitFor({timeout:25000});
 const total=await cards().count();
 assert.ok(total>=4,'independent Furniture multiple card fixture');
 const index=Math.min(22,total-3),one=cards().nth(index),two=cards().nth(index+1),three=cards().nth(index+2);
 const idOne=await one.getAttribute('data-stage1-item-id');
 const idTwo=await two.getAttribute('data-stage1-item-id');
 assert.notEqual(idOne,idTwo);
 await one.scrollIntoViewIfNeeded();
 const scrollBefore=await page.evaluate(()=>scrollY);
 assert.ok(scrollBefore>0,'deep-card fixture must scroll below first fold');
 await one.focus();
 await page.keyboard.press('Enter');
 await waitInfo();
 await close().focus();
 await page.keyboard.press('Enter');
 await noInfo();
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-stage1-item-id')===id,idOne);
 assert.ok(Math.abs((await page.evaluate(()=>scrollY))-scrollBefore)<=4,'scroll returned to deep origin');
 assert.equal(await cards().count(),total,'item category/page survives Info close');
 console.log('QR717_CHROME_DEEP_KEYBOARD_ORIGIN_SCROLL_AND_FOCUS_PASS');

 // Superseded A must never own closing B; focus the exact B DOM source.
 await one.click();await waitInfo();
 await two.click();await waitInfo();
 await close().click();await noInfo();
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-stage1-item-id')===id,idTwo);
 assert.equal(await activeId(),idTwo);
 console.log('QR717_CHROME_A_SUPERSEDED_B_FOCUS_ONLY_NEWEST_PASS');

 // Stale changed DOM ID: no forged original target may receive focus.
 await three.click();await waitInfo();
 const oldId=await three.getAttribute('data-stage1-item-id');
 await three.evaluate(el=>el.setAttribute('data-stage1-item-id','999999991'));
 await close().click();await noInfo();
 assert.notEqual(await activeId(),'999999991','mutated DOM card must not get stale focus');
 assert.notEqual(await activeId(),oldId,'mutated card ID cannot reattach original focus');
 console.log('QR717_CHROME_FORGED_ORIGIN_DOM_ITEM_ID_DENY_PASS');

 // Disconnected original source: do not refocus detached card, even if name/ItemID was formerly valid.
 await one.click();await waitInfo();
 await one.evaluate(el=>el.remove());
 await close().click();await noInfo();
 assert.notEqual(await activeId(),idOne,'unmounted source card not focusable');
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0);
 console.log('QR717_CHROME_REMOVED_SOURCE_NO_STALE_FOCUS_PASS');

 // Query replaces the scoped source while Info is shown; no restored origin or made-up ownership.
 await page.locator('[data-stage1-search]').fill('40000047');
 await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:22000});
 const queryCard=page.locator('[data-stage1-search-groups] .item-card').first();
 await queryCard.click();await waitInfo();
 await page.locator('[data-stage1-search]').fill('qr-no-source-never-assume-Owned');
 await noInfo();
 assert.equal(await page.locator('[data-stage1-search]').inputValue(),'qr-no-source-never-assume-Owned');
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-stage1-search')),true);
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0);
 await page.locator('[data-stage1-search]').fill('');
 console.log('QR717_CHROME_CHANGED_QUERY_INVALIDATES_ORIGIN_AND_INFO_PASS');

 // World source facet changes while info open; this must invalidate and not manufacture Owned/Writer.
 await page.locator('.back-category').click();
 await page.locator('[data-stage1-category-grid]').waitFor();
 await page.locator('[data-category="Furniture"]').click();
 await cards().first().waitFor();
 await cards().first().click();await waitInfo();
 await page.locator('.filter-toggle').click();
 const facets=page.locator('[data-stage1-facets] fieldset').first().locator('button');
 assert.ok(await facets.count()>0);
 await facets.first().click();
 await noInfo();
 assert.equal(await page.locator('[data-stage1-facets] button[aria-pressed="true"]').count()>0,true);
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"]').count(),1);
 await page.locator('.active-filters .clear').click();
 console.log('QR717_CHROME_FACET_CHANGE_INVALIDATES_INFO_WITH_WRITER_OFF_PASS');

 await page.locator('.back-category').click();
 await page.locator('[data-stage1-category-grid]').waitFor();
 for(const locale of ['en','fr','it','de','es-ES','ja','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(locale);
  await page.locator('html[data-locale="'+locale+'"]').waitFor({timeout:16000});
  const label=stage1CategoryLabel(locale,'Furniture');
  assert.equal((await page.locator('[data-category="Furniture"] .category-name').innerText()).trim(),label,locale);
  assert.equal(await page.locator('.category-card').count(),29);
 }
 await page.setViewportSize({width:320,height:780});await fit('320px');
 await page.locator('[data-category="Furniture"]').focus();
 await page.keyboard.press('Enter');
 await cards().first().waitFor();
 await fit('320px browse');
 await page.setViewportSize({width:640,height:780});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await fit('200% browse');
 await cards().first().focus();await page.keyboard.press('Enter');await waitInfo();
 await close().focus();await page.keyboard.press('Enter');await noInfo();
 assert.equal(await activeId(),await cards().first().getAttribute('data-stage1-item-id'));
 await fit('200% close');
 await page.evaluate(()=>{document.documentElement.style.zoom='1'});
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
 assert.deepEqual(requests,[],'no POST or off-origin requests');
 const externalWs=websockets.filter(url=>!/^ws:\/\/127\.0\.0\.1:4294\/\?token=[A-Za-z0-9_-]+$/.test(url));
 assert.deepEqual(externalWs,[],'no external/provider WebSocket except dev Vite HMR');
 assert.deepEqual(errors,[],'no JS errors');
 console.log('QR717_CHROME_8LOCALE_320_ZOOM200_KEYBOARD_NO_PROVIDER_NO_WRITER_PASS');
}finally{await ctx.close();await browser.close();}
console.log('QR717_INDEPENDENT_LOCAL_CHROME_PASS');