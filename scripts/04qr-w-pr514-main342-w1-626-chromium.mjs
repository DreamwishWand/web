/** Actual Chromium cross-domain new-main W1 Scene source × WEP 626 read-only.
 * Encrypted SYNTHETIC P1G only. No original private Save, native game or writer.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {inspectW1SceneAreaReferences} from '../src/lib/ddv/timing/w1-scene-area-reference-readonly.mjs';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
if(!process.env.CHROME_BIN)throw Error('QR514_MAIN342_ACTUAL_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR514_MAIN342_REAL_P1G_CI_DENIED');
const url=new URL(process.env.QR514_MAIN342_URL??'http://127.0.0.1:4179/editor/world/');
if(url.href!=='http://127.0.0.1:4179/editor/world/')throw Error('QR514_MAIN342_EXACT_LOOPBACK_ONLY');
const source=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},Player:{},
 World:{Villages:[
  {SceneItemId:1540000000,Areas:{'1':{Unlocked:true,GridIDs:[10,20]},'7':{Unlocked:false,GridIDs:[21]}}},
  {SceneItemId:1540000001,Areas:{'20':{Unlocked:true,GridIDs:[]}}}
 ],GridCollection:{Grids:{
  '10':{ID:10,Objects:{'42':{State:{FutureOpaque:true}},'43':{State:{}}}},
  '20':{ID:20,Objects:{'44':{State:{}}}}
 },DiffGrids:{'10':{ID:10,ModifiedObjects:{},RemovedObjects:{}},'21':{ID:21,ModifiedObjects:{},RemovedObjects:{}}}}}
});
const ctx={platform:'Nintendo Switch',gameVersion:'1.25.3',bid:'9A239D3DB569756D',schema:626,sourceSha256:'a'.repeat(64),sourceRevision:'untrusted'};
const good=source(),bad=source();bad.World.GridCollection.DiffGrids['10'].ID=999;
assert.equal(inspectW1SceneAreaReferences(good,ctx).status,'SAVED_SCENE_AREA_REFERENCES_SOURCE_ONLY');
assert.equal(inspectW1SceneAreaReferences(bad,ctx).status,'SOURCE_STRUCTURE_REJECTED');
const buffers=[good,bad].map(v=>Buffer.from(makeSyntheticP1gProfile(v)));
const sha=b=>createHash('sha256').update(b).digest('hex');const original=buffers.map(sha);
const networkViolations=[],pageErrors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctxBrowser=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctxBrowser.newPage();
 page.on('pageerror',x=>pageErrors.push(String(x)));
 if(typeof page.routeWebSocket!=='function')throw Error('QR514_MAIN342_WS_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
   const uri=new URL(route.url());
   if(uri.protocol==='ws:'&&uri.hostname==='127.0.0.1'&&uri.port==='4179')route.connectToServer();
   else{networkViolations.push(route.url());route.close();}
 });
 await page.route('**/*',route=>{
   const uri=new URL(route.request().url());
   if(uri.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
   else{networkViolations.push(route.request().url());route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 const file=page.locator('.load-panel input[type=file]'),panel=page.locator('[data-wep-626-readonly]');
 for(const [idx,buffer] of buffers.entries()){
   await file.setInputFiles({name:'synthetic-main342-w1-626.save',mimeType:'application/octet-stream',buffer});
   await panel.waitFor({state:'visible',timeout:15000});
   await page.waitForFunction(()=>document.querySelector('[data-wep-626-gridobject-entries] dd')?.textContent?.trim()==='3',null,{timeout:15000});
   assert.equal((await page.locator('[data-wep-626-gridobject-entries] dd').innerText()).trim(),'3');
   assert.equal(await page.locator('.editor-shell').count(),0);
   assert.equal(await page.locator('.toolbar-actions').count(),0);
   assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
   assert.equal(await page.locator('.area-route-list').count(),0);
   assert.equal(await page.getByRole('button',{name:'Open in Canvas'}).count(),0);
   console.log('QR514 MAIN342 ACTUAL CHROME SYNTHETIC '+(idx?'W1_INVALID_DIFF_ID':'W1_VALID_SOURCE')+' RAW_GRID3_NON_NATIVE_READONLY_PASS');
 }
 await page.setViewportSize({width:320,height:740});
 const x=await page.evaluate(()=>({w:window.innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(x.scroll<=x.w+2,JSON.stringify(x));
 assert.equal(await panel.isVisible(),true);
 console.log('QR514 MAIN342 MOBILE320_PRESERVED_PASS');
 await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
 await file.setInputFiles({name:'synthetic-bid-negative.save',mimeType:'application/octet-stream',buffer:buffers[0]});
 await panel.waitFor({state:'detached',timeout:15000});
 assert.deepEqual(buffers.map(sha),original);
 assert.deepEqual(networkViolations,[]);
 assert.deepEqual(pageErrors,[]);
 console.log('QR514 MAIN342 BAD_BID_CLEAR_NO_OFFHOST_PRIVATE_SHA_STABLE_PASS');
 await ctxBrowser.close();
}finally{await browser.close();}
