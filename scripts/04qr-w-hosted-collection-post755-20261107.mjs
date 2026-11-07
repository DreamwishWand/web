// 04 QR-W independent deployed TEST Pages smoke after 09 INT #755.
// Scope is hosted HTTPS/browser delta, NOT repeating accepted localhost QA754.
// No genuine P1G/Account, provider mutation, rights publication, or Writer.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';

const PREVIOUS='6db050d868a255e596a79ef04eb0b896128bc6b3';
const MAIN='069b47d4fc32fe947ca652328de8cbba72421504';
const ORIGIN='https://dreamwishwand.github.io';
const BASE=ORIGIN+'/web';
const QA=[
 '.github/workflows/04qr-w-hosted-collection-post755-20261107.yml',
 'scripts/04qr-w-hosted-collection-post755-20261107.mjs'
].sort();
const original=new Map([
 ['.github/workflows/web-stage1-collection-ux.yml','70d5620f805b1ff4f2266122ad42a40de3422c1f'],
 ['scripts/web-stage1-collection-chrome.mjs','97412bd8f1b1b54a2718db811bac1c1085ff8fc9'],
 ['src/routes/collection/+page.svelte','05ef9dadbae6bca3761ed859f5aad499417ede9e'],
 ['tests/web-stage1-collection-root.test.mjs','082f30c159c2c71b9ef0cab3a1b6f48da6bffdc4']
]);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const diff=(a,b)=>git('diff','--name-only',a,b).split('\n').filter(Boolean).sort();
assert.ok(process.env.CHROME_BIN,'NOT_RUN: installed system Chrome required');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED','DDV_PRIVATE_SAVE_PATH']){
 assert.ok(!process.env[k],'Owner private source must not enter hosted test: '+k);
}
assert.equal(git('merge-base',PREVIOUS,MAIN),PREVIOUS);
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(diff(PREVIOUS,MAIN),[...original.keys()].sort(),'protected PR755 exact four original Source paths');
assert.deepEqual(diff(MAIN,'HEAD'),QA,'QA only: no production Source modifications');
for(const [name,sha] of original){
 assert.equal(git('rev-parse',MAIN+':'+name),sha,'source Git blob '+name);
 assert.equal(git('hash-object',name),sha,'QA must not modify source '+name);
}
console.log('QRW_HOSTED_069B_SOURCE4_QA2_PROTECTED_SHA_PASS');

