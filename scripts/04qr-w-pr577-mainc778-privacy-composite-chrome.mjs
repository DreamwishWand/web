import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const origin='http://127.0.0.1:4332';
if(!process.env.CHROME_BIN)throw Error('ACTUAL_CHROME_REQUIRED');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 if(process.env[k])throw Error('PRIVATE_SAVE_FORBIDDEN_'+k);
for(const p of ['/gallery/my/','/dreamsnaps/results/']){
 const r=await fetch(origin+p);
 assert.equal(r.status,200);
 assert.match(await r.text(),/<meta name="robots" content="noindex,nofollow"\s*\/?>/i);
 console.log('QR_DISCOVER_MAINC778_HTML_NOINDEX '+p+' PASS');
}
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage(),denied=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('WS_BOUNDARY_REQUIRED');
await page.routeWebSocket('**/*',route=>{
 const u=new URL(route.url());
 if(u.hostname==='127.0.0.1'&&u.port==='4332')route.connectToServer();
 else{denied.push('WS '+route.url());route.close();}
});
await page.route('**/*',route=>{
 const r=route.request(),u=new URL(r.url());
 if(u.origin===origin&&['GET','HEAD'].includes(r.method()))route.continue();
 else{denied.push(r.method()+' '+r.url());route.abort('blockedbyclient');}
});
async function navigate(link,path){
 await link.focus();
 assert.equal(await link.getAttribute('href'),path);
 await page.keyboard.press('Enter');
 await page.waitForURL(u=>u.pathname===path,{timeout:24000});
}
async function discover(){
 await page.goto(origin+'/discover/',{waitUntil:'networkidle',timeout:45000});
 await page.locator('[data-discover-stage1="orientation-not-dashboard"]').waitFor({state:'visible'});
}
try{
 await page.goto(origin+'/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(await page.locator('.home-product-grid a.visual-card').count(),6);
 await page.locator('#site-locale').selectOption('ja');
 await navigate(page.locator('.toolbar-context-link[href="/discover/"]').first(),'/discover/');
 const root=page.locator('[data-discover-stage1="orientation-not-dashboard"]');
 assert.equal(await root.getAttribute('data-public-writer'),'off');
 assert.equal(await root.getAttribute('data-save-auto-upload'),'off');
 assert.deepEqual(await root.locator('[data-discover-product]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-discover-product'))),['decorate','collection','guide','presets','gallery','dreamsnaps','help']);
 console.log('QR_DISCOVER_MAINC778_HOME_DISCOVER7_WRITER_AUTOUPLOAD_OFF_PASS');
 await navigate(root.locator('a[data-discover-destination="gallery"]'),'/gallery/');
 const gallery=page.locator('[data-stage1-gallery-root]');
 await gallery.waitFor({state:'visible'});
 assert.equal(await gallery.getAttribute('data-writer'),'off');
 assert.deepEqual(await gallery.locator('[data-gallery-child]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-gallery-child'))),['decorations','touchOfMagic','myGallery']);
 await navigate(gallery.locator('[data-gallery-child="myGallery"]'),'/gallery/my/');
 assert.deepEqual(await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content)),['noindex,nofollow']);
 console.log('QR_DISCOVER_MAINC778_GALLERY_MY_NOINDEX_PASS');
 await discover();
 await navigate(page.locator('a[data-discover-destination="dreamsnaps"]'),'/dreamsnaps/');
 const snaps=page.locator('[data-stage1-dreamsnaps-root="1-3-1"]');
 await snaps.waitFor({state:'visible'});
 for(const k of ['data-public-provider','data-private-results','data-writer'])assert.equal(await snaps.getAttribute(k),'off');
 await navigate(snaps.locator('[data-dreamsnaps-child="results"]'),'/dreamsnaps/results/');
 assert.deepEqual(await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content)),['noindex,nofollow']);
 console.log('QR_DISCOVER_MAINC778_DREAMSNAPS_RESULTS_NOINDEX_PASS');
 await discover();
 await navigate(page.locator('a[data-discover-destination="help"]'),'/help/');
 await page.locator('[data-help-root="four-children"]').waitFor({state:'visible'});
 await discover();
 async function fit(label){
  const x=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(x.scroll<=x.width+2,label+': '+JSON.stringify(x));
 }
 await page.setViewportSize({width:320,height:780});
 await fit('320px');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('200%');
 assert.deepEqual(denied,[]);
 assert.deepEqual(errors,[]);
 console.log('QR_DISCOVER_MAINC778_COMPOSED_CHROME_ALL_BOUNDARIES_PASS');
}finally{await ctx.close();await browser.close();}
