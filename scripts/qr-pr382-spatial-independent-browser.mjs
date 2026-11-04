// 04 QR independent new-only ACTUAL Chrome PR382 2D scene: local synthetic-shaped
// Area/Grid → SVG geometry/hit → stable Editor/native ID → Move diff → Undo.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const ROOT='http://127.0.0.1:4202/editor/world/';
const exe=process.env.CHROME_BIN;
assert.ok(exe);
const browser=await chromium.launch({executablePath:exe,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const page=await context.newPage(),errors=[],writes=[];
page.on('pageerror',e=>errors.push(String(e)));
context.on('request',r=>{if(r.method()!=='GET')writes.push(r.method()+' '+r.url());});
const object=(editorId,x,y,extra={})=>({
  editorId,itemId:40000001,layer:'furniture',x,y,orientation:0,
  footprint:[{x:0,y:0},{x:1,y:0}],
  source:{rootGridId:42,gridObjectId:editorId},
  portableState:null,dependencyIds:[],editability:'editable',
  metadata:{displayName:editorId,reasons:[],rootGridId:42},
  ...extra
});
const fixture=(type='A')=>{
  const items=type==='B'?[object('b-scene',13,5)]:
    [object('alpha',2,2),object('beta',7,2),
     object('foreign-grid',11,2,{metadata:{displayName:'conflict',reasons:[],rootGridId:43}}),
     object('unproven-child',15,2,{source:{rootGridId:42,gridObjectId:'unproven-child',subGridDataPath:'unknown/child'}})];
  return {schema:'dreamwish-wand-wep-editor-document',version:1,
   target:{platform:'synthetic',gameVersion:'1.25.0',areaKey:type,rootGridId:42},
   networks:{roads:null,fences:null},roomFinish:null,capabilities:{},
   metadata:{rootGridBounds:{x:0,y:0,w:22,h:13}},objects:items};
};
const locator=id=>page.locator('g[data-editor-object-id="'+id+'"]');
async function load(type='A'){
 await page.goto(ROOT,{waitUntil:'networkidle'});
 await page.locator('.load-panel input[type=file]').setInputFiles({
   name:'qr382-local-'+type+'.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(fixture(type)))
 });
 await page.locator('[data-wep-spatial-controls]').waitFor({timeout:25000});
}
const mark=x=>console.log('QR_WEP382_'+x+'_PASS');
try {
 await load();
 assert.equal(await page.locator('g[data-editor-object-id]').count(),2,'unproven source objects must not paint');
 assert.equal(await page.locator('[data-wep-spatial-unresolved]').count(),1);
 assert.match(await page.locator('[data-wep-spatial-unresolved]').innerText(),/2/);
 await page.locator('[data-wep-spatial-unresolved-details] summary').click();
 assert.match(await page.locator('[data-wep-spatial-unresolved-details]').innerText(),/SPATIAL_GRID_CONFLICT/);
 assert.match(await page.locator('[data-wep-spatial-unresolved-details]').innerText(),/SPATIAL_SUBGRID_TRANSFORM_UNPROVEN/);
 mark('SOURCE_GRID_AND_SUBGRID_FAILCLOSED_UNPAINTED');
 const canvas=page.locator('svg[data-wep-marquee-canvas]');
 assert.ok(await canvas.count());
 assert.equal(await locator('alpha').getAttribute('data-wep-spatial-editor-id'),'alpha');
 assert.equal(await locator('alpha').getAttribute('data-wep-spatial-native-grid-object-id'),'alpha');
 await locator('alpha').click();
 assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/alpha/);
 assert.match(await page.locator('[data-wep-spatial-native-id]').innerText(),/alpha/);
 mark('SVG_REAL_POINTER_HIT_EDITOR_AND_NATIVE_ID_SAME_SESSION');
 const viewport=await canvas.getAttribute('viewBox');
 await page.locator('[data-wep-spatial-controls]').getByRole('button',{name:/Zoom in|拡大/}).click();
 assert.notEqual(await canvas.getAttribute('viewBox'),viewport);
 await page.locator('[data-wep-spatial-controls]').getByRole('button',{name:/Fit Area|エリアに合わせる/}).click();
 assert.equal(await canvas.getAttribute('viewBox'),viewport);
 mark('SCENE_ZOOM_FIT_SAME_COORDINATE_FRAME');
 await locator('alpha').click();
 await locator('beta').click({modifiers:['Control']});
 assert.equal(await page.locator('g.selected[data-editor-object]').count(),2);
 await locator('beta').focus();
 await page.keyboard.press('ArrowRight');
 await page.locator('g[data-editor-object-id="alpha"][aria-label*="3, 2"]').waitFor({timeout:16000});
 assert.match(await page.locator('[data-wep-spatial-delta="alpha"]').innerText(),/2,2\/0.*3,2\/0/s);
 assert.match(await page.locator('[data-wep-spatial-changes]').innerText(),/alpha.*MOVE/s);
 await page.locator('.toolbar-actions').getByRole('button',{name:'Undo',exact:true}).click();
 await page.locator('g[data-editor-object-id="alpha"][aria-label*="2, 2"]').waitFor({timeout:14000});
 assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
 await page.locator('.toolbar-actions').getByRole('button',{name:'Redo',exact:true}).click();
 await page.locator('g[data-editor-object-id="alpha"][aria-label*="3, 2"]').waitFor({timeout:14000});
 mark('TWO_OBJECT_MOVE_PREVIEW_EXACT_DIFF_UNDO_REDO');
 await load('B');
 assert.equal(await locator('alpha').count(),0,'old object must not survive new session');
 assert.equal(await page.locator('[data-wep-spatial-changes]').count(),0);
 await locator('b-scene').click();
 assert.match(await page.locator('[data-wep-spatial-details-id]').innerText(),/b-scene/);
 mark('AREA_A_TO_B_SESSION_ID_AND_HISTORY_ISOLATED');
 await page.setViewportSize({width:320,height:800});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+2),'320px overflow');
 assert.deepEqual(errors,[],'no JS exceptions');
 assert.deepEqual(writes,[],'local spatial Editor must not upload or publish');
 mark('MOBILE_320_NO_NETWORK_WRITE_OR_EXCEPTIONS');
 console.log('QR_WEP382_INDEPENDENT_ACTUAL_CHROMIUM_SYNTHETIC_SPATIAL_TARGETED_PASS');
} finally {
 await context.close();
 await browser.close();
}
