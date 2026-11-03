import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.WEP_KEYBOARD_RC_BASE_URL ?? 'http://127.0.0.1:4195/editor/world/';
const dir = await mkdtemp(join(tmpdir(),'wep-kbd-'));
const output = resolve('.artifacts/wep-keyboard-strict/');
await mkdir(output,{recursive:true});
const report = {
  contract: 'wep-selected-group-keyboard-strict-new-only@1',
  source: 'SYNTHETIC_EDITOR_ONLY',
  browser: 'ACTUAL_CHROMIUM_NATIVE_TAB_ZOOM',
  checks: [], pageErrors: [], consoleErrors: [],
  status: 'NOT_RUN'
};
const obj = (id,x,layer='furniture',editability='editable')=>({
  editorId:id,itemId:40000001,layer,x,y:2,orientation:0,
  footprint:[{x:0,y:0}],source:null,portableState:null,
  dependencyIds:[],editability,metadata:{displayName:id,reasons:[]}
});
function fixture(blocked=false){
  return {
    schema:'dreamwish-wand-wep-editor-document',version:1,
    target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'keyboard-rc'},
    capabilities:{},networks:{roads:null,fences:null},roomFinish:null,metadata:{},
    objects:[obj('Chair',2),obj('Lamp',6),...(blocked?[obj('Rock',3,'road','readonly')]:[])]
  };
}
const selector=(id,x)=>'g[data-editor-object-id="'+id+'"][aria-label*="'+x+', 2"]';
async function load(page,blocked=false){
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('.load-panel input[type=file]').setInputFiles({
    name:'local-keyboard-draft.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(fixture(blocked)))
  });
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor();
  await page.locator(selector('Chair',2)).click();
  await page.locator(selector('Lamp',6)).click({modifiers:['Control']});
  assert.equal(await page.locator('g.selected[data-editor-object]').count(),2);
}
function passed(label){report.checks.push({label,status:'PASS'});}
async function testZoom(page,zoom){
  await load(page,false);
  const initial=await page.locator('[data-wep-multi-move-status]').innerText();
  // Selected object's keyboard focus, with the same arrow as the existing
  // primary-job handler. Preview is non-mutating, then commit once.
  await page.locator(selector('Lamp',6)).focus();
  await page.keyboard.press('ArrowRight');
  await page.locator(selector('Chair',3)).waitFor();
  await page.locator(selector('Lamp',7)).waitFor();
  assert.equal(await page.locator('g.selected[data-editor-object]').count(),2);
  assert.equal(await page.locator('[data-wep-multi-move-preview]').count(),0);
  assert.notEqual(await page.locator('[data-wep-multi-move-status]').innerText(),initial);
  passed('ZOOM'+zoom+'_KEYBOARD_ARROW_RIGHT_GROUP_ATOMIC_COMMIT');
  const toolbar=page.locator('.toolbar-actions');
  await toolbar.getByRole('button',{name:'Undo',exact:true}).click();
  await page.locator(selector('Chair',2)).waitFor();
  await page.locator(selector('Lamp',6)).waitFor();
  assert.equal(await toolbar.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
  await toolbar.getByRole('button',{name:'Redo',exact:true}).click();
  await page.locator(selector('Chair',3)).waitFor();
  await page.locator(selector('Lamp',7)).waitFor();
  passed('ZOOM'+zoom+'_KEYBOARD_ONE_UNDO_REDO');
  // A stationary protected road at the next cell blocks the ENTIRE group.
  await load(page,true);
  const messageBefore=await page.locator('[data-wep-multi-move-status]').innerText();
  await page.locator(selector('Lamp',6)).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator(selector('Chair',2)).count(),1);
  assert.equal(await page.locator(selector('Lamp',6)).count(),1);
  assert.equal(await toolbar.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
  assert.match(await page.locator('[data-wep-multi-move-status]').innerText(),/COLLISION/);
  assert.notEqual(await page.locator('[data-wep-multi-move-status]').innerText(),messageBefore);
  passed('ZOOM'+zoom+'_KEYBOARD_ROAD_COLLISION_GROUP_FAILCLOSED_NO_HISTORY');
  await page.screenshot({path:join(output,'keyboard-'+zoom+'.png'),fullPage:true});
}
let ctx;
try{
  ctx=await chromium.launchPersistentContext(dir,{
    channel:'chromium',headless:true,viewport:{width:1280,height:960},
    args:['--no-sandbox','--disable-dev-shm-usage',
      '--disable-extensions-except='+resolve('tests/browser/wep-zoom200-extension'),
      '--load-extension='+resolve('tests/browser/wep-zoom200-extension')]
  });
  const page=await ctx.newPage();
  page.on('pageerror',e=>report.pageErrors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
  await page.goto(base,{waitUntil:'networkidle'});
  const sw=ctx.serviceWorkers()[0]??await ctx.waitForEvent('serviceworker',{timeout:15000});
  const setZoom=async scale=>{
    const effective=await sw.evaluate(async ({base,scale})=>{
      const tab=(await chrome.tabs.query({})).find(t=>t.url?.startsWith(base));
      if(!tab?.id)throw new Error('NO_CHROME_TAB');
      await chrome.tabs.setZoom(tab.id,scale);
      return chrome.tabs.getZoom(tab.id);
    },{base,scale});
    assert.equal(effective,scale);
    report['zoom'+scale]=effective;
  };
  await setZoom(1);
  await testZoom(page,100);
  await setZoom(2);
  report.metrics200=await page.evaluate(()=>({
    innerWidth,outerWidth,dpr:devicePixelRatio,visualScale:visualViewport?.scale
  }));
  assert.equal(report.metrics200.dpr,2);
  assert.equal(report.metrics200.innerWidth,640);
  assert.equal(report.metrics200.outerWidth,1280);
  await testZoom(page,200);
  assert.deepEqual(report.pageErrors,[]);
  assert.deepEqual(report.consoleErrors,[]);
  report.status='PASS';
}catch(e){report.status='FAIL';report.error=String(e?.stack??e);}
finally{
  await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await ctx?.close().catch(()=>{});
  await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
