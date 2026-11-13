import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {IMAGE_RIGHTS_ATTRIBUTION} from '../src/lib/i18n/image-rights-attribution.js';
import {SUPPORTED_LOCALES} from '../src/lib/i18n/registry.js';
import {t} from '../src/lib/i18n/runtime.js';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const fixed='e765ee11d1a1d7e884b6fab7c8dc4c3cc9d45213',baseHead='92a9c506716625ef33e8a9d3b7253b4ced8c70a1';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const pins={
'src/lib/SiteFooter.svelte':'0f1b6e2e9dfc6226fe17ed6af5de68c5b3ac5042',
'docs/wep/world-editor-localization-inventory-20261002.json':'b52784710e2a0535879bf0f99d4725d63dde2ed1',
'src/lib/i18n/image-rights-attribution.js':'d34d810c43dcd9e2d685f8e20985089f2f7b1b11',
'tests/web-image-rights-attribution.test.mjs':'4b7aee919b9ce342571b85113011cfbacc007828',
'scripts/web-image-rights-attribution-chrome.mjs':'38367185a92af16427113570bcc88794dc56bb66',
'.github/workflows/08web-image-rights-attribution.yml':'d60812807bf9dd4c58b2608d52b321da7f7bfc0c'};
assert.equal(git('merge-base',fixed,'HEAD'),fixed);
assert.deepEqual(git('diff','--name-only',baseHead,fixed).split('\n').sort(),Object.keys(pins).sort());
assert.deepEqual(git('diff','--name-status',fixed,'HEAD').split('\n').sort(),['A\t.github/workflows/04qr-w-pr1027-image-rights-20261113.yml','A\tscripts/04qr-w-pr1027-image-rights-independent-20261113.mjs'].sort());
for(const [p,h] of Object.entries(pins))assert.equal(git('rev-parse','HEAD:'+p),h);
const draft=JSON.parse(readFileSync('ops/ddv-item-image-operator-readiness-template.json','utf8'));
assert.equal(git('rev-parse',fixed+':ops/ddv-item-image-operator-readiness-template.json'),'d9e0020017b4c979fc41c4578f9504fd0d0f7121');
assert.equal(draft.copyrightLicenceStatus,'UNKNOWN');assert.equal(draft.rightsContact,null);assert.equal(draft.publicationState,'OFF');
for(const {code} of SUPPORTED_LOCALES){assert.equal(draft.locales[code].humanReviewed,false);assert.equal(IMAGE_RIGHTS_ATTRIBUTION[code],draft.locales[code].text)}
console.log('QRW1027_EXACT6_DRAFT_NO_AUTHORITY_PASS');

