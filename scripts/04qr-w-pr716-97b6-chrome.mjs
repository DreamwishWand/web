// 04 QR-W independent actual Chromium NEW_ONLY PR716; synthetic EditorDocument, NOT Native P1G.
// Real native tab zoom 100%/200% through the accepted local test extension (not CSS zoom).
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root=(process.env.QR716_URL??'http://127.0.0.1:4195/editor/world/').replace(/\/?$/,'/');
const out=[];
const errors=[],consoleErrors=[],offsite=[];
const furniture=(id,x,y)=>({
 editorId:id,itemId:40000001,layer:'furniture',x,y,orientation:0,
 footprint:[{x:0,y:0}],source:{rootGridId:10},portableState:null,
 dependencyIds:[],editability:'editable',
 metadata:{displayName:id,rootGridId:10,reasons:[]}
});
const invalid={
 rootGridId:o=>{o.source.rootGridId=11;},
 parentGridId:o=>{o.metadata.parentGridId=10;},
 subGridDataPath:o=>{o.source.subGridDataPath='World/Villages[0]/Areas[2]/SubGrid[8]';}
};
const make=field=>{
 const good=furniture('Valid',1,2),bad=furniture('Untrusted',8,3);
 invalid[field](bad);
 return {
  schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{platform:'synthetic',gameVersion:'1.25.0',rootGridId:10,areaKey:'QR716_BROWSER'},
  capabilities:{},metadata:{},networks:{roads:null,fences:null},
  objects:[good,bad]
 };
};
const extension=resolve('tests/browser/wep-zoom200-extension');
let ctx;
const dir=await mkdtemp(join(tmpdir(),'qr716-independent-'));
async function tabZoom(sw,level){
 const actual=await sw.evaluate(async args=>{
  const tab=(await chrome.tabs.query({})).find(t=>t.url?.startsWith(args.prefix));
  if(!tab?.id)throw Error('QR716_BROWSER_TAB_MISSING');
  await chrome.tabs.setZoom(tab.id,args.zoom);
  return chrome.tabs.getZoom(tab.id);
 },{prefix:root,zoom:level});
 assert.equal(actual,level,'actual Chrome tab zoom 100/200');
}
try{
 ctx=await chromium.launchPersistentContext(dir,{
  channel:'chromium',headless:true,viewport:{width:1280,height:960},
  args:['--no-sandbox','--disable-dev-shm-usage',
   '--disable-extensions-except='+extension,'--load-extension='+extension]
 });
 const page=await ctx.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
 ctx.on('request',req=>{
  const u=new URL(req.url());
  if(req.method()!=='GET'||u.origin!==new URL(root).origin)offsite.push(req.method()+' '+req.url());
 });
 await page.goto(root,{waitUntil:'networkidle',timeout:30000});
 const sw=ctx.serviceWorkers()[0]??await ctx.waitForEvent('serviceworker',{timeout:15000});
 for(const [zoom,label] of [[1,100],[2,200]]){
  await tabZoom(sw,zoom);
  for(const field of ['rootGridId','parentGridId','subGridDataPath']){
   await page.goto(root,{waitUntil:'networkidle'});
   const doc=make(field);
   const sourceBytes=Buffer.from(JSON.stringify(doc));
   await page.locator('.load-panel input[type=file]').setInputFiles({
    name:'qr716-independent-'+field+'.json',mimeType:'application/json',
    buffer:sourceBytes
   });
   await page.getByText('Synthetic draft authoring',{exact:true}).waitFor({timeout:20000});
   await page.locator('.world-canvas').waitFor({timeout:20000});
   // The invalid SECOND selected object is absent from scene, not silently shown as furniture.
   assert.equal(await page.locator('g[data-editor-object-id="Valid"]').count(),1);
   assert.equal(await page.locator('g[data-editor-object-id="Untrusted"]').count(),0);
   assert.match(await page.locator('[data-wep-spatial-unresolved]').innerText(),/1/);

   const result=await page.evaluate(async source=>{
    const {createEditorSession}=await import('/src/lib/wep/editor-runtime.ts');
    const {buildSpatialScene}=await import('/src/lib/wep/spatial-scene.ts');
    const session=createEditorSession(source,{allowInvalidDraft:true});
    const scene=buildSpatialScene(session.getDocument());
    const selected=session.setSelection(['Valid','Untrusted']);
    const snap=JSON.stringify(session.exportRecoverySnapshot());
    const docBefore=JSON.stringify(session.getDocument());
    const historyBefore=JSON.stringify(session.getHistoryState());
    const bounds={x:0,y:0,w:16,h:12};
    const preview=session.previewStrictMove(['Untrusted','Valid'],2,-1,bounds);
    const previewSame=JSON.stringify(session.exportRecoverySnapshot())===snap;
    const moved=session.move(['Valid','Untrusted'],2,-1,{strict:true,areaBounds:bounds});
    return {
     selected,previewCode:preview.code,previewOk:preview.ok,previewSame,
     applied:moved.applied,draftBlocked:moved.draftBlocked,moveCode:moved.validation?.issues?.[0]?.code,
     docSame:JSON.stringify(session.getDocument())===docBefore,
     historySame:JSON.stringify(session.getHistoryState())===historyBefore,
     recoverySame:JSON.stringify(session.exportRecoverySnapshot())===snap,
     objects:session.getDocument().objects.map(o=>[o.editorId,o.x,o.y]),
     unresolved:scene.unresolved.map(x=>x.editorId),
     visible:scene.objects.map(x=>x.editorId),
     nativeWriter:scene.persistentWriteAuthorized,
     history:session.getHistoryState()
    };
   },doc);
   const expected=field==='rootGridId'?'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID':'WEP_MULTI_DRAG_SUBGRID_UNPROVEN';
   assert.deepEqual(result.selected,['Valid','Untrusted']);
   assert.equal(result.previewCode,expected);
   assert.equal(result.previewOk,false);
   assert.equal(result.previewSame,true);
   assert.equal(result.applied,false);
   assert.equal(result.draftBlocked,true);
   assert.equal(result.moveCode,expected);
   for(const k of ['docSame','historySame','recoverySame'])assert.equal(result[k],true,field+':'+k);
   assert.deepEqual(result.objects,[['Valid',1,2],['Untrusted',8,3]]);
   assert.ok(result.visible.includes('Valid'));
   assert.ok(!result.visible.includes('Untrusted'));
   assert.deepEqual(result.unresolved,['Untrusted']);
   assert.equal(result.nativeWriter,false);
   assert.deepEqual(result.history,{undoDepth:0,redoDepth:0,lastKind:null});
   assert.equal(await page.locator('[data-wep-verified-export]').count(),1);
   assert.equal(await page.locator('[data-wep-verified-export] button').first().isDisabled(),true);
   assert.equal(sourceBytes.toString(),JSON.stringify(doc),'synthetic origin byte fixture unchanged');
   out.push({zoom:label,field,status:'PASS'});
   console.log('QR716_INDEPENDENT_CHROME_NATIVE_ZOOM_'+label+'_'+field+'_ATOMIC_PASS');
  }
 }
 assert.equal(out.length,6);
 assert.deepEqual(errors,[],'no unhandled browser errors');
 assert.deepEqual(consoleErrors,[],'no console errors');
 // This local dev harness must not emit off-origin or write requests (Vite HMR WS not counted).
 assert.deepEqual(offsite,[],'no private Save upload, POST, or off-origin calls');
 console.log('QR716_INDEPENDENT_CHROME_ALL_SIX_PASS '+JSON.stringify(out));
} finally {
 await ctx?.close().catch(()=>{});
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