const get=async(path)=>{
 const response=await fetch(BASE+path,{redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});
 const body=await response.text();
 return {status:response.status,location:response.headers.get('location'),mime:response.headers.get('content-type')??'',bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')};
};
const routes=['/','/collection/','/gallery/','/decorate/','/guide/','/presets/'];
for(const path of routes){
 const r=await get(path);
 console.log('QRW_HOSTED_TEST_PAGES_DIRECT_GET '+JSON.stringify({path,...r}));
 assert.equal(r.status,200,'existing deployed TEST Pages route must be direct HTTP200: '+path);
 assert.match(r.mime,/text\/html/i,path+' HTML Content-Type');
 assert.ok(r.bytes>300,path+' not empty fallback');
 assert.equal(r.location,null,'no unexpected redirect '+path);
}
const unknown=await get('/users/qrw-not-an-approved-profile-20261107/');
console.log('QRW_HOSTED_UNKNOWN_PUBLIC_PROFILE '+JSON.stringify(unknown));
assert.equal(unknown.status,404,'unapproved arbitrary user cannot masquerade as direct HTTP200 or SEO approval');
const privateLibrary=await get('/library/');
console.log('QRW_HOSTED_PRIVATE_LIBRARY_NOT_IMPLEMENTED '+JSON.stringify(privateLibrary));
assert.equal(privateLibrary.status,404,'unimplemented private Library must not claim 200; 404 is not evidence of real Auth401');
console.log('QRW_HOSTED_REAL_HTTP200_404_AND_NO_FAKE_SPA_SEO_PASS');

const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const errors=[],unsafe=[],websockets=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('websocket',w=>websockets.push(w.url()));
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{unsafe.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
const pair=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const snapshot=()=>page.evaluate(()=>({
 y:scrollY,body:document.body.style.overflow,anchor:document.documentElement.style.overflowAnchor,
 width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth
}));
const atRoot=()=>page.waitForFunction(()=>{
 const root=document.querySelector('[data-stage1-collection-root]')?.getBoundingClientRect();
 if(!root)return false;
 const desired=Math.min(Math.max(0,scrollY+root.top),Math.max(0,document.documentElement.scrollHeight-innerHeight));
 return Math.abs(scrollY-desired)<=4;
},null,{timeout:10000});
try{
 const response=await page.goto(BASE+'/collection/',{waitUntil:'domcontentloaded',timeout:50000});
 assert.equal(response?.status(),200,'real Chrome Collection direct hosted 200');
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:30000});
 assert.equal(await page.locator('.category-card').count(),29,'published Collection category count fixture');
 assert.equal(await page.locator('[data-personal-progress="unknown"][data-writer="off"][data-media-rights="unverified"]').count(),1,'hosted collection no fabricated personal Owned/Writer');
 assert.equal(await page.locator('.personal-state button[disabled]').count(),2,'Owned/Missing remains unavailable without real Save');
 assert.equal(await page.locator('[data-stage1-search]').isVisible(),true,'hosted Collection Search visible');
 const prior=await snapshot();
 assert.ok(prior.scrollWidth<=prior.width+2,'320px hosted horizontal overflow '+JSON.stringify(prior));
 await page.locator('.filter-toggle').evaluate(el=>el.click());
 const modal=page.locator('#collection-filters[role="dialog"][aria-modal="true"]');
 await modal.waitFor({timeout:12000});
 await page.keyboard.press('Escape');
 await modal.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 assert.equal((await snapshot()).body,prior.body);
 assert.equal((await snapshot()).anchor,prior.anchor);
 console.log('QRW_HOSTED_320PX_REAL_CHROME_KEYBOARD_ESCAPE_FOCUS_PASS');
 const y=await page.evaluate(()=>{scrollTo({top:620,behavior:'instant'});return scrollY;});
 assert.ok(y>300,'real hosted deep scroll fixture needs y>300: '+y);
 await page.locator('.filter-toggle').evaluate(el=>el.click());
 await modal.waitFor();
 await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-stage1-filter-close'));
 const start=await snapshot();
 assert.equal(start.body,'hidden');
 assert.equal(start.anchor,'none','current deployed source must suppress HTML scroll anchoring while modal open');
 const worlds=modal.locator('fieldset').first().locator('button');
 const universe=modal.locator('fieldset').nth(1).locator('button');
 assert.ok(await worlds.count()>=2&&await universe.count()>=1,'hosted public facets loaded');
 for(const [label,btn] of [['World1',worlds.first()],['World2',worlds.nth(1)],['Universe1',universe.first()]]){
  await btn.evaluate(el=>el.click());await pair();
  const now=await snapshot();
  assert.equal(now.y,start.y,label+' must not background-scroll while hosted modal open');
  assert.equal(now.anchor,'none',label+' must preserve active anchor lock');
  assert.equal(now.body,'hidden',label+' must keep modal background locked');
  console.log('QRW_HOSTED_MODAL_NO_DRIFT '+JSON.stringify({label,baseline:start.y,after:now.y}));
 }
 await page.keyboard.press('Escape');
 await modal.waitFor({state:'detached'});
 await atRoot();
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 const closed=await snapshot();
 assert.equal(closed.body,prior.body);
 assert.equal(closed.anchor,prior.anchor);
 console.log('QRW_HOSTED_COL42_3FACETS_EXACT_Y_AND_DEFERRED_ESCAPE_PASS '+JSON.stringify({start:start.y,after:closed.y}));
 await page.locator('.filter-toggle').evaluate(el=>el.click());
 await modal.waitFor();
 await page.locator('[data-stage1-filter-backdrop]').evaluate(el=>el.click());
 await modal.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 assert.equal((await snapshot()).anchor,prior.anchor);
 console.log('QRW_HOSTED_BACKDROP_RESTORE_PASS');
 await page.setViewportSize({width:640,height:900});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 await page.locator('.filter-toggle').evaluate(el=>el.click());
 await modal.waitFor();
 await pair();
 const geometry=await page.evaluate(()=>{
  const node=document.querySelector('[data-stage1-filter-close]')?.getBoundingClientRect();
  return {h:innerHeight,y:node?.y,bottom:node?.bottom,htmlZoom:getComputedStyle(document.documentElement).zoom};
 });
 assert.ok(geometry.y>=0&&geometry.bottom<=geometry.h+4,'200percent hosted close control reachable '+JSON.stringify(geometry));
 await page.keyboard.press('Escape');
 await modal.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.activeElement?.classList.contains('filter-toggle'));
 assert.equal((await snapshot()).anchor,prior.anchor);
 console.log('QRW_HOSTED_CSS_200_PERCENT_ZOOM_ESCAPE_PASS '+JSON.stringify(geometry));
 await page.evaluate(()=>document.documentElement.style.zoom='1');
 assert.deepEqual(errors,[],'hosted JS page errors');
 assert.deepEqual(unsafe,[],'hosted Collection no external requests, POST, Provider, Cloud or Save writes');
 assert.deepEqual(websockets,[],'hosted Pages cannot start external WebSockets');
 console.log('QRW_HOSTED_MAIN069B_REAL_GET_CHROME_READ_ONLY_SCOPED_PASS');
}finally{await browser.close();}
