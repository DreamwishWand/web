import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

// SYNTHETIC encrypted P1G test in an actual local Chromium process. Never
// inject a real personal Save into GitHub, CI, screenshots or artifacts.
const rootUrl=(process.env.WEP_626_INSPECTOR_URL??'http://127.0.0.1:4179').replace(/\/$/,'');
if(!process.env.CHROME_BIN)throw Error('CHROME_BIN_REQUIRED');
const native=(id,x=2,y=3,item=40000047,sub=null)=>({
 ID:id,ItemID:item,X:x,Y:y,Orientation:'GridOrientation_Up',
 State:sub===null?null:{SubGrid:{GridID:sub,DesignID:null}}
});
const profile=x=>({
 GameInfo:{Version:626,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Name:'Synthetic'},
 World:{Villages:[{Areas:{'7':{GridIDs:[42],Unlocked:true}}}],
  GridCollection:{Grids:{
   '42':{ID:42,GridDataPath:'GridData/Test-626.json',TessellationFactor:2,
      Objects:{'7':native(7,x,3,40000047,43),'8':native(8,9,3,40000048)}},
   '43':{ID:43,GridDataPath:'GridData/Test-Child-626.json',TessellationFactor:2,
      Objects:{'9':native(9,0,1,40000049)}}
  },DiffGrids:{}}}
});
const A=Buffer.from(makeSyntheticP1gProfile(profile(2)));
const B=Buffer.from(makeSyntheticP1gProfile(profile(12)));
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const hashes=[hash(A),hash(B)];
const report={schema:'wep.schema626.source-inspector.chrome@1',
 evidence:'SYNTHETIC_PACKAGED_ENCRYPTED_P1G_ACTUAL_CHROMIUM_NOT_GENUINE_PRIVATE',
 sourceSha256:hashes,checks:[],pageErrors:[],consoleErrors:[],
 offHostRequests:[],result:'NOT_RUN'};
const pass=n=>report.checks.push({name:n,status:'PASS'});
let browser=null;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN,
  args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin===rootUrl)route.continue();
  else {report.offHostRequests.push(url.origin);route.abort('blockedbyclient')}
 });
 await page.goto(rootUrl+'/editor/world/',{waitUntil:'networkidle'});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 const file=page.locator('.load-panel input[type=file]');
 const upload=async buf=>file.setInputFiles({name:'profile.save',mimeType:'application/octet-stream',buffer:buf});
 await upload(A);
 const panel=page.locator('[data-wep-626-source-inspector]');
 await panel.waitFor({state:'visible',timeout:20000});
 assert.equal(await page.locator('g[data-editor-object-id]').count(),0);
 assert.equal(await page.locator('.editor-shell').count(),0);
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
 assert.equal(await page.getByRole('button',{name:'Open in Canvas'}).count(),0);
 assert.match(await page.locator('[data-wep-626-geometry-unverified]').innerText(),/not verified/i);
 pass('626_P1G_READ_ONLY_NO_624_2D_CANVAS_OR_WRITER');
 const row=page.locator('[data-wep-626-native-object-id="g42:o7"]');
 assert.equal(await row.count(),1);
 await row.click();
 let detail=page.locator('[data-wep-626-source-details]');
 assert.match(await detail.innerText(),/g42:o7/);
 assert.match(await detail.innerText(),/40000047/);
 assert.match(await detail.innerText(),/2, 3/);
 assert.match(await detail.innerText(),/NOT_VERIFIED/);
 assert.match(await detail.innerText(),/persistentWriteAuthorized\s*false/);
 pass('RAW_ROOT_GRIDOBJECT_ID_ITEM_LOCAL_XY_SAME_INSPECTOR_NO_GEOMETRY');
 await page.locator('[data-wep-626-grid-input]').fill('43');
 await page.locator('[data-wep-626-object-input]').fill('9');
 await page.locator('[data-wep-626-source-inspector] button[type=submit]').click();
 detail=page.locator('[data-wep-626-source-details]');
 assert.match(await detail.innerText(),/g43:o9/);
 assert.match(await detail.innerText(),/g42:o7/);
 assert.match(await detail.innerText(),/SUBGRID_CHILD/);
 pass('RAW_CHILD_GRIDOBJECT_PARENT_SOURCE_NOT_WORLD_TRANSFORM');
 await page.locator('[data-wep-626-object-input]').fill('999');
 await page.locator('[data-wep-626-source-inspector] button[type=submit]').click();
 assert.equal(await detail.count(),0);
 assert.match(await page.locator('[data-wep-626-source-error]').innerText(),/SOURCE_OBJECT_NOT_FOUND/);
 pass('UNKNOWN_NATIVE_ID_REJECTED');
 await page.locator('[data-wep-626-grid-input]').fill('42');
 await page.locator('[data-wep-626-object-input]').fill('7');
 await upload(B);
 await panel.waitFor({state:'visible'});
 assert.equal(await detail.count(),0,'previous A selection must clear before B');
 await page.locator('[data-wep-626-native-object-id="g42:o7"]').click();
 assert.match(await detail.innerText(),/12, 3/);
 assert.doesNotMatch(await detail.innerText(),/2, 3/);
 pass('A_TO_B_RELOAD_IDENTICAL_NATIVE_ID_NEW_RAW_COORDS_NO_STALE_SELECTION');
 await page.setViewportSize({width:320,height:740});
 await page.waitForTimeout(180);
 const width=await page.evaluate(()=>({vw:innerWidth,sw:document.documentElement.scrollWidth}));
 assert.ok(width.sw<=width.vw+2,JSON.stringify(width));
 assert.equal(await panel.isVisible(),true);
 pass('MOBILE_320_NO_OVERFLOW');
 await page.locator('[data-wep-626-bid] input').fill('0000000000000000');
 await upload(A);
 await page.getByText(/Unsupported save version or build/).waitFor({timeout:15000});
 assert.equal(await panel.count(),0);
 assert.equal(await detail.count(),0);
 pass('WRONG_BID_DISCARDS_PRIOR_INDEX');
 assert.equal(hash(A),hashes[0]);
 assert.equal(hash(B),hashes[1]);
 assert.deepEqual(report.offHostRequests,[]);
 assert.deepEqual(report.pageErrors,[]);
 assert.deepEqual(report.consoleErrors,[]);
 pass('ORIGINAL_ENCRYPTED_BYTES_UNCHANGED_ZERO_OFFHOST_OR_JS_ERRORS');
 report.result='PASS';
 await context.close();
}catch(e){
 report.result='FAIL';
 report.error=String(e?.stack??e);
}finally{
 await mkdir('.artifacts/wep-schema626-source-inspector',{recursive:true});
 await writeFile('.artifacts/wep-schema626-source-inspector/report.json',JSON.stringify(report,null,2)+'\n');
 await browser?.close();
}
console.log(JSON.stringify(report,null,2));
if(report.result!=='PASS')process.exitCode=1;
