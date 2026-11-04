import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';

const base=process.env.WEP_SPATIAL_URL??'http://127.0.0.1:4196/editor/world/';
const dir=await mkdtemp(join(tmpdir(),'wep-spatial-'));
const output=resolve('.artifacts/wep-spatial-p0/');
await mkdir(output,{recursive:true});
const report={contract:'wep-spatial-scene-p0-new-only@1',
  source:'SYNTHETIC_SAVE_SHAPED_EDITOR_DOCUMENT__NOT_GENUINE_P1G',
  browser:'ACTUAL_CHROMIUM_NATIVE_TAB_ZOOM',checks:[],pageErrors:[],consoleErrors:[],status:'NOT_RUN'};
const obj=(id,x,y,more={})=>({
 editorId:id,itemId:40000001,layer:'furniture',x,y,orientation:0,
 footprint:[{x:0,y:0},{x:1,y:0}],source:{rootGridId:42,gridObjectId:id},
 portableState:null,dependencyIds:[],editability:'editable',
 metadata:{displayName:id,reasons:[],rootGridId:42},...more
});
function fixture(kind='A'){
 const objects=kind==='overlap'
 ? [obj('bottom',3,2),obj('top',3,2)]
 : kind==='unknown'
 ? [obj('valid',2,2),obj('bad',6,2,{metadata:{reasons:[],rootGridId:43}}),
    obj('child',10,2,{source:{rootGridId:42,gridObjectId:'child',subGridDataPath:'X/child'}})]
 : kind==='B'
 ? [obj('B-object',12,5)]
 : [obj('chair',2,2),obj('lamp',7,2)];
 return {schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{platform:'synthetic',gameVersion:'1.25.0',areaKey:kind,rootGridId:42},
  networks:{roads:null,fences:null},roomFinish:null,capabilities:{},
  metadata:{rootGridBounds:{x:0,y:0,w:20,h:12}},objects};
}
const object=id=>'g[data-editor-object-id="'+id+'"]';
async function load(page,kind='A'){
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('.load-panel input[type=file]').setInputFiles({
   name:'local-spatial-'+kind+'.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(fixture(kind)))
 });
 await page.locator('[data-wep-spatial-controls]').waitFor();
}
function pass(label){report.checks.push({label,status:'PASS'});}
async function testZoom(page,zoom){
 await load(page);
 const scene=page.locator('svg[data-wep-marquee-canvas]');
 const chair=page.locator(object('chair')),lamp=page.locator(object('lamp'));
 assert.equal(await chair.getAttribute('data-wep-spatial-editor-id'),'chair');
 assert.equal(await chair.getAttribute('data-wep-spatial-native-grid-object-id'),'chair');
 await chair.click();
 assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/chair/);
 assert.match(await page.locator('[data-wep-spatial-native-id]').innerText(),/chair/);
 pass('ZOOM'+zoom+'_CLICK_ID_EXACT_INSPECTOR');
 const initial=await scene.getAttribute('viewBox');
 await scene.hover({position:{x:100,y:80}});
 await page.mouse.wheel(0,-200);
 const afterZoom=await scene.getAttribute('viewBox');
 assert.notEqual(afterZoom,initial);
 const fit=page.locator('[data-wep-spatial-controls]').getByRole('button',{name:/Fit Area|エリアに合わせる/});
 await fit.click();
 assert.equal(await scene.getAttribute('viewBox'),initial);
 pass('ZOOM'+zoom+'_WHEEL_ZOOM_FIT_STABLE');
 // Pan with Alt key on empty Canvas, using native SVG pointer capture.
 const box=await scene.boundingBox();
 const px=box.x+box.width*.7,py=box.y+box.height*.75;
 await page.keyboard.down('Alt');
 await page.mouse.move(px,py);await page.mouse.down();
 await page.mouse.move(px+35,py+15,{steps:5});await page.mouse.up();
 await page.keyboard.up('Alt');
 assert.notEqual(await scene.getAttribute('viewBox'),initial);
 await fit.click();
 assert.equal(await scene.getAttribute('viewBox'),initial);
 pass('ZOOM'+zoom+'_POINTER_PAN_RESETS_WITH_FIT');
 await chair.click();
 await lamp.click({modifiers:['Control']});
 assert.equal(await page.locator('g.selected[data-editor-object]').count(),2);
 await lamp.focus();await page.keyboard.press('ArrowRight');
 await page.locator(object('chair')+'[aria-label*="3, 2"]').waitFor();
 assert.equal(await page.locator('g.selected[data-editor-object]').count(),2);
 assert.match(await page.locator('[data-wep-spatial-changes]').innerText(),/chair.*MOVE/s);
 assert.match(await page.locator('[data-wep-spatial-delta="chair"]').innerText(),/2,2\/0.*3,2\/0/s);
 const toolbar=page.locator('.toolbar-actions');
 await toolbar.getByRole('button',{name:'Undo',exact:true}).click();
 await page.locator(object('chair')+'[aria-label*="2, 2"]').waitFor();
 assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
 await toolbar.getByRole('button',{name:'Redo',exact:true}).click();
 await page.locator(object('chair')+'[aria-label*="3, 2"]').waitFor();
 pass('ZOOM'+zoom+'_SELECT_GROUP_MOVE_DIFF_SINGLE_UNDO_REDO');
 await page.screenshot({path:join(output,'spatial-'+zoom+'.png'),fullPage:true});
}
let ctx;
try {
 ctx=await chromium.launchPersistentContext(dir,{
  channel:'chromium',headless:true,viewport:{width:1280,height:960},
  args:['--no-sandbox','--disable-dev-shm-usage',
   '--disable-extensions-except='+resolve('tests/browser/wep-zoom200-extension'),
   '--load-extension='+resolve('tests/browser/wep-zoom200-extension')]
 });
 const page=await ctx.newPage();
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 await page.goto(base,{waitUntil:'networkidle'});
 const sw=ctx.serviceWorkers()[0]??await ctx.waitForEvent('serviceworker',{timeout:20000});
 const setZoom=async zoom=>{
  const actual=await sw.evaluate(async ({base,zoom})=>{
   const tab=(await chrome.tabs.query({})).find(t=>t.url?.startsWith(base));
   if(!tab?.id)throw Error('NATIVE_ZOOM_TAB_MISSING');
   await chrome.tabs.setZoom(tab.id,zoom);
   return chrome.tabs.getZoom(tab.id);
  },{base,zoom});
  assert.equal(actual,zoom);return actual;
 };
 report.zoom100=await setZoom(1);
 await testZoom(page,100);
 report.zoom200=await setZoom(2);
 report.metrics200=await page.evaluate(()=>({innerWidth,outerWidth,dpr:devicePixelRatio,visualScale:visualViewport?.scale}));
 assert.equal(report.metrics200.innerWidth,640);
 assert.equal(report.metrics200.outerWidth,1280);
 await testZoom(page,200);
 await load(page,'unknown');
 assert.equal(await page.locator('g[data-editor-object-id]').count(),1);
 assert.match(await page.locator('[data-wep-spatial-unresolved]').innerText(),/2/);
 await page.locator('[data-wep-spatial-unresolved-details] summary').click();
 assert.match(await page.locator('[data-wep-spatial-unresolved-details]').innerText(),/SPATIAL_GRID_CONFLICT/);
 assert.match(await page.locator('[data-wep-spatial-unresolved-details]').innerText(),/SPATIAL_SUBGRID_TRANSFORM_UNPROVEN/);
 pass('ROOT_MISMATCH_SUBGRID_UNVERIFIED_NOT_PAINTED');
 await load(page,'overlap');
 assert.equal(await page.locator('g[data-editor-object-id]').count(),2);
 await page.locator(object('top')).click();
 assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/top/);
 pass('OVERLAP_TOPMOST_HIT_USES_CORE_EDITOR_ID');
 await load(page,'B');
 assert.equal(await page.locator(object('chair')).count(),0);
 await page.locator(object('B-object')).click();
 assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/B-object/);
 assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
 pass('A_TO_B_SESSION_REPLACED_DETAILS_AND_DIFF');
 await page.setViewportSize({width:320,height:740});
 await page.locator('[data-wep-spatial-controls]').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 pass('VIEWPORT_320_NO_HORIZONTAL_OVERFLOW');
 assert.deepEqual(report.pageErrors,[]);
 assert.deepEqual(report.consoleErrors,[]);
 report.status='PASS';
} catch(e){report.status='FAIL';report.error=String(e?.stack??e)}
finally {
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 await ctx?.close().catch(()=>{});
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
