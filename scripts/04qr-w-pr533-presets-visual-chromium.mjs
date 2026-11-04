/** 04 QR-W independent actual Chrome Stage1 Presets nested four→two.
 * No owner-private Save/Provider/Shop Creator Media or Writer capabilities.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {PRESETS_STAGE1_ROOT,PRESETS_STAGE1_IN_GAME,presetsStage1Copy} from '../src/lib/presets/stage1-root.mjs';
if(!process.env.CHROME_BIN)throw Error('QR533_REAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)throw Error('QR533_REAL_P1G_DENIED');
const url=new URL(process.env.QR533_URL??'http://127.0.0.1:4294/presets/');
if(url.href!=='http://127.0.0.1:4294/presets/')throw Error('QR533_EXACT_LOOPBACK');
const deny=[],errors=[],langs=['en','fr','it','de','es-ES','ja','zh-CN','pt-BR'];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR533_WS_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4294')route.connectToServer();
  else{deny.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{deny.push(route.request().method()+' '+route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 const root=page.locator('[data-stage1-presets-root]');
 await root.waitFor({state:'visible',timeout:30000});
 const grid=root.locator('[data-stage1-presets-four-cards]');
 await grid.waitFor();
 const cards=grid.locator('button[data-preset-child]');
 for(const lang of langs){
  await page.locator('#site-locale').selectOption(lang);
  await page.waitForFunction(({lang,name})=>
   document.documentElement.dataset.locale===lang &&
   document.querySelector('[data-preset-child="wand"] strong')?.textContent?.trim()===name,
   {lang,name:presetsStage1Copy(lang).wand},{timeout:12000});
  assert.deepEqual(await cards.evaluateAll(a=>a.map(x=>x.dataset.presetChild)),PRESETS_STAGE1_ROOT);
  const copy=presetsStage1Copy(lang);
  for(const [id,k] of [['wand','wand'],['touchOfMagic','tom'],['inGame','inGame'],['my','my']])
   assert.equal((await grid.locator('[data-preset-child="'+id+'"] strong').innerText()).trim(),copy[k],lang+' '+id);
  assert.equal(await root.getAttribute('data-native-writer'),'off');
  assert.equal(await root.getAttribute('data-provider-gate'),'off');
  assert.equal(await root.getAttribute('data-tom-writer'),'off');
  assert.equal(await page.locator('.panel,.preflight-card').count(),0,'no workbench before explicit root choice');
  assert.equal(await page.locator('[data-stage1-presets-ingame]').count(),0);
 }
 console.log('QR533 ACTUAL 8LOCALE FOUR ROOT VISIBLE LABELS + NO MOUNTED WORKBENCH/PROVIDER PASS');
 const desktop=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(desktop.length>6500);
 console.log('QR533 PRESSETS DESKTOP PNG RAM SHA '+createHash('sha256').update(desktop).digest('hex').slice(0,16));
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(v=>document.querySelector('[data-preset-child="inGame"] strong')?.textContent?.trim()===v,'ゲーム内プリセット');
 const inGame=grid.locator('[data-preset-child="inGame"]');
 await inGame.focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset.presetChild),'inGame');
 await page.keyboard.press('Enter');
 const children=root.locator('[data-stage1-presets-ingame]');
 await children.waitFor({state:'visible',timeout:15000});
 assert.deepEqual(await children.locator('button').evaluateAll(a=>a.map(x=>x.dataset.presetIngameChild)),PRESETS_STAGE1_IN_GAME);
 assert.equal((await children.locator('[data-preset-ingame-child="shop"] strong').innerText()).trim(),'ショップ');
 await children.locator('[data-preset-ingame-child="shop"]').click();
 const unavailable=page.locator('[data-preset-unavailable]');
 await unavailable.waitFor({state:'visible'});
 assert.equal(await root.getAttribute('data-provider-gate'),'off');
 assert.equal(await page.locator('.panel,.preflight-card').count(),0,'Shop cannot mount Native/Provider interface');
 await page.locator('.preset-back').click();
 await grid.waitFor();
 await grid.locator('[data-preset-child="touchOfMagic"]').click();
 await unavailable.waitFor({state:'visible'});
 assert.equal(await root.getAttribute('data-tom-writer'),'off');
 assert.equal(await page.locator('.panel').count(),0);
 await page.locator('.preset-back').click();
 await grid.waitFor();
 console.log('QR533 REAL KEYBOARD 4ROOT→2INGAME→SHOP OFF / TOM OFF / RETURN PASS');
 await page.setViewportSize({width:320,height:770});
 const small=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(small.scroll<=small.w+2,JSON.stringify(small));
 const mobile=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(mobile.length>6000);
 await page.setViewportSize({width:640,height:850});
 await page.evaluate(()=>document.documentElement.style.zoom='2');
 const zoom=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(zoom.scroll<=zoom.w+2,JSON.stringify(zoom));
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>6000);
 assert.equal(await cards.count(),4);
 assert.deepEqual(errors,[]);
 assert.deepEqual(deny,[]);
 console.log('QR533 MOBILE320/ZOOM200/NO OFFHOST HTTP WS POST OR PRIVATE SAVE PASS');
 await ctx.close();
}finally{await browser.close();}
