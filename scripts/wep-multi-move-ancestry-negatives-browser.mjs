import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright';

// NEW-ONLY PR307 ancestry cases. This is a synthetic EditorDocument,
// not an actual P1G, Native placement proof or Save Writer acceptance.
const base=process.env.WEP_ANCESTRY_BASE_URL||'http://127.0.0.1:4194/editor/world/';
const out=resolve('.artifacts/wep-multi-move-ancestry-negatives');
await mkdir(out,{recursive:true});
const checks=[],pageErrors=[],consoleErrors=[];
const note=(name)=>checks.push({name,status:'PASS'});
const furniture=(id,x,y)=>({
  editorId:id,itemId:40000001,layer:'furniture',x,y,orientation:0,
  footprint:[{x:0,y:0}],source:{rootGridId:10},portableState:null,
  dependencyIds:[],editability:'editable',
  metadata:{displayName:id,reasons:[],rootGridId:10}
});
const fixture=(field)=>{
  const chair=furniture('Chair',2,2),lamp=furniture('Lamp',6,2);
  if(field==='rootGridId')chair.metadata.rootGridId=11;
  if(field==='parentGridId')chair.source.parentGridId=10;
  if(field==='subGridDataPath')
    chair.metadata.subGridDataPath='World/Villages[0]/Areas[7]/SubGrid[20]';
  return {
    schema:'dreamwish-wand-wep-editor-document',version:1,
    target:{platform:'synthetic',gameVersion:'1.25.0',rootGridId:10,areaKey:'ancestry'},
    capabilities:{},metadata:{},networks:{roads:null,fences:null},
    objects:[chair,lamp]
  };
};
const obj=(page,id)=>page.locator('g[data-editor-object][data-editor-object-id="'+id+'"]').first();
const position=(page,id)=>obj(page,id).locator('rect.object-cell').first().evaluate(cell=>({
  x:Number(cell.getAttribute('x')),y:Number(cell.getAttribute('y'))
}));
const selected=async(page)=>(await page.locator('g.selected[data-editor-object]').evaluateAll(
  ns=>ns.map(n=>n.getAttribute('data-editor-object-id')).sort()
));
const coords=(page,x,y)=>page.locator('.world-canvas').evaluate((svg,pt)=>{
  const matrix=svg.getScreenCTM();
  if(!matrix)throw Error('NO_SVG_SCREEN_CTM');
  const next=new DOMPoint(pt.x,pt.y).matrixTransform(matrix);
  return {x:next.x,y:next.y};
},{x,y});
async function invalidGroupAncestry(page,field,zoom){
  await page.goto(base,{waitUntil:'networkidle'});
  const raw=fixture(field);
  await page.locator('.load-panel input[type=file]').setInputFiles({
    name:'new-only-'+field+'.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(raw))
  });
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor();
  // Existing spatial-scene contract fail-closes unknown ancestry *before*
  // interaction: the invalid Chair is not rendered/selectable. The legitimate
  // Lamp remains visible, but there is no authorized multi-object gesture.
  await page.locator('.world-canvas').waitFor();
  assert.equal(await obj(page,'Chair').count(),0,'untrusted ancestry excluded from UI');
  assert.equal(await obj(page,'Lamp').count(),1,'legitimate sibling stays visible');
  assert.match(await page.locator('[data-wep-spatial-unresolved]').innerText(),/1/);

  // Challenge the same existing EditorSession in actual Chrome despite the
  // UI's early exclusion, so a programmatic group Move cannot bypass it.
  const observed=await page.evaluate(async(documentFixture)=>{
    const {createEditorSession}=await import('/src/lib/wep/editor-runtime.ts');
    const session=createEditorSession(documentFixture,{allowInvalidDraft:true});
    const selected=session.setSelection(['Chair','Lamp']);
    const snapshot=JSON.stringify(session.exportRecoverySnapshot());
    const documentBefore=JSON.stringify(session.getDocument());
    const historyBefore=JSON.stringify(session.getHistoryState());
    const bounds={x:0,y:0,w:16,h:12};
    const preview=session.previewStrictMove(selected,1,0,bounds);
    const afterPreview=JSON.stringify(session.exportRecoverySnapshot());
    const result=session.move(selected,1,0,{strict:true,areaBounds:bounds});
    return {
      selected,previewOk:preview.ok,previewCode:preview.code,
      applied:result.applied,draftBlocked:result.draftBlocked,
      resultCode:result.validation?.issues?.[0]?.code,
      snapshotUnchanged:JSON.stringify(session.exportRecoverySnapshot())===snapshot,
      previewUnchanged:afterPreview===snapshot,
      documentUnchanged:JSON.stringify(session.getDocument())===documentBefore,
      historyUnchanged:JSON.stringify(session.getHistoryState())===historyBefore,
      history:session.getHistoryState(),
      objects:session.getDocument().objects.map(o=>[o.editorId,o.x,o.y])
    };
  },raw);
  const expected=field==='rootGridId'?
    'WEP_MULTI_DRAG_CROSS_GRID_OR_SUBGRID':'WEP_MULTI_DRAG_SUBGRID_UNPROVEN';
  assert.deepEqual(observed.selected,['Chair','Lamp']);
  assert.equal(observed.previewOk,false);
  assert.equal(observed.previewCode,expected);
  assert.equal(observed.applied,false);
  assert.equal(observed.draftBlocked,true);
  assert.equal(observed.resultCode,expected);
  for(const property of ['snapshotUnchanged','previewUnchanged','documentUnchanged','historyUnchanged'])
    assert.equal(observed[property],true,field+':'+property);
  assert.deepEqual(observed.history,{undoDepth:0,redoDepth:0,lastKind:null});
  assert.deepEqual(observed.objects,[['Chair',2,2],['Lamp',6,2]]);
  assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
  note('ZOOM'+zoom+'_'+field+'_UI_EXCLUDED_AND_IN_BROWSER_GROUP_ATOMIC_REJECT');
}
async function setZoom(sw,value){
  const got=await sw.evaluate(async({base,value})=>{
    const tab=(await chrome.tabs.query({})).find(x=>x.url?.startsWith(base));
    if(!tab?.id)throw Error('NO_TARGET_ZOOM_TAB');
    await chrome.tabs.setZoom(tab.id,value);
    return chrome.tabs.getZoom(tab.id);
  },{base,value});
  assert.equal(got,value);
}
const dir=await mkdtemp(join(tmpdir(),'wep-ancestry-'));
let context;
const result={contract:'wep-multi-move-ancestry-negatives@1',fixture:'SYNTHETIC_ONLY',
  source:'main-based existing previewStrictMove + strict Move, NO Native Writer',
  zoom:'real Chrome tab 100/200 (not CSS transform)',checks,pageErrors,consoleErrors,
  status:'PENDING'};
