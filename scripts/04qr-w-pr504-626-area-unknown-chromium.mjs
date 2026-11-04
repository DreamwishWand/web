/** 04 QR-W independently authored ACTUAL Chromium using encrypted SYNTHETIC schema626.
 * NO genuine local owner P1G, screenshots, write, Provider, or network.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
if(!process.env.CHROME_BIN)throw Error('QA_SYSTEM_CHROME_MISSING');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)throw Error('QA_OWNER_P1G_FORBIDDEN');
const url=new URL(process.env.QR504_LOOPBACK_URL??'http://127.0.0.1:4179/editor/world/');
if(url.href!=='http://127.0.0.1:4179/editor/world/')throw Error('QR504_EXACT_LOCALHOST_REQUIRED');
const make=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},
 World:{
  Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true}}},
   {Areas:{'8':{GridIDs:[],Unlocked:false},'9':{GridIDs:[],Unlocked:true}}}],
  GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{KeepOpaque:true}}}}},DiffGrids:{}}
 }
});
const valid=make();
const empty=make();empty.World.Villages=[{Areas:{}},{Areas:{}}];
const malformed=make();delete malformed.World.Villages[1].Areas;
const sources=[valid,empty,malformed].map(p=>Buffer.from(makeSyntheticP1gProfile(p)));
const hash=b=>createHash('sha256').update(b).digest('hex');
const originals=sources.map(hash);
let blocked=0;const errors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block',acceptDownloads:false});
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 if(typeof page.routeWebSocket!=='function')throw Error('QA_WEBSOCKET_GUARD_REQUIRED');
 await page.routeWebSocket('**/*',route=>{
  const dest=new URL(route.url());
  if(dest.protocol==='ws:'&&dest.hostname==='127.0.0.1'&&dest.port==='4179')route.connectToServer();
  else{blocked++;route.close();}
 });
 await page.route('**/*',route=>{
  const dest=new URL(route.request().url());
  if(dest.origin===url.origin&&['GET','HEAD'].includes(route.request().method()))route.continue();
  else{blocked++;route.abort('blockedbyclient');}
 });
 await page.goto(url.href,{waitUntil:'networkidle'});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 const file=page.locator('.load-panel input[type=file]');
 const panel=page.locator('[data-wep-626-readonly]');
 const area=panel.locator('dl > div').nth(1).locator('dd');
 const grid=page.locator('[data-wep-626-gridobject-entries] dd');
 const check=async(buffer,label)=>{
  await file.setInputFiles({name:'synthetic-profile.save',mimeType:'application/octet-stream',buffer});
  await panel.waitFor({state:'visible',timeout:20000});
  await page.waitForFunction(expected=>
   document.querySelector('[data-wep-626-readonly] dl > div:nth-child(2) dd')?.textContent?.trim()===expected,
   label,{timeout:20000});
  assert.equal((await area.innerText()).trim(),label);
  assert.equal((await grid.innerText()).trim(),'1');
  assert.equal(await page.locator('.editor-shell').count(),0);
  assert.equal(await page.locator('.toolbar-actions').count(),0);
  assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
  assert.equal(await page.getByRole('button',{name:'Open in Canvas'}).count(),0);
 };
 await check(sources[0],'3');
 console.log('QR504 ACTUAL SYNTHETIC CHROMIUM VALID MULTIVILLAGE COUNT3 PASS');
 await check(sources[1],'0');
 console.log('QR504 ACTUAL SYNTHETIC CHROMIUM PRESENT EMPTY COUNT0 PASS');
 await check(sources[2],'—');
 console.log('QR504 ACTUAL SYNTHETIC CHROMIUM MISSING SECOND AREAS UNKNOWN PASS');
 await page.setViewportSize({width:320,height:720});
 const size=await page.evaluate(()=>({view:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.view+2,JSON.stringify(size));
 assert.equal(await panel.isVisible(),true);
 console.log('QR504 320PX UNTRUSTED READONLY PASS');
 await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
 await file.setInputFiles({name:'synthetic-wrong-bid.save',mimeType:'application/octet-stream',buffer:sources[0]});
 await panel.waitFor({state:'detached',timeout:20000});
 assert.equal(await panel.count(),0);
 assert.deepEqual(sources.map(hash),originals);
 assert.deepEqual(errors,[]);
 assert.equal(blocked,0);
 console.log('QR504 WRONG BID CLEAR + ORIGINAL SYNTHETIC SHA + NO OFFHOST PASS');
 await ctx.close();
}finally{await browser.close();}
