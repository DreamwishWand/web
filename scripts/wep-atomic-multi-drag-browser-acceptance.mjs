import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

const base=process.env.WEP_ATOMIC_MOVE_BASE_URL??'http://127.0.0.1:4193/editor/world/';
const output=resolve('.artifacts/wep-atomic-multi-move');
await mkdir(output,{recursive:true});
const report={schema:'wep-strict-local-atomic-multi-move@1',fixture:'SYNTHETIC_ONLY',
  proof:'CHROME_NATIVE_TABS_SETZOOM_GETZOOM_NOT_CSS_VIEWPORT',checks:[],errors:[],pageErrors:[],status:'PENDING'};
const pass=(label,extra={})=>report.checks.push({label,verdict:'PASS',...extra});
const make=(id,x,y,layer='furniture',editability='editable')=>({
 editorId:id,itemId:layer==='road'?30000001:40000001,layer,x,y,
 orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],
 editability,metadata:{displayName:id,reasons:[]}
});
const draft={
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'atomic-move-fixture'},
 capabilities:{},metadata:{},networks:{roads:null,fences:null},
 objects:[make('Chair',2,2),make('Lamp',6,2),make('Road',4,2,'road','readonly'),make('Protected',10,2,'furniture','readonly')]
};
const raw626={GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
 Player:{},World:{Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true}}}],
 GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{Opaque:true}}}}}}}};
