// 04 QR-W independent NEW-HEAD regression for PR748 / COL-UX-42.
// Actual installed Chrome, synthetic public Collection catalog only.
// Only repaired mobile sheet anchoring, async deferred reset and teardown are newly exercised.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';

const BASE='01f45bd20ab98da2b6dc7c807738c20592621f47';
const OLD='2e3c8652aafe042704ca771e54218255fa2b1836';
const SOURCE='5f59390ac470c9004e8a7de27695c698a71e5008';
const expected=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','70d5620f805b1ff4f2266122ad42a40de3422c1f'],
 ['scripts/web-stage1-collection-chrome.mjs','97412bd8f1b1b54a2718db811bac1c1085ff8fc9'],
 ['src/routes/collection/+page.svelte','05ef9dadbae6bca3761ed859f5aad499417ede9e'],
 ['tests/web-stage1-collection-root.test.mjs','082f30c159c2c71b9ef0cab3a1b6f48da6bffdc4']
]);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const files=(from,to)=>git('diff','--name-only',from,to).split('\n').filter(Boolean).sort();
const qaPaths=[
 '.github/workflows/04qr-w-col42-repaired-anchor-20261107.yml',
 'scripts/04qr-w-col42-repaired-anchor-20261107.mjs'
].sort();
assert.equal(git('merge-base',BASE,SOURCE),BASE);
assert.equal(git('merge-base',OLD,SOURCE),OLD,'old RED commit must be inherited by repaired Source');
assert.deepEqual(files(BASE,SOURCE),[...expected.keys()].sort(),'exact four original Source paths');
assert.deepEqual(files(OLD,SOURCE),[
 'scripts/web-stage1-collection-chrome.mjs',
 'src/routes/collection/+page.svelte',
 'tests/web-stage1-collection-root.test.mjs'
].sort(),'newly modified paths only, workflow unchanged');
assert.deepEqual(files(SOURCE,'HEAD'),qaPaths,'two QA-owned files only');
for(const [path,blob] of expected){
 assert.equal(git('rev-parse',SOURCE+':'+path),blob,path+' frozen Source blob');
 assert.equal(git('hash-object',path),blob,path+' unchanged on independent QA branch');
}
const sourceText=readFileSync('src/routes/collection/+page.svelte','utf8');
assert.match(sourceText,/document\.documentElement\.style\.overflowAnchor='none'/);
assert.match(sourceText,/document\.documentElement\.style\.overflowAnchor=previousDocumentOverflowAnchor \?\? ''/);
assert.match(sourceText,/if\(mobileFilter&&filterOpen\)\{scopeScrollPending=true;return;\}/);
assert.match(sourceText,/if\(scopeScrollPending\)await resetResultScroll\(\)/);
assert.match(sourceText,/if\(scopeScrollPending\)void resetResultScroll\(\)/);
assert.match(sourceText,/if\(generation!==scopeScrollGeneration\|\|!collectionRoot\?\.isConnected\)return/);
assert.match(sourceText,/behavior:'instant'/);
assert.match(sourceText,/data-writer="off"/);
console.log('QRW_COL42_FIXED_SOURCE_GIT_BLOBS_AND_NEW_ONLY_SCOPE_PASS');

