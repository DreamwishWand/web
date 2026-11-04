// 04 QR W-QR-036: independent actual Chromium local synthetic packaged P1G
// PR402 real-source-shaped source/EditorSession/2D bridge. Not a genuine P1G.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {makeSyntheticP1gProfile} from '../tests/helpers/p1g-fixture.mjs';
const ROOT='http://127.0.0.1:4206/editor/world/';
const BIN=process.env.CHROME_BIN;assert.ok(BIN,'Chrome required');
const gridPath='GridData/Villages/Village04-BeachLevel-GridData.json';
const raw=(id,x,y,item=40000048)=>({ID:id,ItemID:item,X:x,Y:y,Orientation:'GridOrientation_Up',State:0});
const makeProfile=(x)=>({
 GameInfo:{InitialVersion:624,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{},ProfileWorld:{Stores:[],Shops:[]},ConditionalEventHistory:{ActiveEvents:{}},
 World:{DecorationPresets:[],FloatingIslands:{},MissionSlots:{},QuestInfo:{},
  GridCollection:{DiffGrids:{},Grids:{'10':{ID:10,GridDataPath:gridPath,
    GridDefaultLayoutPath:'',TessellationFactor:2,NextGridObjectID:100,
    Objects:{'42':raw(42,x,3),'43':raw(43,12,3),'44':raw(44,18,4,999999999)}}}},
  Villages:[{SceneItemId:1540000000,Areas:{'7':{
   GridIDs:[10],Unlocked:true,EnvironmentEffectItemID:0,
   EnvironmentEffectOrientation:'GridOrientation_Up'}}}]},
  Opaque:{syntheticOnly:true}
});
const A=Buffer.from(makeSyntheticP1gProfile(makeProfile(2)));
const B=Buffer.from(makeSyntheticP1gProfile(makeProfile(5)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const original=[hash(A),hash(B)];
const browser=await chromium.launch({executablePath:BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:920},serviceWorkers:'block'});
const page=await context.newPage(),errors=[],outbound=[];
page.on('pageerror',err=>errors.push(String(err)));
context.on('request',req=>{
 const u=new URL(req.url());
 if(req.method()!=='GET'||u.origin!=='http://127.0.0.1:4206')outbound.push(req.method()+' '+u.href);
});
function mark(name){console.log('QR_402_'+name+'_PASS');}
async function load(bytes){
 await page.goto(ROOT,{waitUntil:'domcontentloaded'});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('.load-panel input[type=file]').setInputFiles({name:'profile',
  mimeType:'application/octet-stream',buffer:bytes});
 await page.getByRole('button',{name:'Open in Canvas'}).first().click();
 await page.locator('[data-wep-real-source-read-status]').waitFor({timeout:35000});
}
try {
 await load(A);
 const a=page.locator('g[data-editor-object-id="g10:o42"]');
 assert.equal(await a.count(),1);
 assert.equal(await page.locator('g[data-editor-object-id="g10:o43"]').count(),1);
 assert.equal(await page.locator('g[data-editor-object-id="g10:o44"]').count(),0);
 assert.match(await page.locator('[data-wep-real-source-read-status]').innerText(),/LOCAL_SOURCE_SHAPED_READ_ONLY_NOT_NATIVE_V3/);
 const issues=page.locator('[data-wep-spatial-unresolved-details]');
 await issues.locator('summary').click();
 assert.match(await issues.innerText(),/SPATIAL_READ_GEOMETRY_OR_STATE_UNVERIFIED/);
 mark('P1G_SHAPED_RAW_ID_MATCH_UNKNOWN_NOT_PAINTED');
 await a.click();
 assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/g10:o42/);
 assert.match(await page.locator('[data-wep-spatial-native-id]').innerText(),/42/);
 mark('REAL_CHROME_POINTER_SAME_NATIVE_ID_DETAIL');
 await a.focus();
 await page.keyboard.press('ArrowRight');
 await page.locator('g[data-editor-object-id="g10:o42"][aria-label*="3, 3"]').waitFor({timeout:15000});
 assert.match(await page.locator('[data-wep-spatial-changes]').innerText(),/g10:o42.*MOVE/s);
 await page.locator('.toolbar-actions').getByRole('button',{name:'Undo',exact:true}).click();
 await page.locator('g[data-editor-object-id="g10:o42"][aria-label*="2, 3"]').waitFor({timeout:12000});
 assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
 mark('SCENE_LOCAL_MOVE_DRAFT_EXACT_DIFF_UNDO_NO_PERSISTENT_WRITER');
 await load(B);
 const b=page.locator('g[data-editor-object-id="g10:o42"]');
 await b.waitFor();
 assert.match(await b.getAttribute('aria-label'),/5, 3/);
 await b.click();
 assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/g10:o42/);
 assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
 mark('REOPEN_B_DIFFERENT_SOURCE_SAME_ID_CLEARS_OLD_REVIEW');
 await page.setViewportSize({width:320,height:740});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2));
 assert.deepEqual([hash(A),hash(B)],original);
 assert.deepEqual(outbound,[]);
 assert.deepEqual(errors,[]);
 mark('MOBILE320_ORIGINAL_BYTES_UNCHANGED_NO_UPLOAD_ERRORS');
 console.log('QR_402_INDEPENDENT_ACTUAL_CHROMIUM_SYNTHETIC_PACKAGED_SOURCE_SPATIAL_TARGETED_PASS');
} finally {await context.close();await browser.close();}
