// 04 QR-W independent REAL installed Chrome product-local Shell behavioral acceptance.
// Fixed main90d + Owner PR597 Source only. No private Owner P1G, external Provider or Writer.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {resolveProductShell} from '../src/lib/ui/product-shell-navigation.mjs';
const ORIGIN='http://127.0.0.1:4337';
if(!process.env.CHROME_BIN)throw Error('NOT_RUN: actual Google Chrome required');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED'])
 if(process.env[k])throw Error('Owner private Save forbidden in CI: '+k);
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage(),blocked=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('WebSocket boundary unavailable');
await page.routeWebSocket('**/*',route=>{
 const u=new URL(route.url());
 if(u.hostname==='127.0.0.1'&&u.port==='4337')route.connectToServer();
 else{blocked.push('WS '+route.url());route.close();}
});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{blocked.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
async function open(path){
 const r=await page.goto(ORIGIN+path,{waitUntil:'networkidle',timeout:45000});
 assert.equal(r?.status(),200,'route direct HTTP200 '+path);
 await page.locator('[data-shared-app-shell]').waitFor({state:'visible',timeout:25000});
}
async function assertCurrent(product,section=null,mode='standard'){
 const header=page.locator('header[data-shared-app-shell]');
 assert.equal(await header.getAttribute('data-current-product'),product);
 assert.equal(await header.getAttribute('data-shell-presentation'),mode);
 const nav=header.locator('nav[data-product-local-navigation]');
 const active=await nav.locator('a[aria-current="page"][data-product-section]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-product-section')));
 assert.deepEqual(active,section?[section]:[]);
 const sections=await nav.locator('a[data-product-section]').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')));
 return sections;
}
async function assertNoFalseAction(){
 assert.equal(await page.locator('.desktop-app-toolbar [data-shell-control="save"]:disabled').count(),1,'unbound Save is disabled');
 assert.equal(await page.locator('.desktop-app-toolbar [data-shell-control="account"]:disabled').count(),1,'unbound Account is disabled');
 assert.equal(await page.locator('[data-shell-control="notifications"],[data-shell-control="notifications-mobile"]').count(),0,'signed-out notifications hidden');
}
async function noOverflow(tag){
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
 assert.ok(size.scroll<=size.client+2,tag+': '+JSON.stringify(size));
}
async function goDesktop(selector,path){
 const link=page.locator(selector).first();
 await link.focus();
 assert.equal(await link.getAttribute('href'),path);
 await page.keyboard.press('Enter');
 await page.waitForURL(u=>u.pathname===path,{timeout:23000});
}
try{
 await open('/');
 assert.equal(await assertCurrent('home'),undefined); // allow only Home/Discover, no seven-Product global switcher
 const homeNav=page.locator('nav[data-product-local-navigation]');
 assert.equal(await homeNav.locator('a[data-product-section]').count(),0);
 assert.equal(await homeNav.locator('a[href="/discover/"]').count(),1);
 await assertNoFalseAction();
 assert.equal(await page.locator('.home-product-grid a.visual-card').count(),6);
 await goDesktop('.home-product-grid a.visual-card[href="/decorate/"]','/decorate/');
 assert.deepEqual(await assertCurrent('decorate'),['/explore/','/moodboards/','/editor/world/']);
 assert.equal(await page.locator('nav[data-product-local-navigation] [data-product-root][aria-current="page"]').count(),1);
 await assertNoFalseAction();
 console.log('QR_PR597_HOME_DECORATE_LOCAL_THREE_AND_DISABLED_ACCOUNT_SAVE_PASS');

 for(const lang of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(l=>document.documentElement.dataset.locale===l,lang,{timeout:19000});
  const expected=resolveProductShell('/decorate/',lang);
  const labels=await page.locator('nav[data-product-local-navigation] a').allTextContents();
  assert.deepEqual(labels.map(x=>x.trim()),[expected.rootLabel,...expected.sections.map(x=>x.label)],lang+' actual localized nav');
 }
 console.log('QR_PR597_EIGHT_LOCALE_PRODUCT_LOCAL_NAV_REAL_CHROME_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await goDesktop('nav[data-product-local-navigation] [data-product-section="explore"]','/explore/');
 assert.deepEqual(await assertCurrent('decorate','explore'),['/explore/','/moodboards/','/editor/world/']);
 await goDesktop('nav[data-product-local-navigation] [data-product-section="moodboards"]','/moodboards/');
 assert.deepEqual(await assertCurrent('decorate','moodboards'),['/explore/','/moodboards/','/editor/world/']);
 await open('/editor/world/');
 assert.deepEqual(await assertCurrent('decorate','editor','immersive'),['/explore/','/moodboards/','/editor/world/']);
 assert.equal(await page.locator('[data-immersive-recovery] a[href="/decorate/"]').count(),1);
 await goDesktop('[data-immersive-recovery] a[href="/decorate/"]','/decorate/');
 assert.deepEqual(await assertCurrent('decorate'),['/explore/','/moodboards/','/editor/world/']);
 console.log('QR_PR597_FIRSTLEVEL_SWITCH_ACTIVE_AND_IMMERSIVE_RECOVERY_PASS');

 await open('/gallery/my/');
 assert.deepEqual(await assertCurrent('gallery','my'),['/gallery/my/']);
 assert.deepEqual(await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content)),['noindex,nofollow']);
 await open('/dreamsnaps/results/');
 assert.deepEqual(await assertCurrent('dreamsnaps','results'),[
  '/dreamsnaps/community/','/dreamsnaps/submit/','/dreamsnaps/judge/','/dreamsnaps/results/','/dreamsnaps/my/'
 ]);
 assert.deepEqual(await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content)),['noindex,nofollow']);
 await open('/help/questions/');
 assert.deepEqual(await assertCurrent('help','questions'),[
  '/help/questions/','/help/tips/','/help/issues/','/help/my/'
 ]);
 console.log('QR_PR597_DEEP_LINK_RELOAD_CONTEXT_RESET_PRIVATE_NOINDEX_PASS');

 await page.setViewportSize({width:320,height:780});
 await open('/decorate/');
 await noOverflow('mobile decorate 320px');
 const mobile=page.locator('[data-mobile-product-sections]');
 await mobile.waitFor({state:'visible',timeout:20000});
 await mobile.click();
 const dialog=page.locator('dialog.ui-sheet[open]').filter({has:page.locator('nav[data-product-local-mobile]')});
 await dialog.waitFor({state:'visible'});
 assert.equal(await dialog.locator('a[data-product-section]').count(),3);
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden'});
 await mobile.click();
 const d2=page.locator('dialog.ui-sheet[open] nav[data-product-local-mobile]');
 await d2.waitFor({state:'visible'});
 await d2.locator('a[data-product-section="moodboards"]').click();
 await page.waitForURL(/\/moodboards\/$/,{timeout:23000});
 assert.equal(await page.locator('dialog.ui-sheet[open] nav[data-product-local-mobile]').count(),0,'sheet closes after navigation');
 assert.deepEqual(await assertCurrent('decorate','moodboards'),['/explore/','/moodboards/','/editor/world/']);
 await noOverflow('mobile moodboards 320px');
 await page.setViewportSize({width:640,height:830});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await noOverflow('200% zoom moodboards');
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>5000);
 console.log('QR_PR597_SHELL_RAM_SCREENSHOT_SHA '+createHash('sha256').update(shot).digest('hex').slice(0,16));
 assert.deepEqual(blocked,[],'no offsite HTTP/POST/WS/Provider/Cloud mutation');
 assert.deepEqual(errors,[],'no pageerror');
 console.log('QR_PR597_REAL_CHROME_SHELL_MOBILE_320_ZOOM200_NO_OFFHOST_PASS');
}finally{await context.close();await browser.close();}