const sel=async page=>(await page.locator('g.selected[data-editor-object]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-editor-object-id')))).sort();
const object=(page,name,x,y)=>page.locator('g[data-editor-object][aria-label^="'+name+' at '+x+', '+y+'"]').first();
const coords=(page,x,y)=>page.locator('.world-canvas').evaluate((svg,{x,y})=>{
 const matrix=svg.getScreenCTM();
 if(!matrix)throw new Error('NO_NATIVE_SVG_CTM');
 const v=new DOMPoint(x,y).matrixTransform(matrix);
 return {x:v.x,y:v.y};
},{x,y});
async function move(page,start,delta){
 await page.locator('.world-canvas').scrollIntoViewIfNeeded();
 const a=await coords(page,start.x,start.y);
 const b=await coords(page,start.x+delta.x,start.y+delta.y);
 await page.mouse.move(a.x,a.y);
 await page.mouse.down();
 await page.mouse.move(b.x,b.y,{steps:6});
 return async()=>page.mouse.up();
}
async function load(page){
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('.load-panel input[type=file]').setInputFiles({
 name:'synthetic-atomic-move.json',mimeType:'application/json',
 buffer:Buffer.from(JSON.stringify(draft))
 });
 await page.getByText('Synthetic draft authoring',{exact:true}).waitFor();
 await (await object(page,'Chair',2,2)).click();
 await (await object(page,'Lamp',6,2)).click({modifiers:['Control']});
 assert.deepEqual(await sel(page),['Chair','Lamp']);
 await page.locator('[data-wep-multi-move-hint]').waitFor();
}
async function runLocal(page,factor){
 await load(page);
 const up=await move(page,{x:2.5,y:2.5},{x:1,y:0});
 await page.locator('[data-wep-multi-move-preview]').waitFor();
 assert.equal(await (await object(page,'Chair',2,2)).count(),1);
 assert.equal(await (await object(page,'Lamp',6,2)).count(),1);
 assert.equal(await page.locator('.multi-move-ghost').count(),2);
 pass('ZOOM'+factor+'_SNAP_GHOST_ONLY_NO_DRAFT_DURING_DRAG');
 await up();
 await (await object(page,'Chair',3,2)).waitFor();
 await (await object(page,'Lamp',7,2)).waitFor();
 assert.deepEqual(await sel(page),['Chair','Lamp']);
 assert.equal(await page.locator('.multi-move-ghost').count(),0);
 pass('ZOOM'+factor+'_ATOMIC_BOTH_MOVED_SELECTION_PRESERVED');
 const toolbar=page.locator('.toolbar-actions');
 await toolbar.getByRole('button',{name:'Undo',exact:true}).click();
 await (await object(page,'Chair',2,2)).waitFor();
 await (await object(page,'Lamp',6,2)).waitFor();
 assert.equal(await toolbar.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true,
   'Only ONE command for the whole group');
 await toolbar.getByRole('button',{name:'Redo',exact:true}).click();
 await (await object(page,'Chair',3,2)).waitFor();
 await (await object(page,'Lamp',7,2)).waitFor();
 pass('ZOOM'+factor+'_ONE_UNDO_AND_ONE_REDO');
 // Reset fixture before invalid overlapping destination.
 await load(page);
 const cancel=await move(page,{x:2.5,y:2.5},{x:2,y:0});
 assert.equal(await page.locator('[data-wep-multi-move-preview]').count(),0,
 'Road obstruction cannot show an authorized ghost');
 await cancel();
 assert.equal(await (await object(page,'Chair',2,2)).count(),1);
 assert.equal(await (await object(page,'Lamp',6,2)).count(),1);
 assert.equal(await toolbar.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
 assert.match(await page.locator('[data-wep-multi-move-status]').innerText(),/COLLISION|rejected/i);
 pass('ZOOM'+factor+'_ROAD_COLLISION_REJECTS_BOTH_NO_HISTORY');
 // Escape aborts while preview is visible.
 const escape=await move(page,{x:2.5,y:2.5},{x:1,y:0});
 await page.locator('[data-wep-multi-move-preview]').waitFor();
 await page.keyboard.press('Escape');
 await escape();
 assert.equal(await page.locator('[data-wep-multi-move-preview]').count(),0);
 assert.equal(await (await object(page,'Chair',2,2)).count(),1);
 assert.equal(await toolbar.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
 pass('ZOOM'+factor+'_ESC_REVERTS_PREVIEW_NO_HISTORY');
 // A cancelled pointer event never creates a draft command.
 const cancelled=await move(page,{x:2.5,y:2.5},{x:1,y:0});
 await page.locator('[data-wep-multi-move-preview]').waitFor();
 await page.locator('g[data-editor-object-id="Chair"]').evaluate(node=>{
   node.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1}));
 });
 await cancelled();
 assert.equal(await (await object(page,'Chair',2,2)).count(),1);
 assert.equal(await toolbar.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
 pass('ZOOM'+factor+'_POINTERCANCEL_FAIL_CLOSED');
 // Pointer capture must not turn a release outside the current Area into a commit.
 const out=await move(page,{x:2.5,y:2.5},{x:-4,y:0});
 assert.equal(await page.locator('[data-wep-multi-move-preview]').count(),0);
 await out();
 assert.equal(await (await object(page,'Chair',2,2)).count(),1);
 assert.equal(await toolbar.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
 pass('ZOOM'+factor+'_OUT_OF_AREA_RELEASE_NO_HISTORY');
 // New synthetic session replaces the previous active session during a gesture.
 const beforeReset=await move(page,{x:2.5,y:2.5},{x:1,y:0});
 await page.locator('[data-wep-multi-move-preview]').waitFor();
 await page.locator('.load-panel input[type=file]').setInputFiles({
   name:'new-session-synthetic.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(draft))
 });
 await page.getByText('Synthetic draft authoring',{exact:true}).waitFor();
 await beforeReset();
 assert.equal(await (await object(page,'Chair',2,2)).count(),1);
 assert.equal(await toolbar.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
 pass('ZOOM'+factor+'_SESSION_REPLACED_DURING_DRAG_NO_HISTORY');
 // Restore selected set after session replacement for legacy tool checks.
 await (await object(page,'Chair',2,2)).click();
 await (await object(page,'Lamp',6,2)).click({modifiers:['Control']});
 // Existing modifier click and marquee are not consumed by move dragging.
 await page.locator('[data-wep-marquee-toggle]').click();
 assert.equal(await page.locator('[data-wep-marquee-toggle]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-wep-marquee-toggle]').click();
 assert.deepEqual(await sel(page),['Chair','Lamp']);
 pass('ZOOM'+factor+'_MARQUEE_AND_ORIGINAL_CLICK_INTACT');
 if(factor===100){
  await page.locator('#site-locale').selectOption('ja');
  await page.locator('[data-wep-multi-move-hint]').waitFor();
  assert.match(await page.locator('[data-wep-multi-move-hint]').innerText(),/家具/);
  await page.locator('#site-locale').selectOption('en');
  pass('ZOOM100_JA_LOCALE_HINT');
 }
 await page.screenshot({path:join(output,'move-zoom-'+factor+'.png'),fullPage:true});
}
async function zoom(sw,value){
 const r=await sw.evaluate(async({base,value})=>{
  const t=(await chrome.tabs.query({})).find(tab=>tab.url?.startsWith(base));
  if(!t?.id)throw new Error('NO_CHROME_TAB');
  await chrome.tabs.setZoom(t.id,value);
  return await chrome.tabs.getZoom(t.id);
 },{base,value});
 assert.equal(r,value);
 return r;
}
const dir=await mkdtemp(join(tmpdir(),'wep-atomic-move-'));let context;
try{
 context=await chromium.launchPersistentContext(dir,{
  channel:'chromium',headless:true,viewport:{width:1280,height:960},
  args:['--no-sandbox','--disable-dev-shm-usage',
   '--disable-extensions-except='+resolve('tests/browser/wep-zoom200-extension'),
   '--load-extension='+resolve('tests/browser/wep-zoom200-extension')]
 });
 const page=await context.newPage();
 page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text())});
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 await page.goto(base,{waitUntil:'networkidle'});
 const sw=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:15000});
 report.zoom100=await zoom(sw,1);
 await runLocal(page,100);
 report.zoom200=await zoom(sw,2);
 report.metrics200=await page.evaluate(()=>({dpr:devicePixelRatio,innerWidth,outerWidth,visualScale:visualViewport?.scale}));
 assert.equal(report.metrics200.dpr,2);
 assert.equal(report.metrics200.innerWidth,640);
 assert.equal(report.metrics200.outerWidth,1280);
 assert.equal(report.metrics200.visualScale,1);
 await runLocal(page,200);
 // 320px CSS responsiveness is a different test from native tab zoom.
 await zoom(sw,1);
 await page.setViewportSize({width:320,height:740});
 const viewport=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(viewport.scroll<=viewport.width+2,JSON.stringify(viewport));
 assert.equal(await page.locator('[data-wep-multi-move-hint]').count(),1);
 pass('MOBILE320_NO_HORIZONTAL_OVERFLOW_DISTINCT_FROM_200ZOOM');
 await page.setViewportSize({width:1280,height:960});
 await zoom(sw,2);
 await page.goto(base,{waitUntil:'networkidle'});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 await page.locator('.load-panel input[type=file]').setInputFiles({
   name:'synthetic-626.save',mimeType:'application/octet-stream',
   buffer:Buffer.from(makeSyntheticP1gProfile(raw626))
 });
 await page.locator('[data-wep-626-readonly]').waitFor();
 assert.equal(await page.locator('.editor-shell').count(),0);
 assert.equal(await page.locator('[data-wep-multi-move-hint]').count(),0);
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
 pass('ZOOM200_SWITCH1253_SCHEMA626_READONLY_NO_MOVE_OR_APPLY');
 await page.screenshot({path:join(output,'move-readonly626.png'),fullPage:true});
 assert.deepEqual(report.errors,[]);
 assert.deepEqual(report.pageErrors,[]);
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=String(e?.stack??e);}
finally{
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 await context?.close().catch(()=>{});
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
