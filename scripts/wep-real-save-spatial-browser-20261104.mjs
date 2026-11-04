import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

const base=process.env.WEP_REAL_SPATIAL_URL??'http://127.0.0.1:4197/editor/world/';
const output=resolve('.artifacts/wep-real-spatial-read');
const dir=await mkdtemp(join(tmpdir(),'wep-raw-grid-'));
await mkdir(output,{recursive:true});
const path='GridData/Villages/Village04-BeachLevel-GridData.json';
const OBJECT=42, ROOT=10, ITEM=40000048;
const raw=(id,x,y,item=ITEM)=>({
  ID:id,ItemID:item,X:x,Y:y,Orientation:'GridOrientation_Up',State:0
});
const profile=(x)=>({
  GameInfo:{InitialVersion:624,Version:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
  Player:{},
  ProfileWorld:{Stores:[],Shops:[]},
  ConditionalEventHistory:{ActiveEvents:{}},
  World:{
    DecorationPresets:[],FloatingIslands:{},MissionSlots:{},QuestInfo:{},
    GridCollection:{DiffGrids:{},Grids:{
      [ROOT]:{
        ID:ROOT,GridDataPath:path,GridDefaultLayoutPath:'',
        TessellationFactor:2,NextGridObjectID:100,
        Objects:{
          [OBJECT]:raw(OBJECT,x,3),
          '43':raw(43,12,3),
          '44':raw(44,18,4,999999999)
        }
      }
    }},
    Villages:[{SceneItemId:1540000000,Areas:{'7':{
      GridIDs:[ROOT],Unlocked:true,EnvironmentEffectItemID:0,
      EnvironmentEffectOrientation:'GridOrientation_Up'
    }}}]
  },Opaque:{syntheticSpatialQA:true}
});
const bytesA=Buffer.from(makeSyntheticP1gProfile(profile(2)));
const bytesB=Buffer.from(makeSyntheticP1gProfile(profile(5)));
const sha=v=>createHash('sha256').update(v).digest('hex');
const originalHashes=[sha(bytesA),sha(bytesB)];
const report={
  contract:'wep-real-source-spatial-browser@1',
  evidence:'SYNTHETIC_ENCRYPTED_P1G_SHAPED_BROWSER_NOT_GENUINE_SAVE',
  nativeSourceVersion:'Switch 1.25.0 schema624 model only',
  sourceSha256:originalHashes,checks:[],pageErrors:[],consoleErrors:[],
  externalRequests:[],status:'NOT_RUN'
};
const pass=x=>report.checks.push({name:x,status:'PASS'});
let context;
try {
  context=await chromium.launchPersistentContext(dir,{
    channel:'chromium',headless:true,viewport:{width:1280,height:900},
    args:['--no-sandbox','--disable-dev-shm-usage',
      '--disable-extensions-except='+resolve('tests/browser/wep-zoom200-extension'),
      '--load-extension='+resolve('tests/browser/wep-zoom200-extension')]
  });
  const page=await context.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
  page.on('request',req=>{
    if(!req.url().startsWith('http://127.0.0.1:4197/'))report.externalRequests.push(req.url());
  });
  await page.goto(base,{waitUntil:'networkidle'});
  const sw=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:20000});
  const setZoom=async value=>{
    const actual=await sw.evaluate(async ({base,value})=>{
      const tab=(await chrome.tabs.query({})).find(t=>t.url?.startsWith(base));
      assert(tab?.id);
      await chrome.tabs.setZoom(tab.id,value);
      return chrome.tabs.getZoom(tab.id);
    },{base,value});
    assert.equal(actual,value);
  };
  async function openSource(buffer){
    await page.locator('.platform-select select').selectOption('switch');
    await page.locator('.load-panel input[type=file]').setInputFiles({
      name:'profile',mimeType:'application/octet-stream',buffer
    });
    await page.getByRole('button',{name:'Open in Canvas'}).first().click();
    await page.locator('[data-wep-real-source-read-status]').waitFor();
  }
  await setZoom(1);
  await openSource(bytesA);
  const node=page.locator('g[data-editor-object-id="g10:o42"]');
  assert.equal(await node.count(),1);
  assert.equal(await page.locator('g[data-editor-object-id="g10:o43"]').count(),1);
  assert.equal(await page.locator('g[data-editor-object-id="g10:o44"]').count(),0);
  const status=await page.locator('[data-wep-real-source-read-status]').innerText();
  assert.match(status,/LOCAL_SOURCE_SHAPED_READ_ONLY_NOT_NATIVE_V3/);
  assert.match(await page.locator('[data-wep-spatial-unresolved-details]').innerText(),/SPATIAL_READ_GEOMETRY_OR_STATE_UNVERIFIED/);
  pass('SYNTHETIC_PACKAGED_P1G_GRID_TO_SOURCE_PROOF_UNKNOWN_NOT_PAINTED');
  await node.click();
  assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/g10:o42/);
  assert.match(await page.locator('[data-wep-spatial-native-id]').innerText(),/42/);
  pass('P1G_SOURCE_GRIDOBJECT_CLICK_TO_SAME_INSPECTOR_ID');
  const svg=page.locator('svg[data-wep-marquee-canvas]');
  const initial=await svg.getAttribute('viewBox');
  await svg.hover({position:{x:100,y:80}});
  await page.mouse.wheel(0,-180);
  assert.notEqual(await svg.getAttribute('viewBox'),initial);
  await page.locator('[data-wep-spatial-controls]').getByRole('button',{name:/Fit Area|エリアに合わせる/}).click();
  assert.equal(await svg.getAttribute('viewBox'),initial);
  pass('NATIVE_100_WHEEL_ZOOM_AND_FIT');
  await setZoom(2);
  assert.equal(await node.count(),1);
  await node.click();
  assert.match(await page.locator('[data-wep-spatial-native-id]').innerText(),/42/);
  pass('NATIVE_200_SOURCE_ID_CLICK');
  await setZoom(1);
  await openSource(bytesB);
  const newNode=page.locator('g[data-editor-object-id="g10:o42"]');
  assert.equal(await newNode.count(),1);
  assert.match(String(await newNode.getAttribute('aria-label')),/5, 3/);
  await newNode.click();
  assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/g10:o42/);
  assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
  pass('A_TO_B_REOPEN_SAME_NATIVE_ID_NEW_SOURCE_NO_STALE_REVIEW');
  await page.setViewportSize({width:320,height:740});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  pass('CSS_320_NO_OVERFLOW');
  assert.deepEqual([sha(bytesA),sha(bytesB)],originalHashes);
  pass('ORIGINAL_SYNTHETIC_PACKAGED_BYTES_UNCHANGED');
  assert.deepEqual(report.externalRequests,[]);
  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(report.consoleErrors,[]);
  report.status='PASS';
  await page.screenshot({path:join(output,'real-source-shaped-320.png'),fullPage:true});
} catch(error) {
  report.status='FAIL';
  report.error=String(error?.stack??error);
} finally {
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await context?.close().catch(()=>{});
  await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
