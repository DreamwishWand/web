// 04 QR-W independent ACTUALLY DEPLOYED public TEST Pages /web/discover/ on main90d.
// Fixed main and source identity. This is not 8-locale original Source UI QA or a Public Preview gate.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {ORIENTATION_DESTINATIONS,orientationCopy} from '../src/lib/product-home/orientation-stage1-copy.mjs';

const MAIN='90d21b1b45c8743b2c4359c29d37115fd0bc355c';
const PREV='c77840eb0353ace2689a00a49b23c32fda866264';
const ORIGIN='https://dreamwishwand.github.io';
const BASE=ORIGIN+'/web';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const sourceFiles=[
 '.github/workflows/web-stage1-discover-orientation.yml',
 'scripts/web-stage1-discover-orientation-chrome.mjs',
 'src/lib/product-home/orientation-stage1-copy.mjs',
 'src/routes/discover/+page.svelte',
 'tests/web-stage1-discover-orientation.test.mjs'
].sort();
const qaFiles=[
 '.github/workflows/04qr-w-main90d-discover-deployed-real-chrome.yml',
 'scripts/04qr-w-main90d-discover-deployed-real-chrome.mjs'
].sort();
if(!process.env.CHROME_BIN)throw Error('QA_NOT_RUN_REAL_SYSTEM_CHROME_REQUIRED');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 if(process.env[k])throw Error('QA_PRIVATE_OWNER_P1G_FORBIDDEN_'+k);
assert.equal(git('merge-base',PREV,MAIN),PREV);
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-only',PREV,MAIN).trim().split('\n').sort(),sourceFiles,
 '09 INT must have merged only original five accepted Discover files');
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').trim().split('\n').sort(),qaFiles,
 'independent QA two files only; no Source, Pages config or publishing changes');
for(const [p,sha] of Object.entries({
 'src/routes/discover/+page.svelte':'c909b5d957bda1b5fba5727877417baf03362a6d',
 'src/lib/product-home/orientation-stage1-copy.mjs':'c2ec4e6ce2c80e97aa7e117bda5234155b72649f',
 'src/routes/+page.svelte':'173d7b128b22db16fb2478961fcd60205754a293',
 'src/routes/gallery/+page.svelte':'22a2ca880708487211f8bbaa88ccdb7924770371',
 'src/routes/dreamsnaps/+page.svelte':'0622998c3b0d0c45ad0597c998cf3ec2707b1022',
 'src/routes/gallery/my/+page.svelte':'2d78bb9e8259bf9985170f2d30977e397dfc8670',
 'src/routes/dreamsnaps/results/+page.svelte':'168c09e05f912d1b0196b885ba95bf1db8304be7'
})) assert.equal(git('rev-parse',MAIN+':'+p),sha,p);
const ids=['decorate','collection','guide','presets','gallery','dreamsnaps','help'];
assert.deepEqual(ORIENTATION_DESTINATIONS,
 ['/decorate/','/collection/','/guide/','/presets/','/gallery/','/dreamsnaps/','/help/']);

async function direct(p,marker){
 const res=await fetch(BASE+p,{redirect:'manual',headers:{'Cache-Control':'no-cache'}});
 assert.equal(res.status,200,'actual hosted Pages route must directly return HTTP200 '+p);
 assert.match(res.headers.get('content-type')??'',/text\/html/i,'real route HTML not SPA fallback');
 const html=await res.text();
 assert.ok(html.length>350);
 assert.match(html,marker,'not generic fallback/404 '+p);
 return html;
}
const html=await direct('/discover/',/Discover|Dreamwish Wand|orientation/i);
assert.match(html,/data-discover-stage1="orientation-not-dashboard"/,'server-rendered orientation route, not only SPA script');
console.log('QR_MAIN90D_REMOTE_DISCOVER_DIRECT_HTTP200_PRERENDERED_REAL_HTML_PASS');

