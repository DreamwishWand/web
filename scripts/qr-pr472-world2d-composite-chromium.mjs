import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

const host='http://127.0.0.1:4197',hash=b=>createHash('sha256').update(b).digest('hex');
const obj=(id,x,item=40000048)=>({ID:id,ItemID:item,X:x,Y:3,Orientation:'GridOrientation_Up',State:0});
const make=x=>Buffer.from(makeSyntheticP1gProfile({
 GameInfo:{InitialVersion:624,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{},ProfileWorld:{Stores:[],Shops:[]},ConditionalEventHistory:{ActiveEvents:{}},
 World:{DecorationPresets:[],FloatingIslands:{},MissionSlots:{},QuestInfo:{},
  GridCollection:{DiffGrids:{},Grids:{10:{ID:10,
   GridDataPath:'GridData/Villages/Village04-BeachLevel-GridData.json',
   GridDefaultLayoutPath:'',TessellationFactor:2,NextGridObjectID:100,
   Objects:{42:obj(42,x),43:obj(43,12),44:obj(44,18,999999999)}}}},
  Villages:[{SceneItemId:1540000000,Areas:{7:{GridIDs:[10],Unlocked:true,
   EnvironmentEffectItemID:0,EnvironmentEffectOrientation:'GridOrientation_Up'}}}]},
 Opaque:{syntheticOnly:true}
}));
const A=make(2),B=make(9),shaA=hash(A),shaB=hash(B);
const report={evidence:'INDEPENDENT_SYNTHETIC_ENCRYPTED_P1G_ACTUAL_CHROMIUM_NOT_GENUINE_PRIVATE',
 checks:[],errors:[],nonLocal:[],status:'NOT_RUN'};
const pass=x=>report.checks.push(x);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1280,height:880},serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.route('**/*',route=>{
  const dest=new URL(route.request().url());
  if(dest.origin!==host){report.nonLocal.push(dest.origin);return route.abort('blockedbyclient');}
  return route.continue();
 });
 await page.goto(host+'/editor/world/',{waitUntil:'networkidle'});
 async function load(bytes){
  await page.locator('.platform-select select').selectOption('switch');
  await page.locator('.load-panel input[type=file]').setInputFiles({name:'synthetic.save',
   mimeType:'application/octet-stream',buffer:bytes});
  await page.getByRole('button',{name:'Open in Canvas'}).first().click();
  await page.locator('[data-wep-real-source-read-status]').waitFor({timeout:25000});
 }
 await load(A);
 const node=page.locator('g[data-editor-object-id="g10:o42"]');
 assert.equal(await node.count(),1);
 assert.equal(await page.locator('g[data-editor-object-id="g10:o44"]').count(),0);
 await node.click();
 assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/g10:o42/);
 assert.match(await page.locator('[data-wep-spatial-native-id]').innerText(),/42/);
 pass('ROOT_NATIVE_OBJECT_AND_UNVERIFIED_UNKNOWN_DENIED');
 const move=page.locator('.toolbar-actions').getByRole('button',{name:'Move right',exact:true});
 if(await move.count()){
  assert.equal(await move.isEnabled(),true);
  await move.click();
  assert.equal(await page.locator('[data-wep-spatial-changes]').count(),1);
  await page.locator('.toolbar-actions').getByRole('button',{name:'Undo',exact:true}).click();
  assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
  pass('LOCAL_PREVIEW_MOVE_AND_UNDO_NOT_P1G_WRITE');
 }else{
  assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
  pass('LOCAL_MOVE_UNAVAILABLE_NO_FALSE_WRITER_AUTHORIZATION');
 }
 await load(B);
 assert.equal(await page.locator('g[data-editor-object-id="g10:o42"]').count(),1);
 assert.match(await page.locator('g[data-editor-object-id="g10:o42"]').getAttribute('aria-label'),/9, 3/);
 assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
 pass('A_TO_B_SOURCE_SHA_EPOCH_NO_STALE_DIFF');
 await page.setViewportSize({width:320,height:740});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true);
 pass('MOBILE_320_NO_OVERFLOW');
 // Main now contains independently accepted PR444 Item UNKNOWN/host preflight.
 // Verify World read-only preview does not become a forged Item inventory grant.
 await page.goto(host+'/editor/items/',{waitUntil:'domcontentloaded'});
 const itemGate=page.locator('.local-capability');
 await itemGate.waitFor({timeout:20000});
 assert.equal(await itemGate.getAttribute('data-owned'),'unknown');
 assert.equal(await itemGate.getAttribute('data-writer'),'off');
 assert.equal(await itemGate.getAttribute('data-item-read-available'),'false');
 assert.equal(await itemGate.getAttribute('data-item-edited-copy'),'off');
 pass('CURRENT_MAIN_ITEM_HOST_UNKNOWN_AFTER_WORLD_LOCAL_PREVIEW');
 assert.equal(hash(A),shaA);assert.equal(hash(B),shaB);
 assert.deepEqual(report.nonLocal,[]);assert.deepEqual(report.errors,[]);
 pass('SOURCE_BYTES_UNCHANGED_ZERO_OFFHOST_JS_ERRORS');
 report.status='PASS';
 await context.close();
} catch(e){report.status='FAIL';report.error=String(e.stack||e);}
finally{await browser.close();}
console.log(JSON.stringify(report));
if(report.status!=='PASS')process.exitCode=1;
