// 04 QR-W independently composed Source e67cc496 on protected main bd2edd00.
// NEW-only actual Chrome: Presets 4→2 OFF + Collection typed Item→Moodboard local replay.
// No actual private P1G, no Source mutation, no Writer/Provider/Cloud authorization.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {PRESETS_STAGE1_ROOT,PRESETS_STAGE1_IN_GAME} from '../src/lib/presets/stage1-root.mjs';
const root=process.env.QR557_URL||'http://127.0.0.1:4307';
if(root!=='http://127.0.0.1:4307')throw Error('QR557_EXACT_LOOPBACK_REQUIRED');
if(!process.env.CHROME_BIN)throw Error('QR557_ACTUAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR557_PRIVATE_SAVE_IN_CI_DENIED');
const denied=[],errors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR557_WEBSOCKET_GATE_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const url=new URL(route.url());
  if(url.protocol==='ws:'&&url.hostname==='127.0.0.1'&&url.port==='4307')route.connectToServer();
  else{denied.push('WS '+route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===root&&['GET','HEAD'].includes(req.method()))route.continue();
  else{denied.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
 });
 const fit=async(label)=>{
  const d=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(d.scroll<=d.client+2,label+' '+JSON.stringify(d));
 };
 // Unique integration risk: both Presets and the repaired shared Item script on one new main.
 await page.goto(root+'/moodboards/',{waitUntil:'networkidle'});
 await page.locator('form.create-board input').first().fill('QR557 local integration');
 await page.locator('form.create-board button[type="submit"]').click();
 await page.locator('.board-list>button').filter({hasText:'QR557 local integration'}).waitFor({timeout:25000});
 await page.goto(root+'/presets/',{waitUntil:'networkidle'});
 const surface=page.locator('[data-stage1-presets-root]');
 const cards=page.locator('[data-stage1-presets-four-cards] button');
 await cards.first().waitFor({state:'visible',timeout:30000});
 assert.deepEqual(await cards.evaluateAll(a=>a.map(x=>x.getAttribute('data-preset-child'))),PRESETS_STAGE1_ROOT);
 assert.equal(await surface.getAttribute('data-native-writer'),'off');
 assert.equal(await surface.getAttribute('data-provider-gate'),'off');
 assert.equal(await surface.getAttribute('data-tom-writer'),'off');
 assert.equal(await page.locator('.panel,.preflight-card').count(),0,'root must not auto-open Native/Community');
 await page.locator('[data-preset-child="inGame"]').focus();
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-preset-child')),'inGame');
 await page.keyboard.press('Enter');
 const inGame=page.locator('[data-stage1-presets-ingame]');
 await inGame.waitFor({state:'visible',timeout:15000});
 assert.deepEqual(await inGame.locator('button').evaluateAll(a=>a.map(x=>x.getAttribute('data-preset-ingame-child'))),PRESETS_STAGE1_IN_GAME);
 await inGame.locator('[data-preset-ingame-child="shop"]').click();
 await page.locator('[data-preset-unavailable]').waitFor();
 assert.equal(await page.locator('.panel,.preflight-card').count(),0);
 await page.locator('.preset-back').click();
 await page.locator('[data-preset-child="touchOfMagic"]').click();
 await page.locator('[data-preset-unavailable]').waitFor();
 assert.equal(await page.locator('.panel,.preflight-card').count(),0);
 await page.locator('.preset-back').click();
 await cards.first().waitFor();
 console.log('QR557 PRESSETS_4ROOT_2INGAME_KEYBOARD_SHOP_TOM_OFF_SOURCE_COMPOSED_PASS');

 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:35000});
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-personal-progress'),'unknown');
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-writer'),'off');
 await page.locator('[data-stage1-search]').fill('40000047');
 await page.locator('[data-stage1-search-groups] .item-card').first().waitFor({timeout:20000});
 assert.equal(await page.locator('[data-stage1-search-groups] .item-card').count(),1);
 await page.locator('[data-stage1-search-groups] .item-card').first().click();
 const info=page.locator('[data-stage1-item-info]');
 await info.waitFor({timeout:15000});
 assert.match(await info.innerText(),/40000047/);
 await info.locator('.info-actions a').click();
 await page.locator('[data-shared-entity-detail="preview"] h1').waitFor({timeout:30000});
 const identity=await page.locator('[data-entity-identity]').innerText();
 assert.match(identity,/40000047/);
 assert.match(identity,/52BD625D9B4E0053/);
 assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow');
 await page.locator('#shared-entity-board').selectOption({index:0});
 await page.locator('[data-shared-detail-moodboard-action] button').click();
 await page.locator('[data-shared-detail-moodboard-action] [role="status"]').waitFor({timeout:25000});
 await page.goto(root+'/moodboards/',{waitUntil:'domcontentloaded'});
 await page.locator('.reference-card').filter({hasText:'40000047'}).first().waitFor({timeout:20000});
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('.reference-card').filter({hasText:'40000047'}).count(),1);
 console.log('QR557 COMPOSED_COLLECTION_ITEM40000047_TYPED_SOURCE_MOODBOARD_LOCAL_RELOAD_PASS');

 await page.setViewportSize({width:320,height:780});
 await page.goto(root+'/presets/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-presets-four-cards] button').first().waitFor({timeout:25000});
 await fit('Presets mobile320');
 assert.equal(await cards.count(),4);
 await page.locator('#site-locale').selectOption('ja');
 await page.locator('[data-preset-child="inGame"]').click();
 await page.locator('[data-stage1-presets-ingame]').waitFor();
 await fit('InGame mobile320');
 await page.locator('.preset-back').click();
 await page.setViewportSize({width:640,height:800});
 await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await fit('Presets zoom200');
 const screenshot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(screenshot.length>6000);
 console.log('QR557 COMPOSED_320_ZOOM200_RAM_PNG_SHA '+createHash('sha256').update(screenshot).digest('hex').slice(0,16));
 assert.deepEqual(denied,[],'no offhost GET/POST/WS or provider/Cloud');
 assert.deepEqual(errors,[],'no browser page errors');
 console.log('QR557 COMPOSED_NO_OFFHOST_NETWORK_OR_PRIVATE_SAVE_PASS');
 await ctx.close();
}finally{await browser.close();}
