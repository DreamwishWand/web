// 04 QR-W / PR544 new main14f changed-risk Chromium: accepted Presets+Collection next to gated DreamSnaps.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
const root='http://127.0.0.1:4312';
if(!process.env.CHROME_BIN)throw Error('QR544_ACTUAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR544_PRIVATE_SAVE_FORBIDDEN_IN_PUBLIC_CI');
const denied=[],errors=[];
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('QR544_WEBSOCKET_GATE_REQUIRED');
await page.routeWebSocket('**/*',route=>{
 const url=new URL(route.url());
 if(url.protocol==='ws:'&&url.hostname==='127.0.0.1'&&url.port==='4312')route.connectToServer();
 else{denied.push('WS '+route.url());route.close();}
});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===root&&['GET','HEAD'].includes(req.method()))route.continue();
 else{denied.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
async function fit(what){
 const size=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  scroll:document.documentElement.scrollWidth
 }));
 assert.ok(size.scroll<=size.viewport+2,what+': '+JSON.stringify(size));
}
try{
 await page.goto(root+'/presets/',{waitUntil:'domcontentloaded',timeout:45000});
 const p=page.locator('[data-stage1-presets-root]');
 await p.waitFor({state:'visible',timeout:30000});
 await page.locator('[data-stage1-presets-four-cards] button').first().waitFor({state:'visible'});
 assert.equal(await page.locator('[data-stage1-presets-four-cards] button').count(),4);
 for(const x of ['data-native-writer','data-provider-gate','data-tom-writer'])assert.equal(await p.getAttribute(x),'off');
 assert.equal(await page.locator('.panel,.preflight-card').count(),0);
 console.log('QR544_MAIN14F_PRESSETS_FOUR_NO_AUTO_NATIVE_PROVIDER_PASS');
 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({state:'visible',timeout:30000});
 assert.equal(await page.locator('[data-stage1-category-grid] .category-card').count(),29);
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-personal-progress'),'unknown');
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-writer'),'off');
 console.log('QR544_MAIN14F_COLLECTION_29_UNKNOWN_WRITER_OFF_PASS');
 await page.goto(root+'/dreamsnaps/',{waitUntil:'domcontentloaded',timeout:45000});
 const d=page.locator('[data-stage1-dreamsnaps-root="1-3-1"]');
 await d.waitFor({state:'visible',timeout:30000});
 for(const attr of ['data-public-provider','data-writer','data-private-results'])assert.equal(await d.getAttribute(attr),'off');
 assert.equal(await d.getAttribute('data-media-rights'),'unverified');
 const children=page.locator('[data-dreamsnaps-child]');
 assert.deepEqual(await children.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-dreamsnaps-child'))),
  ['community','submit','judge','results','my']);
 assert.deepEqual(await children.evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname)),
  ['/dreamsnaps/community/','/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/']);
 assert.equal(await d.locator('img,video,iframe').count(),0);
 // Distinct new-main path: open inert community from keyboard while Collection and Presets share runtime.
 await page.locator('[data-dreamsnaps-child="community"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-dreamsnaps-child')),'community');
 await page.keyboard.press('Enter');
 const c=page.locator('[data-community-dreamsnaps="gated"]');
 await c.waitFor({state:'visible',timeout:30000});
 assert.match(page.url(),/\/dreamsnaps\/community\/$/);
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
 for(const attr of ['data-public-provider','data-writer','data-private-results'])assert.equal(await c.getAttribute(attr),'off');
 assert.equal(await c.getAttribute('data-media-rights'),'unverified');
 assert.equal(await c.locator('.public-modes span').count(),2);
 assert.equal(await c.locator('.public-modes button,.public-modes a').count(),0);
 await c.locator('.unavailable[role="status"]').waitFor({state:'visible'});
 assert.equal(await c.locator('img,video,iframe,form,input').count(),0);
 console.log('QR544_MAIN14F_DREAMSNAPS_131_TO_COMMUNITY_NO_INDEX_NO_PROVIDER_NO_MEDIA_PASS');
 await page.setViewportSize({width:320,height:780});
 await fit('Community gate mobile 320');
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('Community gate zoom200');
 const png=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(png.length>4500);
 console.log('QR544_MAIN14F_COMMUNITY_GATE_RAM_PNG_SHA '+createHash('sha256').update(png).digest('hex').slice(0,16));
 assert.deepEqual(denied,[],'never request offsite provider/POST/WS');
 assert.deepEqual(errors,[],'no browser page exceptions');
 console.log('QR544_MAIN14F_CROSSPAGE_NO_OFFHOST_WRITES_OR_PRIVATE_P1G_PASS');
}finally{await ctx.close();await browser.close();}