const origin='http://127.0.0.1:4298',base='/web';
const html=readFileSync('build/index.html','utf8');
assert.match(html,/data-image-rights-attribution/,'static prerender contains notice');
assert.ok(html.includes('Disney Dreamlight Valley'));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),unsafe=[],media=[],errors=[];
ctx.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))unsafe.push(r.method()+' '+u.origin);if(u.pathname.includes('/ddv/item-images/'))media.push(u.pathname)});
page.on('pageerror',e=>errors.push(String(e)));
const notice=page.locator('[data-image-rights-attribution]');
const help=page.locator('footer a[href="/web/help/"]');
const waitCopy=async code=>{
 await page.waitForFunction(({code,text})=>document.documentElement.dataset.locale===code&&document.querySelector('[data-image-rights-attribution]')?.textContent.trim()===text,{code,text:IMAGE_RIGHTS_ATTRIBUTION[code]},{timeout:20000});
 assert.equal(await notice.count(),1);assert.equal(await notice.isVisible(),true);
 assert.equal(await notice.innerText(),IMAGE_RIGHTS_ATTRIBUTION[code]);
};
const fit=async label=>{
 await notice.scrollIntoViewIfNeeded();
 const r=await notice.evaluate(e=>{const b=e.getBoundingClientRect(),f=e.closest('footer').getBoundingClientRect(),s=getComputedStyle(e);return {left:b.left,right:b.right,width:b.width,height:b.height,footerLeft:f.left,footerRight:f.right,viewport:innerWidth,scrollX,overflow:s.overflow,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}});
 assert.ok(r.width>0&&r.height>0&&r.left>=-1&&r.right<=r.viewport+1&&r.footerLeft>=-1&&r.footerRight<=r.viewport+1&&Math.abs(r.scrollX)<=1&&r.scrollWidth<=r.clientWidth+2,label+JSON.stringify(r));
 assert.notEqual(r.overflow,'hidden');
};
try{
 // Independent coverage: use all eight persisted locale selections after
 // full reload and direct deep route navigation, not only the same home DOM.
 for(const [n,{code}] of SUPPORTED_LOCALES.entries()){
  await page.setViewportSize({width:1366,height:900});
  await page.goto(origin+base+'/',{waitUntil:'networkidle'});
  await page.locator('#site-locale').selectOption(code);
  await waitCopy(code);
  await page.reload({waitUntil:'networkidle'});await waitCopy(code);
  const routes=['/collection/','/explore/','/help/','/editor/world/','/presets/','/gallery/','/guide/','/'];
  const response=await page.goto(origin+base+routes[n],{waitUntil:'networkidle'});
  assert.equal(response.status(),200,code+' direct route');
  await waitCopy(code);await fit(code+' direct');
  assert.equal(await page.locator('footer a').count(),1);
  assert.equal(await help.getAttribute('href'),'/web/help/');
  assert.equal(await notice.locator('a,img,video,script,button').count(),0);
  // At the narrow viewport and doubled CSS zoom, check actual footer text
  // bounds rather than relying on the full page's unrelated layout.
  await page.setViewportSize({width:320,height:800});
  await fit(code+' physical320');
  // Owner contract: 320 CSS px reflow at 200% (640 physical px).
  await page.setViewportSize({width:640,height:800});
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  await fit(code+' effective320 zoom200');
  await page.evaluate(()=>document.documentElement.style.zoom='1');
  await help.focus();assert.equal(await help.evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Enter');await page.waitForURL('**/web/help/');await waitCopy(code);
  console.log('QRW1027_LOCALE_RELOAD_DEEP_ROUTE_ZOOM_KEYBOARD_PASS',code);
 }
 assert.deepEqual(media,[]);assert.deepEqual(unsafe,[]);assert.deepEqual(errors,[]);
 console.log('QRW1027_ALL8_PERSISTED_DIRECT_ROUTES_320CSS_200_NO_TRANSFER_PASS');
 // Keep the original stronger 160-CSS-px diagnostic. Compare actual parent
 // and candidate builds, same physical viewport/zoom and route, no DOM
 // substitution. This does not convert a clipped candidate into PASS.
 const geom=async (port)=>{
  const url='http://127.0.0.1:'+port+'/web/collection/';
  await page.setViewportSize({width:320,height:800});
  const res=await page.goto(url,{waitUntil:'networkidle'});assert.equal(res.status(),200);
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  await page.locator('footer').scrollIntoViewIfNeeded();
  return page.locator('footer').evaluate(e=>{const b=e.getBoundingClientRect();return {viewport:innerWidth,width:b.width,scrollWidth:document.documentElement.scrollWidth,minWidth:getComputedStyle(document.documentElement).minWidth,bodyMinWidth:getComputedStyle(document.body).minWidth}})
 };
 const candidate=await geom(4298);
 // Baseline requests are explicitly isolated, no user data. Use separate
 // browser context so prior candidate network audit remains exact.
 const baselineCtx=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block',acceptDownloads:false});
 const bp=await baselineCtx.newPage();
 const response=await bp.goto('http://127.0.0.1:4299/web/collection/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
 await bp.evaluate(()=>document.documentElement.style.zoom='2');
 await bp.locator('footer').scrollIntoViewIfNeeded();
 const baseline=await bp.locator('footer').evaluate(e=>{const b=e.getBoundingClientRect();return {viewport:innerWidth,width:b.width,scrollWidth:document.documentElement.scrollWidth,minWidth:getComputedStyle(document.documentElement).minWidth,bodyMinWidth:getComputedStyle(document.body).minWidth}});
 console.log('QRW1027_160CSS_PX_ACTUAL_PARENT_CANDIDATE_DIAGNOSTIC',JSON.stringify({baseline,candidate}));
 assert.equal(candidate.width,baseline.width,'NO_NEW_FOOTER_WIDTH_REGRESSION');
 assert.equal(candidate.minWidth,baseline.minWidth);assert.equal(candidate.bodyMinWidth,baseline.bodyMinWidth);
 assert.ok(candidate.width>candidate.viewport&&baseline.width>baseline.viewport,'HISTORICAL_ROOT_OVERFLOW_CONFIRMED');
 await baselineCtx.close();

}finally{await ctx.close();await browser.close()}
