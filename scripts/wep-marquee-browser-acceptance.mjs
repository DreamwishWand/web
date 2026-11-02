import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { makeSyntheticP1gProfile } from '../tests/helpers/p1g-fixture.mjs';

const baseUrl=process.env.WEP_MARQUEE_BASE_URL ?? 'http://127.0.0.1:4192/editor/world/';
const artifacts=resolve('.artifacts/wep-marquee-browser');
const extension=resolve('tests/browser/wep-zoom200-extension');
await mkdir(artifacts,{recursive:true});
const report={schema:'wep-marquee-real-zoom-browser@1',fixture:'SYNTHETIC_ONLY',
  realZoom:'chrome.tabs.setZoom/getZoom',checks:[],pageErrors:[],consoleErrors:[],result:'PENDING'};
const pass=(name,detail={})=>report.checks.push({name,status:'PASS',...detail});
const editor={
  schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{gameVersion:'1.25.0',platform:'synthetic',areaKey:'marquee-synthetic-only'},
  capabilities:{},metadata:{},networks:{roads:null,fences:null},
  objects:[
    {editorId:'chair',itemId:40000001,layer:'furniture',x:2,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Editable Chair',reasons:[]}},
    {editorId:'lamp',itemId:40000002,layer:'furniture',x:6,y:2,orientation:0,footprint:[{x:0,y:0},{x:1,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Editable Lamp',reasons:[]}},
    {editorId:'protected',itemId:40000003,layer:'furniture',x:10,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'readonly',metadata:{displayName:'Protected Object',reasons:['PROGRESSION_OWNERSHIP_UNKNOWN']}},
    {editorId:'road',itemId:30000001,layer:'road',x:4,y:2,orientation:0,footprint:[{x:0,y:0}],source:null,portableState:null,dependencyIds:[],editability:'editable',metadata:{displayName:'Road object',reasons:[]}}
  ]
};
const schema626={GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:'DeviceType_Windows'}},
  Player:{},World:{
    Villages:[{Areas:{'7':{GridIDs:[10],Unlocked:true}}}],
    GridCollection:{Grids:{'10':{ID:10,Objects:{'42':{State:{Opaque:true}}}}}}
  }
};
const selected=async page=>page.locator('g.selected[data-editor-object]').evaluateAll(ns=>ns.map(n=>n.getAttribute('data-editor-object-id')).sort());
const cell=async(page,name,x,y)=>page.locator('g[data-editor-object][aria-label^="'+name+' at '+x+', '+y+'"]').first();
async function screen(page,world){
 return page.locator('.world-canvas').evaluate((svg,p)=>{
   const m=svg.getScreenCTM();
   if(!m)throw new Error('NO_SVG_SCREEN_TRANSFORM');
   const client=new DOMPoint(p.x,p.y).matrixTransform(m);
   return {x:client.x,y:client.y};
 },world);
}
async function drag(page,from,to,{modifiers=[]}={}){
 const svg=page.locator('[data-wep-marquee-canvas]');
 await svg.scrollIntoViewIfNeeded();
 const start=await screen(page,from),end=await screen(page,to);
 await page.mouse.move(start.x,start.y);
 for(const key of modifiers) await page.keyboard.down(key);
 await page.mouse.down();
 await page.mouse.move(end.x,end.y,{steps:8});
 return async()=>{
   await page.mouse.up();
   for(const key of modifiers.slice().reverse())await page.keyboard.up(key);
 };
}
async function switchZoom(sw,url,expected){
 const result=await sw.evaluate(async({url,zoom})=>{
   const t=(await chrome.tabs.query({})).find(t=>t.url?.startsWith(url));
   if(!t?.id)throw new Error('ZOOM_TAB_MISSING');
   await chrome.tabs.setZoom(t.id,zoom);
   return {actual:await chrome.tabs.getZoom(t.id),settings:await chrome.tabs.getZoomSettings(t.id)};
 },{url,zoom:expected});
 assert.equal(result.actual,expected);
 return result;
}
async function runAt(page,level){
 await page.goto(baseUrl,{waitUntil:'networkidle'});
 await page.locator('.load-panel input[type=file]').setInputFiles({name:'marquee-editor-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(editor))});
 await page.getByText('Synthetic draft authoring',{exact:true}).waitFor();
 const toggle=page.locator('[data-wep-marquee-toggle]');
 await toggle.focus();
 await page.keyboard.press('Enter');
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 const complete=await drag(page,{x:0.4,y:0.6},{x:12.3,y:4.3});
 await page.locator('[data-wep-marquee-preview]').waitFor();
 assert.deepEqual(await selected(page),[],'preview cannot mutate committed selection');
 assert.equal(await page.locator('g.marquee-preview[data-editor-object]').count(),2);
 await complete();
 assert.deepEqual(await selected(page),['chair','lamp']);
 assert.equal(await page.locator('[data-wep-marquee-preview]').count(),0);
 assert.ok((await page.locator('[data-wep-marquee-status]').innerText()).length>0);
 pass('ZOOM_'+level+'_MARQUEE_PREVIEW_AND_PROTECTED_ROADFENCE_DENIAL');
 // Ctrl toggles chair off, Shift adds chair, Alt subtracts chair.
 await (await drag(page,{x:0.4,y:0.6},{x:3.7,y:3.7},{modifiers:['Control']}))();
 assert.deepEqual(await selected(page),['lamp']);
 await (await drag(page,{x:0.4,y:0.6},{x:3.7,y:3.7},{modifiers:['Shift']}))();
 assert.deepEqual(await selected(page),['chair','lamp']);
 await (await drag(page,{x:0.4,y:0.6},{x:3.7,y:3.7},{modifiers:['Alt']}))();
 assert.deepEqual(await selected(page),['lamp']);
 pass('ZOOM_'+level+'_CTRL_TOGGLE_SHIFT_ADD_ALT_SUBTRACT');
 // Escape rejects an in-flight drag and leaves the previous selection.
 await drag(page,{x:0.4,y:0.6},{x:12.3,y:4.3});
 await page.keyboard.press('Escape');
 await page.mouse.up();
 assert.equal(await page.locator('[data-wep-marquee-preview]').count(),0);
 assert.deepEqual(await selected(page),['lamp']);
 pass('ZOOM_'+level+'_ESC_CANCEL_NO_DRAFT');
 // Cancellation by the UA / touch/pen signal must discard the preview.
 await drag(page,{x:0.4,y:0.6},{x:12.3,y:4.3});
 await page.locator('[data-wep-marquee-canvas]').evaluate(svg=>
   svg.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1})));
 await page.mouse.up();
 assert.equal(await page.locator('[data-wep-marquee-preview]').count(),0);
 assert.deepEqual(await selected(page),['lamp']);
 pass('ZOOM_'+level+'_POINTER_CANCEL_NO_SELECTION_CHANGE');
 // Releasing outside the exact canvas/Area must abort instead of clipping.
 const svg=page.locator('[data-wep-marquee-canvas]');
 await svg.scrollIntoViewIfNeeded();
 const start=await screen(page,{x:0.4,y:0.6});
 await page.mouse.move(start.x,start.y);
 await page.mouse.down();
 const center=await screen(page,{x:12.3,y:4.3});
 await page.mouse.move(center.x,center.y,{steps:7});
 assert.equal(await page.locator('[data-wep-marquee-preview]').count(),1);
 await page.mouse.move(2,2,{steps:5});
 await page.mouse.up();
 assert.equal(await page.locator('[data-wep-marquee-preview]').count(),0);
 assert.deepEqual(await selected(page),['lamp']);
 pass('ZOOM_'+level+'_OUT_OF_AREA_RELEASE_ABORT');
 // Exact user-visible search filters candidate selection.
 await page.locator('[data-wep-search-input]').fill('lamp');
 await (await drag(page,{x:0.4,y:0.6},{x:12.3,y:4.3}))();
 assert.deepEqual(await selected(page),['lamp']);
 await page.locator('[data-wep-search-input]').fill('');
 pass('ZOOM_'+level+'_SEARCH_FILTER');
 // Hide furniture: no hidden object is selectable, and prior invisible selection is reconciled.
 await page.getByRole('button',{name:/furniture/}).click();
 await (await drag(page,{x:0.4,y:0.6},{x:12.3,y:4.3}))();
 assert.deepEqual(await selected(page),[]);
 await page.getByRole('button',{name:/furniture/}).click();
 pass('ZOOM_'+level+'_LAYER_FILTER');
 // A point click is unchanged (the old modifier click is preserved).
 await toggle.click(); // tool off
 const chair=await cell(page,'Editable Chair',2,2),lamp=await cell(page,'Editable Lamp',6,2);
 await chair.click();
 await lamp.click({modifiers:['Control']});
 assert.deepEqual(await selected(page),['chair','lamp']);
 // Drag selection itself did not move objects or issue draft transactions.
 assert.equal(await (await cell(page,'Editable Chair',2,2)).count(),1);
 assert.equal(await (await cell(page,'Editable Lamp',6,2)).count(),1);
 pass('ZOOM_'+level+'_ORIGINAL_CLICK_MODIFIER_UNCHANGED_AND_NO_DRAG_MUTATION');
 // Only an explicit button may create the next draft command.
 await page.locator('.toolbar-actions').getByRole('button',{name:'Move right'}).click();
 await (await cell(page,'Editable Chair',3,2)).waitFor();
 await (await cell(page,'Editable Lamp',7,2)).waitFor();
 await page.locator('.toolbar-actions').getByRole('button',{name:'Undo',exact:true}).click();
 await (await cell(page,'Editable Chair',2,2)).waitFor();
 await page.locator('.toolbar-actions').getByRole('button',{name:'Redo',exact:true}).click();
 await (await cell(page,'Editable Chair',3,2)).waitFor();
 pass('ZOOM_'+level+'_EXPLICIT_DRAFT_MUTATION_UNDO_REDO');
 await page.locator('#site-locale').selectOption('ja');
 await page.getByRole('button',{name:'矩形範囲選択'}).waitFor();
 await page.locator('#site-locale').selectOption('en');
 pass('ZOOM_'+level+'_SHARED_LOCALE_UI_JA');
 await page.screenshot({path:join(artifacts,'marquee-'+level+'.png'),fullPage:true});
}
const temp=await mkdtemp(join(tmpdir(),'wep-marquee-'));
let context;
try{
 context=await chromium.launchPersistentContext(temp,{channel:'chromium',headless:true,viewport:{width:1280,height:960},acceptDownloads:false,
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-extensions-except='+extension,'--load-extension='+extension]});
 const page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
 const sw=context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker',{timeout:20000});
 await page.goto(baseUrl,{waitUntil:'networkidle'});
 report.zoom100=await switchZoom(sw,baseUrl,1);
 await runAt(page,100);
 report.zoom200=await switchZoom(sw,baseUrl,2);
 report.metrics200=await page.evaluate(()=>({innerWidth,outerWidth,dpr:devicePixelRatio,visualScale:visualViewport?.scale}));
 assert.equal(report.metrics200.dpr,2);
 assert.equal(report.metrics200.innerWidth,640);
 assert.equal(report.metrics200.outerWidth,1280);
 assert.equal(report.metrics200.visualScale,1);
 await runAt(page,200);
 // Responsive width is a separate acceptance, not a surrogate for browser zoom.
 await switchZoom(sw,baseUrl,1);
 await page.setViewportSize({width:320,height:740});
 const responsive=await page.evaluate(()=>({
   innerWidth,scrollWidth:document.documentElement.scrollWidth
 }));
 assert.ok(responsive.scrollWidth<=responsive.innerWidth+2,JSON.stringify(responsive));
 assert.equal(await page.locator('[data-wep-marquee-toggle]').count(),1);
 pass('MOBILE_320_NEW_MARQUEE_AFFORDANCE_NO_HORIZONTAL_OVERFLOW');
 await page.setViewportSize({width:1280,height:960});
 await switchZoom(sw,baseUrl,2);
 // The same native zoomed tab must not let schema626 into canvas/draft.
 await page.goto(baseUrl,{waitUntil:'networkidle'});
 await page.locator('.platform-select select').selectOption('switch');
 await page.locator('[data-wep-626-bid] input').fill('9A239D3DB569756D');
 await page.locator('[data-wep-626-provenance] input').check();
 await page.locator('.load-panel input[type=file]').setInputFiles({name:'synthetic-only626.save',mimeType:'application/octet-stream',buffer:Buffer.from(makeSyntheticP1gProfile(schema626))});
 await page.locator('[data-wep-626-readonly]').waitFor();
 assert.equal(await page.locator('.editor-shell').count(),0);
 assert.equal(await page.locator('[data-wep-marquee-toggle]').count(),0);
 assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
 assert.equal((await switchZoom(sw,baseUrl,2)).actual,2);
 pass('ZOOM_200_SCHEMA626_REMAINS_READ_ONLY_NO_MARQUEE_DRAFT_OR_APPLY');
 await page.screenshot({path:join(artifacts,'marquee-626-readonly.png'),fullPage:true});
 assert.deepEqual(report.pageErrors,[]);
 assert.deepEqual(report.consoleErrors,[]);
 report.result='PASS';
}catch(e){report.result='FAIL';report.error=String(e?.stack??e);}
finally{
 await writeFile(join(artifacts,'report.json'),JSON.stringify(report,null,2)+'\n');
 await context?.close().catch(()=>{});
 await rm(temp,{force:true,recursive:true}).catch(()=>{});
}
console.log(JSON.stringify(report,null,2));
if(report.result!=='PASS') process.exitCode=1;
