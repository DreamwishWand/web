// 04 QR-W independent MANAGED_RUNTIME acceptance: protected mainc48 Stage1 Global Shell.
// Only changed risk after accepted local Source QA598. Never read owner-private P1G.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {resolveProductShell} from '../src/lib/ui/product-shell-navigation.mjs';

const MAIN='c48e392e3bc9dc7e5844a6912b8ff2c4daf997fd';
const PREV='90d21b1b45c8743b2c4359c29d37115fd0bc355c';
const ORIGIN='https://dreamwishwand.github.io';
const BASE=ORIGIN+'/web';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const source=[
 'docs/wep/world-editor-localization-inventory-20261002.json',
 'src/lib/SiteHeader.svelte',
 'src/lib/ui/product-shell-navigation.mjs',
 'tests/web-stage1-product-shell-navigation.test.mjs',
 'tests/wep-world-editor-localization-inventory.test.mjs'
].sort();
const qa=[
 '.github/workflows/04qr-w-mainc48-shell-hosted-real-chrome.yml',
 'scripts/04qr-w-mainc48-shell-hosted-real-chrome.mjs'
].sort();
assert.ok(process.env.CHROME_BIN,'NOT_RUN actual system Chrome required');
for(const k of ['WEP_PRIVATE_P1G_PATH','WEP_PRIVATE_LOCAL_ONLY_ACK','WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED']){
 assert.ok(!process.env[k],'private original must not enter CI: '+k);
}
assert.equal(git('merge-base',PREV,MAIN),PREV);
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN);
assert.deepEqual(git('diff','--name-only',PREV,MAIN).split('\n').sort(),source,'protected main exactly accepted five Source paths');
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').split('\n').sort(),qa,'QA only exactly two files');
const pins={
 'docs/wep/world-editor-localization-inventory-20261002.json':'8a3e284934813517ae83427b5cc4760bd05b38d9',
 'src/lib/SiteHeader.svelte':'6cede86476ca6dbd3427115671367c9a1f4a433f',
 'src/lib/ui/product-shell-navigation.mjs':'8b72b0cae1c061ada4c96f9aeca5f0a0c861dc5d',
 'tests/web-stage1-product-shell-navigation.test.mjs':'b6e34667975daaec4182378f9ee88577cd7569b8',
 'tests/wep-world-editor-localization-inventory.test.mjs':'ba7cf09198c92a465f0929f851b998fe0005df3f'
};
for(const [p,blob] of Object.entries(pins))assert.equal(git('rev-parse',MAIN+':'+p),blob,p);
console.log('QR_MAINC48_ACCEPTED_FIVE_SOURCE_EXACT_QA_TWO_GIT_PINS_PASS');

async function direct(path,product){
 const response=await fetch(BASE+path,{redirect:'manual',headers:{'Cache-Control':'no-cache'}});
 assert.equal(response.status,200,'managed Pages must have direct HTTP200 '+path);
 assert.match(response.headers.get('content-type')??'',/text\/html/i,'HTML route '+path);
 const html=await response.text();
 assert.ok(html.length>350,'not a stub '+path);
 assert.match(html,/data-shared-app-shell/,'SSR actual product Shell '+path);
 if(product)assert.ok(html.includes('data-current-product="'+product+'"'),'managed product identity '+path);
 return html;
}
// Verify server HTML before interactive app; accepted prior root/Discover/Privacy QA is reused.
for(const [route,id] of [
 ['/','home'],['/decorate/','decorate'],['/explore/','decorate'],['/moodboards/','decorate'],
 ['/editor/world/','decorate'],['/collection/','collection'],['/guide/','guide'],
 ['/presets/','presets'],['/gallery/','gallery'],['/dreamsnaps/','dreamsnaps'],['/help/','help']
])await direct(route,id);
for(const path of ['/gallery/my/','/dreamsnaps/results/']){
 const html=await direct(path,path.startsWith('/gallery/')?'gallery':'dreamsnaps');
 assert.match(html,/<meta[^>]+name="robots"[^>]+content="noindex,nofollow"/i,'private gated route raw HTML noindex '+path);
}
console.log('QR_MAINC48_MANAGED_HTTPS_DIRECT_200_PRODUCT_SHELL_AND_PRIVATE_ROBOTS_PASS');