const chromeBin=process.env.CHROME_BIN;
assert.ok(chromeBin,'CHROME_BIN required for real installed browser');
const origin=(process.env.QRW_COL42_URL??'http://127.0.0.1:4299').replace(/\/$/,'');
const browser=await chromium.launch({executablePath:chromeBin,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const errors=[],unsafeRequests=[],websockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>websockets.push(w.url()));
context.on('request',r=>{
 const url=new URL(r.url());
 if(r.method()!=='GET'||url.origin!==origin)unsafeRequests.push(r.method()+' '+r.url());
});
const framePair=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const snapshot=()=>page.evaluate(()=>({
 y:scrollY,
 body:document.body.style.overflow,
 anchor:document.documentElement.style.overflowAnchor,
 chips:document.querySelectorAll('.active-filters button').length
}));
const waitAtRoot=()=>page.waitForFunction(()=>{
 const r=document.querySelector('[data-stage1-collection-root]')?.getBoundingClientRect();
 if(!r)return false;
 const target=Math.min(Math.max(0,scrollY+r.top),Math.max(0,document.documentElement.scrollHeight-innerHeight));
 return Math.abs(scrollY-target)<=4;
},null,{timeout:8000});
const deep=async()=>{
 const y=await page.evaluate(()=>{scrollTo({top:620,behavior:'instant'});return scrollY;});
 assert.ok(y>300,'deep mobile fixture required, got '+y);
 return y;
};
const filter=()=>page.locator('.filter-toggle');
const dialog=()=>page.locator('#collection-filters[role="dialog"][aria-modal="true"]');
const open=async()=>{
 await filter().evaluate(el=>el.click());
 await dialog().waitFor({timeout:8000});
 await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-stage1-filter-close'));
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 assert.equal(await page.evaluate(()=>document.documentElement.style.overflowAnchor),'none');
};
try{
 await page.goto(origin+'/collection/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:25000});
 assert.equal(await page.locator('.category-card').count(),29);
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1);
 const initial=await snapshot();
 await deep();
 await open();
 const baseline=await snapshot();
 const world=dialog().locator('fieldset').first().locator('button');
 const universe=dialog().locator('fieldset').nth(1).locator('button');
 assert.ok(await world.count()>=2&&await universe.count()>=1);
 for(const [label,button] of [['World first',world.first()],['World second',world.nth(1)],['Universe first',universe.first()]]){
  await button.evaluate(el=>el.click());
  await framePair();
  const current=await snapshot();
  console.log('QRW_COL42_ANCHOR_STEP '+JSON.stringify({label,baseline,current}));
  assert.equal(current.y,baseline.y,label+' must not move background after two animation frames');
  assert.equal(current.body,'hidden',label+' body lock retained');
  assert.equal(current.anchor,'none',label+' html scroll anchor disabled');
 }
 await page.keyboard.press('Escape');
 await dialog().waitFor({state:'detached'});
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 await waitAtRoot();
 let closed=await snapshot();
 assert.equal(closed.body,initial.body,'Escape restores prior body overflow');
 assert.equal(closed.anchor,initial.anchor,'Escape restores exact original overflow-anchor');
 console.log('QRW_COL42_THREE_FACETS_EXACT_BACKGROUND_AND_ESCAPE_RESET_PASS '+JSON.stringify(closed));

 await deep();
 await open();
 const beforeBackdrop=await snapshot();
 await world.first().evaluate(el=>el.click());
 await framePair();
 assert.equal((await snapshot()).y,beforeBackdrop.y,'backdrop branch does not drift while open');
 await page.locator('[data-stage1-filter-backdrop]').evaluate(el=>el.click());
 await dialog().waitFor({state:'detached'});
 await waitAtRoot();
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 closed=await snapshot();
 assert.equal(closed.body,initial.body);
 assert.equal(closed.anchor,initial.anchor);
 console.log('QRW_COL42_BACKDROP_DEFERRED_RESET_AND_FOCUS_PASS');

 await deep();
 await open();
 await universe.first().evaluate(el=>el.click());
 await framePair();
 await page.setViewportSize({width:1366,height:900});
 await page.waitForFunction((old)=>document.body.style.overflow===old.body&&document.documentElement.style.overflowAnchor===old.anchor,initial);
 await waitAtRoot();
 console.log('QRW_COL42_MOBILE_TO_DESKTOP_BREAKPOINT_PENDING_FLUSH_PASS');
 await filter().evaluate(el=>el.click());
 await page.locator('#collection-filters').waitFor({state:'detached'});

 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await deep();
 await open();
 const zoomBaseline=await snapshot();
 await world.first().evaluate(el=>el.click());
 await framePair();
 assert.equal((await snapshot()).y,zoomBaseline.y,'200% zoom sheet must not drift');
 await page.keyboard.press('Escape');
 await dialog().waitFor({state:'detached'});
 await waitAtRoot();
 assert.equal((await snapshot()).anchor,initial.anchor);
 console.log('QRW_COL42_ZOOM200_ANCHOR_RESTORE_PASS');

 await page.evaluate(()=>document.documentElement.style.zoom='1');
 await deep();
 await open();
 await universe.first().evaluate(el=>el.click());
 await framePair();
 await page.goto(origin+'/guide/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction((old)=>document.body.style.overflow===old.body&&document.documentElement.style.overflowAnchor===old.anchor,initial);
 console.log('QRW_COL42_ROUTE_UNMOUNT_SCROLL_LOCK_CLEANUP_PASS');
 assert.deepEqual(errors,[],'JS page errors');
 assert.deepEqual(unsafeRequests,[],'only localhost GET; no offsite or POST');
 assert.deepEqual(websockets.filter(raw=>{const u=new URL(raw);return u.hostname!=='127.0.0.1'||u.port!=='4299';}),[],'no off-origin websocket; localhost Vite HMR is allowed');
 console.log('QRW_COL42_NEWHEAD_SCOPED_CHROME_PASS');
}finally{await browser.close();}
