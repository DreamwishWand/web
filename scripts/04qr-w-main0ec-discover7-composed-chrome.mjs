// 04 QR-W actual Chrome ephemeral composition: fixed protected main0ec + exact five accepted Discover Source files.
// Run ONLY in disposable GitHub Actions checkout, do not merge or publish this QA branch.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {orientationCopy,ORIENTATION_DESTINATIONS} from '../src/lib/product-home/orientation-stage1-copy.mjs';
const ORIGIN='http://127.0.0.1:4321';
if(!process.env.CHROME_BIN)throw Error('QR_DISCOVER_REAL_CHROME_REQUIRED');
for(const key of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 if(process.env[key])throw Error('QR_DISCOVER_PRIVATE_OWNER_P1G_DENIED: '+key);
const deny=[],errors=[];
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(String(error)));
if(typeof page.routeWebSocket!=='function')throw Error('QR_DISCOVER_WEBSOCKET_BOUNDARY_UNAVAILABLE');
await page.routeWebSocket('**/*',route=>{
 const url=new URL(route.url());
 if(url.protocol==='ws:'&&url.hostname==='127.0.0.1'&&url.port==='4321')route.connectToServer();
 else{deny.push('WS '+route.url());route.close();}
});
await page.route('**/*',route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(request.method()))route.continue();
 else{deny.push(request.method()+' '+request.url());route.abort('blockedbyclient');}
});
async function fit(what){
 const q=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(q.scroll<=q.width+2,what+' '+JSON.stringify(q));
}
async function returnDiscover(){
 await page.goto(ORIGIN+'/discover/',{waitUntil:'networkidle',timeout:45000});
 await page.locator('[data-discover-stage1="orientation-not-dashboard"]').waitFor({state:'visible',timeout:30000});
}
try{
 await page.goto(ORIGIN+'/',{waitUntil:'networkidle',timeout:45000});
 assert.equal(await page.locator('.home-product-grid a.visual-card').count(),6,'current-main Home six Core cards still visible');
 assert.equal(await page.locator('.home-qa-entry a.visual-card').count(),1);
 await page.locator('#site-locale').selectOption('ja');
 const discoverLink=page.locator('.toolbar-context-link[href="/discover/"]').first();
 await discoverLink.waitFor({state:'visible',timeout:30000});
 await discoverLink.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'/discover/');
 await page.keyboard.press('Enter');
 await page.waitForURL(/\/discover\/$/,{timeout:25000});
 const root=page.locator('[data-discover-stage1="orientation-not-dashboard"]');
 await root.waitFor({state:'visible',timeout:30000});
 assert.equal(await root.getAttribute('data-public-writer'),'off');
 assert.equal(await root.getAttribute('data-save-auto-upload'),'off');
 const ids=['decorate','collection','guide','presets','gallery','dreamsnaps','help'];
 assert.deepEqual(await root.locator('[data-discover-product]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-discover-product'))),ids);
 for(const id of ids){
  const card=root.locator('[data-discover-product="'+id+'"]');
  assert.equal(await card.locator('.discover-product-purpose p').count(),1,id+' purpose');
  assert.equal(await card.locator('.discover-product-start p').count(),1,id+' first step');
  const link=card.locator('a[data-discover-destination]');
  assert.equal(await link.getAttribute('href'),ORIENTATION_DESTINATIONS[ids.indexOf(id)],id+' canonical link');
 }
 assert.equal(await root.locator('[data-discover-account-optional]').count(),1);
 assert.equal(await root.locator('[data-discover-save-optional]').count(),1);
 assert.equal(await root.locator('[data-discover-capability-gated]').count(),1);
 assert.equal((await root.locator('[data-discover-account-optional] p').innerText()).trim(),orientationCopy('ja').account);
 assert.equal((await root.locator('[data-discover-save-optional] p').innerText()).trim(),orientationCopy('ja').save);
 console.log('QR_MAIN0EC_DISCOVER7_HOME_KEYBOARD_OPTIONAL_ACCOUNT_LOCAL_SAVE_WRITER_OFF_PASS');
 // Newly accepted Gallery source integrated on latest main: actual cross-product route navigation.
 const galleryLink=root.locator('a[data-discover-destination="gallery"]');
 await galleryLink.focus();await page.keyboard.press('Enter');
 await page.waitForURL(/\/gallery\/$/,{timeout:20000});
 const gallery=page.locator('[data-stage1-gallery-root]');
 await gallery.waitFor({state:'visible',timeout:20000});
 assert.deepEqual(await gallery.locator('[data-gallery-child]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-gallery-child'))),
  ['decorations','touchOfMagic','myGallery']);
 assert.equal(await gallery.getAttribute('data-writer'),'off');
 assert.equal(await gallery.getAttribute('data-media-rights'),'unverified');
 assert.equal(await gallery.locator('img,video,iframe').count(),0);
 await returnDiscover();
 const dreamLink=page.locator('a[data-discover-destination="dreamsnaps"]');
 await dreamLink.focus();await page.keyboard.press('Enter');
 await page.waitForURL(/\/dreamsnaps\/$/,{timeout:20000});
 const dreams=page.locator('[data-stage1-dreamsnaps-root="1-3-1"]');
 await dreams.waitFor({state:'visible',timeout:20000});
 assert.deepEqual(await dreams.locator('[data-dreamsnaps-child]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-dreamsnaps-child'))),
  ['community','submit','judge','results','my']);
 for(const key of ['data-public-provider','data-writer','data-private-results'])assert.equal(await dreams.getAttribute(key),'off');
 assert.equal(await dreams.getAttribute('data-media-rights'),'unverified');
 await returnDiscover();
 const help=page.locator('a[data-discover-destination="help"]');
 await help.focus();await page.keyboard.press('Enter');
 await page.waitForURL(/\/help\/$/,{timeout:20000});
 await page.locator('[data-help-root="four-children"]').waitFor({state:'visible',timeout:20000});
 console.log('QR_MAIN0EC_DISCOVER7_TO_INTEGRATED_GALLERY_DREAMSNAPS_HELP_KEYBOARD_PASS');
 await returnDiscover();
 const status=page.locator('.discover-stage1 a.discovery-status-link').first();
 assert.equal(await status.getAttribute('href'),'/rc-status/');
 await status.focus();await page.keyboard.press('Enter');
 await page.waitForURL(/\/rc-status\/$/,{timeout:20000});
 await returnDiscover();
 await page.setViewportSize({width:320,height:780});await fit('Discover integrated 320px');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('Discover integrated 200% zoom');
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>5000);
 console.log('QR_MAIN0EC_DISCOVER7_COMPOSED_RAM_SCREENSHOT_SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 assert.deepEqual(deny,[],'no offsite GET, POST/Writer, WebSocket, Cloud or Provider');
 assert.deepEqual(errors,[],'no page errors');
 console.log('QR_MAIN0EC_DISCOVER7_COMPOSED_ACTUAL_CHROME_ALL_GATES_PASS');
}finally{await context.close();await browser.close();}
