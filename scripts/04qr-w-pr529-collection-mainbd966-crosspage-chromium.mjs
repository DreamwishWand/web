/** 04QR-W independent NEW MAIN bd966 cross-page actual Chrome:
 * Synthetic encrypted Switch626 World inspect must NEVER infer Collection owned.
 * Inherited 29x8 Collection QA527 and WEP626 QA520 are not duplicated.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
if(!process.env.CHROME_BIN)throw Error('QR529_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)throw Error('QR529_PRIVATE_P1G_DENIED');
const base=new URL(process.env.QR529_ORIGIN??'http://127.0.0.1:4288');
if(base.origin!=='http://127.0.0.1:4288')throw Error('QR529_EXACT_LOOPBACK');
const p={
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},
 World:{Villages:[{SceneItemId:1540000000,Areas:{'7':{GridIDs:[10],Unlocked:true}}}],
 GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{Opaque:true}}}}},DiffGrids:{}}}
};
const bytes=Buffer.from(makeSyntheticP1gProfile(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const originalSha=sha(bytes),errors=[],net=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',x=>errors.push(String(x)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR529_WEBSOCKET_BLOCK_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.protocol==='ws:'&&u.hostname==='127.0.0.1'&&u.port==='4288')route.connectToServer();
  else{net.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===base.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{net.push(route.request().url());route.abort('blockedbyclient');}
 });
 const collection=base.origin+'/collection/',world=base.origin+'/editor/world/';
 await page.goto(collection,{waitUntil:'domcontentloaded'});
 const cards=page.locator('[data-stage1-category-grid] .category-card');
 await cards.first().waitFor({timeout:30000});
 assert.equal(await cards.count(),29);
 const status=page.locator('[data-stage1-collection-root]');
 assert.equal(await status.getAttribute('data-personal-progress'),'unknown');
 assert.equal(await status.getAttribute('data-writer'),'off');
 assert.equal(await status.getAttribute('data-media-rights'),'unverified');
 assert.equal(await page.locator('.personal-state button').nth(1).isDisabled(),true);
 assert.equal(await page.locator('.personal-state button').nth(2).isDisabled(),true);
 await page.goto(world,{waitUntil:'domcontentloaded'});
 await page.locator('.platform-select select').selectOption('switch');
 try {
  await page.locator('[data-wep-626-bid] input').waitFor({state:'visible',timeout:9000});
 } catch(err) {
  const live=await page.evaluate(()=>({
   url:location.href,platform:document.querySelector('.platform-select select')?.value,
   bidCount:document.querySelectorAll('[data-wep-626-bid] input').length,
   platformCount:document.querySelectorAll('.platform-select select').length,
   worldOpenPanel:document.querySelectorAll('.load-panel').length,
   loadingState:document.querySelector('.load-panel')?.textContent?.slice(0,200),
   locale:document.documentElement.dataset.locale
  }));
  throw Error('QR529_CROSSPAGE_WORLD_BUILD_SELECT_DIAG '+JSON.stringify(live));
 }
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 await page.locator('.load-panel input[type=file]').setInputFiles({name:'synthetic-only-626.save',mimeType:'application/octet-stream',buffer:bytes});
 const panel=page.locator('[data-wep-626-readonly]');
 await panel.waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>document.querySelector('[data-wep-626-gridobject-entries] dd')?.textContent?.trim()==='1',null,{timeout:15000});
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
 assert.equal(await page.locator('.editor-shell').count(),0);
 console.log('QR529 NEWMAIN WEP626 SYNTHETIC READONLY SOURCE COUNT1 PASS');
 await page.goto(collection,{waitUntil:'domcontentloaded'});
 await cards.first().waitFor({timeout:30000});
 assert.equal(await cards.count(),29);
 assert.equal(await status.getAttribute('data-personal-progress'),'unknown');
 assert.equal(await status.getAttribute('data-writer'),'off');
 assert.equal(await page.locator('.personal-state button').nth(1).isDisabled(),true);
 assert.equal(await page.locator('.personal-state button').nth(2).isDisabled(),true);
 const measures=await cards.locator('.category-measure').allInnerTexts();
 assert.equal(measures.length,29);
 for(const m of measures){assert.match(m,/—\s*\/\s*—/);assert.match(m,/—%/);assert.ok(!/[0-9]+\s*%/.test(m));}
 assert.equal(await page.locator('input[type=file]').count(),0,'Collection cannot accept private Save');
 console.log('QR529 CROSSPAGE 626 SOURCE DOES NOT PROMOTE COLLECTION PERSONAL OWNED OR PERCENT PASS');
 await page.locator('#site-locale').selectOption('ja');
 await page.waitForFunction(()=>document.querySelector('[data-category="Memories"] .category-name')?.textContent?.trim()==='思い出',null,{timeout:12000});
 await page.setViewportSize({width:320,height:760});
 const d=await page.evaluate(()=>({w:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(d.scroll<=d.w+2,JSON.stringify(d));
 const shot=await page.screenshot({type:'png',animations:'disabled'});
 assert.ok(shot.length>6000);
 assert.equal(sha(bytes),originalSha);
 assert.deepEqual(net,[]);
 assert.deepEqual(errors,[]);
 console.log('QR529 MOBILE320 JA UI + SYNTHETIC ORIGINAL SHA + NO OFFHOST/POST/P1G UPLOAD PASS');
 await ctx.close();
}finally{await browser.close();}
