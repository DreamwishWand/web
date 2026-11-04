/**
 * 04QR-W independent ACTUAL Chromium on synthetic encrypted 626 P1G.
 * No user's real original/keys/receipt, screenshots, CDN or Cloud.
 * Source PR499 frozen 1110f535; Source World Reader alone (NOT Native V3).
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';

if(!process.env.CHROME_BIN) throw Error('QA_SYSTEM_CHROME_NOT_FOUND');
if(process.env.WEP_PRIVATE_P1G_PATH ||
   process.env.WEP_PRIVATE_LOCAL_ONLY_ACK ||
   process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
  throw Error('QA_MUST_NOT_USE_OWNER_PRIVATE_P1G');
const base=process.env.QR499_LOOPBACK_URL??'http://127.0.0.1:4179/editor/world/';
const url=new URL(base);
if(url.origin!=='http://127.0.0.1:4179'||url.pathname!=='/editor/world/'||
   url.username||url.password||url.search||url.hash)
 throw Error('QA_LOOPBACK_EXACT_ROUTE_REQUIRED');

const p=(objects,withDiff=false)=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},World:{
  Villages:[{Areas:{'7':{GridIDs:[10,11],Unlocked:true}}}],
  GridCollection:{
   Grids:{
    '10':{ID:10,Objects:objects?{'42':{State:{}},'43':{State:{}}}:{}},
    '11':{ID:11,Objects:objects?{'44':{State:{}}}:{}}
   },
   DiffGrids:withDiff?{'10':{ID:10,Objects:{'99':{State:{}}}}}:{}
  }
 }
});
const payloadPositive=Buffer.from(makeSyntheticP1gProfile(p(true,true)));
const payloadZero=Buffer.from(makeSyntheticP1gProfile(p(false)));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const before=[sha(payloadPositive),sha(payloadZero)];
const browser=await chromium.launch({
 headless:true,executablePath:process.env.CHROME_BIN,
 args:['--no-sandbox','--disable-dev-shm-usage']
});
let blocked=0;
const errors=[];
try{
 const ctx=await browser.newContext({
   viewport:{width:1280,height:920},
   serviceWorkers:'block',acceptDownloads:false
 });
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')
   throw Error('QA_NO_WEBSOCKET_FENCE');
 await page.routeWebSocket('**/*',route=>{
   const target=new URL(route.url());
   if(target.protocol==='ws:'&&target.hostname==='127.0.0.1'&&target.port==='4179')
     route.connectToServer();
   else {blocked++;route.close();}
 });
 await page.route('**/*',route=>{
   const dest=new URL(route.request().url());
   if(dest.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))
     route.continue();
   else {blocked++;route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 const input=page.locator('.load-panel input[type=file]');
 const panel=page.locator('[data-wep-626-readonly]');
 const dd=page.locator('[data-wep-626-gridobject-entries] dd');
 const open=async(buf)=>{
   await input.setInputFiles({name:'synthetic-profile',mimeType:'application/octet-stream',buffer:buf});
   await panel.waitFor({state:'visible',timeout:20000});
 };
 await open(payloadPositive);
 await page.waitForFunction(()=>document.querySelector('[data-wep-626-gridobject-entries] dd')?.textContent?.trim()==='3',null,{timeout:20000});
 assert.equal((await dd.innerText()).trim(),'3','exact 3 serialized Grids items, excludes DiffGrids overlap');
 assert.equal(await page.locator('.editor-shell').count(),0);
 assert.equal(await page.locator('.toolbar-actions').count(),0);
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
 assert.equal(await page.getByRole('button',{name:'Open in Canvas'}).count(),0);
 assert.equal(await page.locator('.area-route-list').count(),0);
 console.log('QR499 626 POSITIVE 3 SOURCE ENTRY / NO NATIVE WRITER PASS');

 await open(payloadZero);
 await page.waitForFunction(()=>document.querySelector('[data-wep-626-gridobject-entries] dd')?.textContent?.trim()==='0',null,{timeout:20000});
 assert.equal((await dd.innerText()).trim(),'0','present empty Grids is valid count0');
 console.log('QR499 PRESENT EMPTY OBJECTS COUNT0 PASS');

 await page.setViewportSize({width:320,height:740});
 const metrics=await page.evaluate(()=>({
   viewport:window.innerWidth,width:document.documentElement.scrollWidth
 }));
 assert.ok(metrics.width<=metrics.viewport+2,JSON.stringify(metrics));
 assert.equal(await panel.isVisible(),true);
 console.log('QR499 320px NO OVERFLOW PASS');

 await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
 await input.setInputFiles({name:'synthetic-bad-bid',mimeType:'application/octet-stream',buffer:payloadPositive});
 await panel.waitFor({state:'detached',timeout:20000});
 assert.equal(await panel.count(),0);
 assert.equal(await page.locator('.editor-shell').count(),0);
 assert.deepEqual([sha(payloadPositive),sha(payloadZero)],before);
 assert.deepEqual(errors,[]);
 assert.equal(blocked,0);
 console.log('QR499 WRONG BID CLEARS COUNT/NO SEND/IMMUTABLE SYNTHETIC PASS');
 await ctx.close();
}finally{
 await browser.close();
}
