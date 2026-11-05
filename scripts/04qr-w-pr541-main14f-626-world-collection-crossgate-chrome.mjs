// 04 QR-W PR541 NEW COMPOSED: malformed later Village Areas UNKNOWN actual browser with current main Presets/Collection.
// Synthetic sealed P1G only, no genuine encrypted owner Save, no Native write.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
const root='http://127.0.0.1:4316';
if(!process.env.CHROME_BIN)throw Error('QR541_REAL_SYSTEM_CHROME_REQUIRED');
if(process.env.WEP_PRIVATE_P1G_PATH||process.env.WEP_PRIVATE_LOCAL_ONLY_ACK||process.env.WEP_PRIVATE_EXTERNAL_BUILD_CONFIRMED)
 throw Error('QR541_PRIVATE_P1G_IN_SHARED_CI_DENIED');
const fixture=()=>({
 GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{OpaqueField:{keep:true}},
 World:{
  Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true}}},{Unrelated:{keep:true}}],
  GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{FutureOpaque:true}}}}},DiffGrids:{}}
 },
 OpaqueRoot:{mustPreserve:true}
});
const unknown=Buffer.from(makeSyntheticP1gProfile(fixture()));
const zeroObj=fixture();zeroObj.World.Villages=[{Areas:{}},{Areas:{}}];
const presentEmpty=Buffer.from(makeSyntheticP1gProfile(zeroObj));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const unknownSha=sha(unknown),emptySha=sha(presentEmpty);
const denied=[],errors=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block',acceptDownloads:false});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(String(e)));
if(typeof page.routeWebSocket!=='function')throw Error('QR541_WS_BOUNDED_ROUTE_REQUIRED');
await page.routeWebSocket('**/*',route=>{
 const url=new URL(route.url());
 if(url.protocol==='ws:'&&url.hostname==='127.0.0.1'&&url.port==='4316')route.connectToServer();
 else{denied.push('WS '+route.url());route.close();}
});
await page.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(url.origin===root&&['GET','HEAD'].includes(req.method()))route.continue();
 else{denied.push(req.method()+' '+req.url());route.abort('blockedbyclient');}
});
async function upload(bytes){
 await page.locator('.load-panel input[type="file"]').setInputFiles({
  name:'synthetic626.save',mimeType:'application/octet-stream',buffer:bytes
 });
}
try{
 await page.goto(root+'/editor/world/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('.platform-select select').waitFor({state:'visible',timeout:35000});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 await upload(unknown);
 const panel=page.locator('[data-wep-626-readonly]');
 await panel.waitFor({state:'visible',timeout:35000});
 const cells=panel.locator('dl > div dd');
 assert.equal(await cells.count(),4);
 assert.deepEqual((await cells.allTextContents()).map(s=>s.trim()),['2','—','1','1'],
  'later missing Village Areas must fail entire count UNKNOWN without hiding grid objects');
 assert.equal(await page.locator('.editor-shell,.toolbar-actions,[data-wep-verified-export],.area-route-list').count(),0);
 assert.equal(await page.getByRole('button',{name:'Open in Canvas'}).count(),0);
 assert.equal(sha(unknown),unknownSha);
 console.log('QR541_MAIN14F_SCHEMA626_TWO_VILLAGES_LATER_MISSING_AREAS_UNKNOWN_OBJECTS1_NO_EDITOR_PASS');
 await page.setViewportSize({width:320,height:750});
 const size=await page.evaluate(()=>({view:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(size.scroll<=size.view+2,'626 UNKNOWN mobile320 '+JSON.stringify(size));
 await page.setViewportSize({width:1280,height:850});
 await upload(presentEmpty);
 await panel.waitFor({state:'visible',timeout:35000});
 assert.deepEqual((await cells.allTextContents()).map(s=>s.trim()),['2','0','1','1'],
  'present empty maps are count zero, not UNKNOWN');
 assert.equal(sha(presentEmpty),emptySha);
 console.log('QR541_MAIN14F_SCHEMA626_VALID_EMPTY_AREAS_ZERO_AND_SOURCE_SHA_UNCHANGED_PASS');
 await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
 await upload(unknown);
 await page.getByText(/Unsupported save version or build/).waitFor({timeout:30000});
 assert.equal(await panel.count(),0);
 assert.equal(await page.locator('.editor-shell,.toolbar-actions,[data-wep-verified-export]').count(),0);
 console.log('QR541_MAIN14F_WRONG_BID_CLEARS_ALL_626_READ_ONLY_PANEL_PASS');

 await page.goto(root+'/collection/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-category-grid] .category-card').first().waitFor({timeout:30000});
 assert.equal(await page.locator('[data-stage1-category-grid] .category-card').count(),29);
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-personal-progress'),'unknown');
 assert.equal(await page.locator('[data-stage1-collection-root]').getAttribute('data-writer'),'off');
 await page.goto(root+'/presets/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-stage1-presets-four-cards] button').first().waitFor({timeout:30000});
 assert.equal(await page.locator('[data-stage1-presets-four-cards] button').count(),4);
 const preset=page.locator('[data-stage1-presets-root]');
 for(const attr of ['data-native-writer','data-provider-gate','data-tom-writer'])assert.equal(await preset.getAttribute(attr),'off');
 console.log('QR541_MAIN14F_AFTER_BAD_626_COLLECTION_UNKNOWN_PRESETS_NATIVE_WRITER_OFF_PASS');
 assert.deepEqual(denied,[],'no external network GET/POST/WS, Provider or Cloud');
 assert.deepEqual(errors,[],'no browser exceptions');
 assert.equal(sha(unknown),unknownSha);
 assert.equal(sha(presentEmpty),emptySha);
 console.log('QR541_MAIN14F_SOURCE_PACKED_SHA_AND_NO_EXTERNAL_IO_PASS '+unknownSha.slice(0,16));
}finally{await ctx.close();await browser.close();}