const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),denied=[],errors=[];
page.on('pageerror',error=>errors.push(String(error)));
if(typeof page.routeWebSocket!=='function')throw Error('QA_WEBSOCKET_DENY_BOUNDARY_REQUIRED');
await page.routeWebSocket('**/*',route=>{denied.push('WS '+route.url());route.close();});
await page.route('**/*',route=>{
 const req=route.request(),u=new URL(req.url());
 if(u.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{denied.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
async function navigate(link,p){
 await link.focus();
 assert.equal(await link.getAttribute('href'),BASE.replace(ORIGIN,'')+p);
 await page.keyboard.press('Enter');
 await page.waitForURL(u=>u.pathname==='/web'+p,{timeout:22000});
}
async function backDiscover(){
 const res=await page.goto(BASE+'/discover/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(res?.status(),200);
 await page.locator('[data-discover-stage1="orientation-not-dashboard"]').waitFor({state:'visible'});
}
async function overflow(label){
 const r=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(r.scroll<=r.width+2,label+' '+JSON.stringify(r));
}
try{
 let res=await page.goto(BASE+'/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(res?.status(),200);
 assert.equal(await page.locator('.home-product-grid a.visual-card').count(),6);
 assert.equal(await page.locator('.home-qa-entry a.visual-card').count(),1);
 await page.locator('#site-locale').selectOption('ja');
 await navigate(page.locator('.toolbar-context-link[href="/web/discover/"]').first(),'/discover/');
 const root=page.locator('[data-discover-stage1="orientation-not-dashboard"]');
 await root.waitFor({state:'visible'});
 assert.equal(await root.getAttribute('data-public-writer'),'off');
 assert.equal(await root.getAttribute('data-save-auto-upload'),'off');
 assert.deepEqual(await root.locator('[data-discover-product]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-discover-product'))),ids);
 const ja=orientationCopy('ja');
 for(let i=0;i<ids.length;i++){
  const el=root.locator('[data-discover-product="'+ids[i]+'"]');
  assert.equal(await el.locator('.discover-product-purpose p').innerText(),ja.products[i].purpose);
  assert.equal(await el.locator('.discover-product-start p').innerText(),ja.products[i].step);
  assert.equal(await el.locator('a[data-discover-destination]').getAttribute('href'),'/web'+ja.products[i].path);
 }
 for(const attr of ['data-discover-account-optional','data-discover-save-optional','data-discover-capability-gated'])
  assert.equal(await root.locator('['+attr+']').count(),1,attr);
 assert.equal((await root.locator('[data-discover-save-optional] p').innerText()).trim(),ja.save);
 console.log('QR_MAIN90D_DEPLOYED_HOME_JA_KEYBOARD_DISCOVER7_BODIES_OPTIONAL_SAVE_ACCOUNT_NO_UPLOAD_PASS');

 await navigate(root.locator('a[data-discover-destination="gallery"]'),'/gallery/');
 const gallery=page.locator('[data-stage1-gallery-root]');
 await gallery.waitFor({state:'visible'});
 assert.deepEqual(await gallery.locator('[data-gallery-child]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-gallery-child'))),
  ['decorations','touchOfMagic','myGallery']);
 assert.equal(await gallery.getAttribute('data-writer'),'off');
 await navigate(gallery.locator('[data-gallery-child="myGallery"]'),'/gallery/my/');
 assert.deepEqual(await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content)),['noindex,nofollow']);
 console.log('QR_MAIN90D_DEPLOYED_DISCOVER_TO_GALLERY_MY_NOINDEX_PASS');

 await backDiscover();
 await navigate(page.locator('a[data-discover-destination="dreamsnaps"]'),'/dreamsnaps/');
 const snaps=page.locator('[data-stage1-dreamsnaps-root="1-3-1"]');
 await snaps.waitFor({state:'visible'});
 for(const attr of ['data-public-provider','data-writer','data-private-results'])assert.equal(await snaps.getAttribute(attr),'off');
 await navigate(snaps.locator('[data-dreamsnaps-child="results"]'),'/dreamsnaps/results/');
 assert.deepEqual(await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content)),['noindex,nofollow']);
 console.log('QR_MAIN90D_DEPLOYED_DISCOVER_TO_DREAMSNAPS_RESULTS_NO_PUBLICATION_PASS');

 await backDiscover();
 await navigate(page.locator('a[data-discover-destination="help"]'),'/help/');
 await page.locator('[data-help-root="four-children"]').waitFor({state:'visible'});
 await backDiscover();
 await navigate(page.locator('.discovery-status-link').first(),'/rc-status/');
 await backDiscover();
 await page.setViewportSize({width:320,height:780});
 await overflow('320px real public Discover');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await overflow('200% zoom real public Discover');
 const screenshot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(screenshot.length>5000);
 console.log('QR_MAIN90D_DISCOVER_RAM_SCREENSHOT_SHA '+createHash('sha256').update(screenshot).digest('hex').slice(0,16));
 assert.deepEqual(denied,[],'no external Provider/Cloud POST/WS/Writer or media upload');
 assert.deepEqual(errors,[],'no renderer errors');
 console.log('QR_MAIN90D_DEPLOYED_DISCOVER_SEVEN_ROOTS_NO_EXTERNAL_WRITER_PASS');
}finally{await ctx.close();await browser.close();}
