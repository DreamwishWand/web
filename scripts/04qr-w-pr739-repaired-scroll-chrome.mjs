// 04 QR-W actual installed local Chrome changed-3 QA on PR739 repaired Source581aa.
// Independent of Owner Chrome test; no private P1G, Creator media, Account, Writer or Provider.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const executablePath=process.env.CHROME_BIN;
if(!executablePath)throw Error('QR739R_CHROME_BIN_REQUIRED');
const origin=(process.env.QR739R_URL??'http://127.0.0.1:4298').replace(/\/$/,'');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const errors=[],external=[],socket=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>socket.push(w.url()));
context.on('request',req=>{
 const u=new URL(req.url());
 if(req.method()!=='GET'||u.origin!==origin)external.push(req.method()+' '+req.url());
});
const cards=()=>page.locator('[data-stage1-category-browse] .item-card');
const info=()=>page.locator('[data-stage1-item-info]');
const close=()=>page.locator('[data-stage1-info-close]');
const capture=async card=>{
 await card.evaluate(el=>{
  el.addEventListener('click',()=>{
   window.__qr739r_click={
    x:window.scrollX,y:window.scrollY,
    id:el.getAttribute('data-stage1-item-id'),
    eventType:'click',when:performance.now()
   };
  },{capture:true,once:true});
 });
};
const whenStable=async()=>{
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
};
try{
 await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('[data-category="Furniture"]').waitFor({timeout:35000});
 assert.equal(await page.locator('.category-card').count(),29);
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
 await page.locator('[data-category="Furniture"]').click();
 await cards().first().waitFor({timeout:24000});
 assert.ok(await cards().count()>20,'deep furniture fixture to exercise actual scrolling');

 // Independent forced delta: focus before Enter, shift viewport, capture actual DOM click event.
 const deep=cards().nth(18),other=cards().nth(19);
 await deep.scrollIntoViewIfNeeded();
 await deep.focus();
 const sourceId=await deep.getAttribute('data-stage1-item-id');
 const preFocus=await page.evaluate(()=>window.scrollY);
 assert.ok(preFocus>0,'deep focus establishes nonzero scroll');
 await page.evaluate(y=>window.scrollTo({top:y+18,behavior:'instant'}),preFocus);
 const beforeEnter=await page.evaluate(()=>window.scrollY);
 assert.ok(beforeEnter-preFocus>=12,'forced scroll delta must exist BEFORE keyboard activation');
 await capture(deep);
 await page.keyboard.press('Enter');
 await info().waitFor({state:'visible',timeout:15000});
 const click=await page.evaluate(()=>window.__qr739r_click);
 assert.equal(click?.id,sourceId,'actual click event must bind current card');
 assert.equal(click?.eventType,'click');
 assert.ok(click.y-preFocus>=12,'must compare true click-time not stale focus-time');
 assert.ok(Number.isFinite(click.x)&&Number.isFinite(click.y));
 console.log('QR739R_CHROME_FORCED_SCROLL_DELTA_AND_GENUINE_KEYBOARD_CLICKTIME_PASS',JSON.stringify({preFocus,beforeEnter,clickY:click.y}));

 // Perturb again while Info is displayed to distinguish instant restoration from smooth animation.
 await close().focus();
 const preClose=await page.evaluate(y=>{
  const max=Math.max(0,document.documentElement.scrollHeight-innerHeight);
  const dest=y+30<=max?y+30:Math.max(0,y-30);
  window.scrollTo({top:dest,behavior:'instant'});
  return window.scrollY;
 },click.y);
 assert.ok(Math.abs(preClose-click.y)>=10,'deliberate pre-close gap must exist; no vacuous PASS');
 await page.keyboard.press('Enter');
 await info().waitFor({state:'detached',timeout:15000});
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-stage1-item-id')===id,sourceId);
 const immediate=await page.evaluate(()=>window.scrollY);
 assert.ok(Math.abs(immediate-click.y)<=4,'INSTANT must restore click-time within 4px at keyboard close, not after animation '+JSON.stringify({preFocus,clickY:click.y,preClose,immediate}));
 await whenStable();
 const afterFrames=await page.evaluate(()=>window.scrollY);
 assert.ok(Math.abs(afterFrames-click.y)<=4,'no post-close smooth-scroll drift');
 assert.equal(await page.locator('[data-stage1-item-info]').count(),0);
 console.log('QR739R_CHROME_FORCED_PRECLOSE_GAP_INSTANT_RESTORE_NO_SMOOTH_DRIFT_PASS',JSON.stringify({clickY:click.y,preClose,immediate,afterFrames}));

 // Different next card must restore its OWN click-time; no stale reference to old deep origin.
 await other.scrollIntoViewIfNeeded();
 const otherId=await other.getAttribute('data-stage1-item-id');
 assert.notEqual(otherId,sourceId);
 await capture(other);
 await other.click();
 await info().waitFor();
 const second=await page.evaluate(()=>window.__qr739r_click);
 assert.equal(second.id,otherId);
 await close().click();
 await info().waitFor({state:'detached'});
 await page.waitForFunction(id=>document.activeElement?.getAttribute('data-stage1-item-id')===id,otherId);
 const returnedSecond=await page.evaluate(()=>scrollY);
 assert.ok(Math.abs(returnedSecond-second.y)<=4,'newer pointer origin must win');
 console.log('QR739R_CHROME_POINTER_NEWEST_CARD_CLICKTIME_FOCUS_RETURN_PASS');

 // Minimal changed-head smoke of already accepted mobile sheet: do not rerun old QA740 entire scope.
 await page.locator('.back-category').click();
 await page.locator('[data-stage1-category-grid]').waitFor();
 await page.setViewportSize({width:320,height:800});
 const saved=await page.evaluate(()=>document.body.style.overflow);
 await page.locator('.filter-toggle').click();
 await page.locator('#collection-filters[role="dialog"][aria-modal="true"]').waitFor();
 assert.equal(await page.locator('.personal-state button:disabled').count(),2);
 await page.keyboard.press('Escape');
 await page.locator('#collection-filters').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>document.body.style.overflow),saved);
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await page.locator('.filter-toggle').click();
 const bounds=await page.locator('[data-stage1-filter-close]').boundingBox();
 assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=900,'200% mobile sheet close remains visible');
 await page.locator('[data-stage1-filter-close]').click();
 console.log('QR739R_CHROME_INHERITED_MOBILE_320_ZOOM200_MINIMAL_SMOKE_PASS');

 assert.deepEqual(external,[],'no POST or off-origin Save/Provider/Cloud');
 assert.deepEqual(socket.filter(u=>!/^ws:\/\/127\.0\.0\.1:4298\/\?token=[A-Za-z0-9_-]+$/.test(u)),[],'only local Vite HMR websocket allowed');
 assert.deepEqual(errors,[],'no browser JS exception');
 console.log('QR739R_CHROME_NO_UNINTENDED_NETWORK_WRITER_PASS');
}finally{await context.close();await browser.close();}
console.log('QR739R_INDEPENDENT_INSTALLED_CHROME_PASS');