try{
  context=await chromium.launchPersistentContext(dir,{
    channel:'chromium',headless:true,viewport:{width:1280,height:960},
    args:['--no-sandbox','--disable-dev-shm-usage',
      '--disable-extensions-except='+resolve('tests/browser/wep-zoom200-extension'),
      '--load-extension='+resolve('tests/browser/wep-zoom200-extension')]
  });
  const page=await context.newPage();
  page.on('pageerror',e=>pageErrors.push(String(e)));
  page.on('console',e=>{if(e.type()==='error')consoleErrors.push(e.text());});
  await page.goto(base,{waitUntil:'networkidle'});
  const sw=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:15000});
  for(const [value,label] of [[1,100],[2,200]]){
    await setZoom(sw,value);
    for(const field of ['rootGridId','parentGridId','subGridDataPath'])
      await invalidGroupAncestry(page,field,label);
  }
  assert.deepEqual(pageErrors,[]);
  assert.deepEqual(consoleErrors,[]);
  result.status='PASS';
}catch(e){
  result.status='FAIL';result.error=String(e?.stack||e);
}finally{
  await writeFile(join(out,'report.json'),JSON.stringify(result,null,2)+'\n');
  await context?.close().catch(()=>{});
  await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
console.log(JSON.stringify(result,null,2));
if(result.status!=='PASS')process.exitCode=1;
