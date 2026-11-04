/** Independent 04 QR-W NEW-CUMULATIVE main24a6+PR499 actual Chromium.
 * Synthetic encrypted P1G only; real owner's local 624/626 P1G never provided to CI.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
if(!process.env.CHROME_BIN)throw Error('QR514_SYSTEM_CHROME_MISSING');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)throw Error('QR514_PRIVATE_SAVE_CI_FORBIDDEN');
const url=new URL(process.env.QR514_LOOPBACK_URL??'http://127.0.0.1:4179/editor/world/');
if(url.href!=='http://127.0.0.1:4179/editor/world/')throw Error('QR514_LOOPBACK_ONLY');
const make=(version=626)=>({
 GameInfo:{Version:version,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},
 World:{Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true}}}],
 GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{Opaque:true}}}}},DiffGrids:{}}}
});
const prof626=make();
prof626.World.GridCollection.Grids['11']={ID:11,Objects:{'43':{State:{}},'44':{State:{}}}};
prof626.World.GridCollection.DiffGrids={'10':{ID:10,Objects:{'45':{State:{}}}}};
const src626=Buffer.from(makeSyntheticP1gProfile(prof626));
const src624=Buffer.from(makeSyntheticP1gProfile(make(624)));
const sha=b=>createHash('sha256').update(b).digest('hex');
const expected=[sha(src626),sha(src624)];
const pageErrors=[];const denied=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',acceptDownloads:false});
 const page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR514_WS_GUARD_UNAVAILABLE');
 await page.routeWebSocket('**/*',route=>{
  const u=new URL(route.url());
  if(u.hostname==='127.0.0.1'&&u.port==='4179'&&u.protocol==='ws:')route.connectToServer();
  else{denied.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{denied.push(u.origin);route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 const input=page.locator('.load-panel input[type=file]');
 const panel=page.locator('[data-wep-626-readonly]');
 const send=async(bytes)=>{
  await input.setInputFiles({name:'synthetic-composite-profile.save',mimeType:'application/octet-stream',buffer:bytes});
 };
 await send(src626);
 await panel.waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>document.querySelector('[data-wep-626-gridobject-entries] dd')?.textContent?.trim()==='3',null,{timeout:15000});
 assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),'3');
 assert.equal(await page.locator('.editor-shell').count(),0);
 assert.equal(await page.locator('.toolbar-actions').count(),0);
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
 assert.equal(await page.getByRole('button',{name:'Open in Canvas'}).count(),0);
 assert.equal(await page.locator('.area-route-list').count(),0);
 console.log('QR514 COMPOSED MAIN24A6+PR499 SYNTHETIC626 GRID DIFF OVERLAP COUNT3 READONLY PASS');
 await page.setViewportSize({width:320,height:740});
 const layout=await page.evaluate(()=>({vw:innerWidth,content:document.documentElement.scrollWidth}));
 assert.ok(layout.content<=layout.vw+2,JSON.stringify(layout));
 assert.equal(await panel.isVisible(),true);
 console.log('QR514 MAIN24A6 COMPOSED 320PX READONLY PASS');
 await page.setViewportSize({width:1280,height:800});
 await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
 await send(src626);
 await panel.waitFor({state:'detached',timeout:15000});
 assert.equal(await panel.count(),0);
 console.log('QR514 WRONG BID CLEARS MAIN-COMPOSED626 PASS');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await send(src624);
 await page.locator('.area-route-list .area-route').first().waitFor({state:'visible',timeout:15000});
 assert.equal(await panel.count(),0);
 console.log('QR514 MAIN24A6 EXISTING624 ROUTE REENTRANT PASS');
 await send(src626);
 await panel.waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>document.querySelector('[data-wep-626-gridobject-entries] dd')?.textContent?.trim()==='3',null,{timeout:15000});
 assert.equal(await page.locator('.area-route-list').count(),0);
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
 console.log('QR514 SCHEMA624 TO626 RETURN READONLY WITHOUT WRITER PASS');
 assert.deepEqual([sha(src626),sha(src624)],expected);
 assert.deepEqual(pageErrors,[]);
 assert.deepEqual(denied,[]);
 console.log('QR514 ENCRYPTED SYNTHETIC BOTH ORIGINAL SHA + NO OFFHOST PASS');
 await context.close();
}finally{await browser.close();}