const browser=await chromium.launch({
 executablePath:process.env.CHROME_BIN,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']
});
const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await context.newPage();
const denied=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('NOT_RUN WebSocket boundary unavailable');
await page.routeWebSocket('**/*',r=>{denied.push('WS '+r.url());r.close();});
await page.route('**/*',r=>{
 const req=r.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))r.continue();
 else{denied.push(req.method()+' '+req.url());r.abort('blockedbyclient');}
});
async function open(path){
 const r=await page.goto(BASE+path,{waitUntil:'networkidle',timeout:45000});
 assert.equal(r?.status(),200,'real hosted browser '+path);
 await page.locator('header[data-shared-app-shell]').waitFor({state:'visible'});
}
async function current(id,section=null,mode='standard'){
 const h=page.locator('header[data-shared-app-shell]');
 assert.equal(await h.getAttribute('data-current-product'),id);
 assert.equal(await h.getAttribute('data-shell-presentation'),mode);
 const links=await h.locator('nav[data-product-local-navigation] [data-product-section]').evaluateAll(xs=>
  xs.map(x=>({id:x.getAttribute('data-product-section'),href:x.getAttribute('href'),active:x.getAttribute('aria-current')==='page'})));
 assert.equal(links.filter(x=>x.active).length,section?1:0);
 if(section)assert.equal(links.find(x=>x.active)?.id,section);
 return links;
}
async function keyboardClick(selector,path){
 const el=page.locator(selector).first();
 assert.equal(await el.getAttribute('href'),'/web'+path);
 await el.focus();
 await page.keyboard.press('Enter');
 await page.waitForURL(u=>u.pathname==='/web'+path,{timeout:24000});
}
async function noOverflow(context){
 const x=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.client+2,context+' '+JSON.stringify(x));
}
async function disabledControls(){
 assert.equal(await page.locator('.desktop-app-toolbar [data-shell-control="save"]:disabled').count(),1,'unbound Save must not simulate success');
 assert.equal(await page.locator('.desktop-app-toolbar [data-shell-control="account"]:disabled').count(),1,'unbound Account must not pretend signed-in');
 assert.equal(await page.locator('[data-shell-control="notifications"],[data-shell-control="notifications-mobile"]').count(),0,'no signed-out notification');
}
try{
 await open('/');
 assert.deepEqual(await current('home'),[]);
 assert.equal(await page.locator('nav[data-product-local-navigation] [data-product-section]').count(),0,'no seven-product universal toolbar');
 await disabledControls();
 await keyboardClick('.home-product-grid a.visual-card[href="/web/decorate/"]','/decorate/');
 let sections=await current('decorate');
 assert.deepEqual(sections.map(x=>x.href),['/web/explore/','/web/moodboards/','/web/editor/world/']);
 assert.equal(await page.locator('[data-product-root][aria-current="page"]').count(),1);
 await disabledControls();
 console.log('QR_MAINC48_MANAGED_HOME_DECORATE_THREE_LOCAL_NAV_DISABLED_FALSE_ACTIONS_PASS');

 for(const lang of ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(l=>document.documentElement.dataset.locale===l,lang,{timeout:18000});
  const model=resolveProductShell('/decorate/',lang);
  const labels=await page.locator('nav[data-product-local-navigation] a').allTextContents();
  assert.deepEqual(labels.map(s=>s.trim()),[model.rootLabel,...model.sections.map(s=>s.label)],lang+' managed actual locales');
 }
 console.log('QR_MAINC48_MANAGED_EIGHT_LOCALE_LOCAL_NAV_PASS');
 await page.locator('#site-locale').selectOption('ja');
 await keyboardClick('[data-product-local-navigation] [data-product-section="explore"]','/explore/');
 await current('decorate','explore');
 await keyboardClick('[data-product-local-navigation] [data-product-section="moodboards"]','/moodboards/');
 await current('decorate','moodboards');
 await open('/editor/world/');
 await current('decorate','editor','immersive');
 assert.equal(await page.locator('[data-immersive-recovery] a[href="/web/decorate/"]').count(),1);
 await keyboardClick('[data-immersive-recovery] a[href="/web/decorate/"]','/decorate/');
 await current('decorate');
 await page.goBack({waitUntil:'networkidle'});
 await page.waitForURL(u=>u.pathname==='/web/editor/world/',{timeout:24000});
 await current('decorate','editor','immersive');
 await keyboardClick('a.app-home-action[href="/web/"]','/');
 await current('home');
 console.log('QR_MAINC48_MANAGED_FIRSTLEVEL_BACK_VS_HOME_IMMERSIVE_KEYBOARD_PASS');

 await open('/gallery/my/');
 await current('gallery','my');
 assert.deepEqual(await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content)),['noindex,nofollow']);
 await open('/dreamsnaps/results/');
 await current('dreamsnaps','results');
 assert.deepEqual(await page.locator('meta[name="robots"]').evaluateAll(xs=>xs.map(x=>x.content)),['noindex,nofollow']);
 await open('/help/questions/');
 await current('help','questions');
 console.log('QR_MAINC48_MANAGED_DEEPLINK_PRIVACY_HELP_PRODUCT_RESET_PASS');

 await page.setViewportSize({width:320,height:780});
 await open('/decorate/');
 await noOverflow('320px hosted Decorate');
 const button=page.locator('[data-mobile-product-sections]');
 await button.waitFor({state:'visible'});
 await button.click();
 const dialog=page.locator('dialog.ui-sheet[open]').filter({has:page.locator('nav[data-product-local-mobile]')});
 await dialog.waitFor({state:'visible'});
 assert.equal(await dialog.locator('a[data-product-section]').count(),3);
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden'});
 await button.click();
 const links=page.locator('dialog.ui-sheet[open] nav[data-product-local-mobile]');
 await links.waitFor({state:'visible'});
 await links.locator('[data-product-section="moodboards"]').click();
 await page.waitForURL(u=>u.pathname==='/web/moodboards/',{timeout:24000});
 assert.equal(await page.locator('dialog.ui-sheet[open] nav[data-product-local-mobile]').count(),0,'route reset closes sheet');
 await current('decorate','moodboards');
 await noOverflow('320px hosted Moodboards');
 await page.setViewportSize({width:640,height:820});
 await page.evaluate(()=>{document.documentElement.style.zoom='2'});
 await noOverflow('200% zoom hosted');
 const bytes=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(bytes.length>5000);
 console.log('QR_MAINC48_MANAGED_SCREENSHOT_RAM_SHA '+createHash('sha256').update(bytes).digest('hex').slice(0,16));
 assert.deepEqual(denied,[],'no offorigin/Provider/Cloud GET, POST, WS, mutation');
 assert.deepEqual(errors,[],'no JS pageerror');
 console.log('QR_MAINC48_MANAGED_SHELL_320_200_NEGATIVE_NETWORK_PASS');
}finally{
 await context.close();
 await browser.close();
}