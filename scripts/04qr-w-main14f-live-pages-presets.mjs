// 04 QR-W independent DEPLOYED Pages QA, NOT a repeat of Source localhost PR563.
// Exact protected main 14f85625 (Presets PR557 merged), no private Save or writer.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {PRESETS_STAGE1_ROOT,PRESETS_STAGE1_IN_GAME,presetsStage1Copy} from '../src/lib/presets/stage1-root.mjs';

const MAIN='14f85625c06f277f580581f73897748367bcfe7a';
const ORIGIN='https://dreamwishwand.github.io';
const BASE=ORIGIN+'/web';
const QA_PATHS=[
 '.github/workflows/04qr-w-main14f-live-pages-presets.yml',
 'scripts/04qr-w-main14f-live-pages-presets.mjs'
].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(!process.env.CHROME_BIN)throw Error('QA_NOT_RUN_SYSTEM_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QA_PRIVATE_OWNER_SAVE_NOT_AUTHORIZED_IN_PUBLIC_CI');
assert.equal(git('merge-base',MAIN,'HEAD'),MAIN,'QA must be based on fixed protected main');
assert.deepEqual(git('diff','--name-only',MAIN,'HEAD').split('\n').sort(),QA_PATHS,'QA-only: never alter Source/Pages/CI production');
for(const [path,sha] of Object.entries({
 'src/routes/presets/+page.svelte':'55f8522f0e0099b69e780ab04191c66cd3bc05ff',
 'src/lib/presets/stage1-root.mjs':'7f741542e0f7f5d7df0b8e51caf1e32c9d617c58',
 'scripts/web-stage1-presets-chrome.mjs':'91e8b8bd354fd6d060da151dfeccac23873d711f'
}))assert.equal(git('rev-parse',MAIN+':'+path),sha,path+' source identity must remain exact');

async function assertProtectedMainUnmoved(){
 const resp=await fetch('https://api.github.com/repos/DreamwishWand/web/branches/main',{
  headers:{'Accept':'application/vnd.github+json','User-Agent':'dreamwishwand-independent-pages-qa'}
 });
 if(!resp.ok)throw Error('QA_WAIT_GITHUB_LIVE_MAIN_HTTP_'+resp.status);
 const data=await resp.json();
 if(data.commit?.sha!==MAIN)throw Error('QA_WAIT_HEAD_MAIN_MOVED_'+data.commit?.sha);
}
await assertProtectedMainUnmoved();
const publicProbe=await fetch(BASE+'/presets/',{redirect:'manual'});
assert.equal(publicProbe.status,200,'actual public Pages Presets direct route must return HTTP200, not SPA fallback404');
assert.match(publicProbe.headers.get('content-type')??'',/text\/html/i);
const html=await publicProbe.text();
assert.match(html,/presets/i,'public route is HTML, not a stub response');
const homeProbe=await fetch(BASE+'/',{redirect:'manual'});
assert.equal(homeProbe.status,200,'actual public Home direct route must return HTTP200');
const homeHtml=await homeProbe.text();
assert.match(homeHtml,/Dreamwish Wand/i);
console.log('QR_MAIN14F_DEPLOYED_PAGES_HOME_AND_PRESETS_DIRECT_HTTP200_PASS');

const denied=[],errors=[];
const browser=await chromium.launch({
 executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
});
const ctx=await browser.newContext({viewport:{width:1260,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage();
page.on('pageerror',error=>errors.push(String(error)));
if(typeof page.routeWebSocket!=='function')throw Error('QA_NOT_RUN_WEBSOCKET_ROUTE_UNAVAILABLE');
await page.routeWebSocket('**/*',route=>{denied.push('WS '+route.url());route.close();});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===ORIGIN&&['GET','HEAD'].includes(req.method()))route.continue();
 else{denied.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
async function fit(label){
 const dims=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  scroll:document.documentElement.scrollWidth
 }));
 assert.ok(dims.scroll<=dims.viewport+2,label+': '+JSON.stringify(dims));
}
try{
 const response=await page.goto(BASE+'/presets/',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(response?.status(),200);
 const cards=page.locator('[data-stage1-presets-four-cards] button');
 await cards.first().waitFor({state:'visible',timeout:40000});
 assert.deepEqual(await cards.evaluateAll(xs=>xs.map(x=>x.getAttribute('data-preset-child'))),PRESETS_STAGE1_ROOT);
 const root=page.locator('[data-stage1-presets-root]');
 for(const attr of ['data-native-writer','data-provider-gate','data-tom-writer'])assert.equal(await root.getAttribute(attr),'off');
 assert.equal(await page.locator('.panel,.preflight-card').count(),0,'no auto Native/Provider editor');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(label=>document.querySelector('[data-preset-child="inGame"] strong')?.textContent?.trim()===label,
  presetsStage1Copy('ja').inGame,{timeout:25000});
 assert.equal((await page.locator('[data-preset-child="inGame"] strong').innerText()).trim(),'ゲーム内プリセット');
 await page.locator('[data-preset-child="inGame"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-preset-child')),'inGame');
 await page.keyboard.press('Enter');
 const inGame=page.locator('[data-stage1-presets-ingame]');
 await inGame.waitFor({state:'visible',timeout:20000});
 assert.deepEqual(await inGame.locator('button').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-preset-ingame-child'))),PRESETS_STAGE1_IN_GAME);
 await inGame.locator('[data-preset-ingame-child="shop"]').click();
 await page.locator('[data-preset-unavailable]').waitFor({state:'visible'});
 assert.equal(await page.locator('.panel,.preflight-card').count(),0);
 await page.locator('.preset-back').click();
 await cards.first().waitFor({state:'visible'});
 await page.locator('[data-preset-child="touchOfMagic"]').click();
 await page.locator('[data-preset-unavailable]').waitFor({state:'visible'});
 await page.locator('.preset-back').click();
 await cards.first().waitFor({state:'visible'});
 console.log('QR_MAIN14F_DEPLOYED_PAGES_REAL_CHROME_PRESETS_ROOT4_INGAME2_JA_OFF_PASS');
 await page.setViewportSize({width:320,height:780});
 await fit('public Presets 320px');
 await page.setViewportSize({width:640,height:800});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('public Presets zoom200');
 const png=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(png.length>5000);
 console.log('QR_MAIN14F_DEPLOYED_PAGES_RAM_SCREENSHOT_SHA '+createHash('sha256').update(png).digest('hex').slice(0,16));
 await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.setViewportSize({width:1260,height:850});
 const collection=await page.goto(BASE+'/collection/',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(collection?.status(),200,'actual public collection route direct HTTP200');
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:45000});
 assert.equal(await page.locator('[data-stage1-category-grid] .category-card').count(),29);
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-personal-progress'),'unknown');
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-writer'),'off');
 console.log('QR_MAIN14F_DEPLOYED_PAGES_COMPOSED_COLLECTION29_UNKNOWN_WRITER_OFF_PASS');
 assert.deepEqual(denied,[],'public Pages root must never initiate offhost network or POST/WS');
 assert.deepEqual(errors,[],'public Pages must not throw browser pageerror');
 await assertProtectedMainUnmoved();
 console.log('QR_MAIN14F_DEPLOYED_PAGES_ONLY_GET_HEAD_ON_ORIGIN_AND_MAIN_STABLE_PASS');
}finally{await ctx.close();await browser.close();}
