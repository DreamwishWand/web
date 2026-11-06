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
const obj=(page,id,x,y)=>page.locator('g[data-editor-object][aria-label^="'+id+' at '+x+', '+y+'"]').first();
const selected=async(page)=>(await page.locator('g.selected[data-editor-object]').evaluateAll(
  ns=>ns.map(n=>n.getAttribute('data-editor-object-id')).sort()
));
const coords=(page,x,y)=>page.locator('.world-canvas').evaluate((svg,pt)=>{
  const matrix=svg.getScreenCTM();
  if(!matrix)throw Error('NO_SVG_SCREEN_CTM');
  const next=new DOMPoint(pt.x,pt.y).matrixTransform(matrix);
  return {x:next.x,y:next.y};
},{x,y});
async function load(page,field){
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('.load-panel input[type=file]').setInputFiles({
    name:'new-only-'+field+'.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(fixture(field)))
  });
  await page.getByText('Synthetic draft authoring',{exact:true}).waitFor();
  await obj(page,'Chair',2,2).click();
  await obj(page,'Lamp',6,2).click({modifiers:['Control']});
  assert.deepEqual(await selected(page),['Chair','Lamp']);
}
async function invalidPointerMove(page,field,zoom){
  await load(page,field);
  await page.locator('.world-canvas').scrollIntoViewIfNeeded();
  const from=await coords(page,2.5,2.5);
  const to=await coords(page,3.5,2.5);
  await page.mouse.move(from.x,from.y);
  await page.mouse.down();
  await page.mouse.move(to.x,to.y,{steps:6});
  assert.equal(await page.locator('[data-wep-multi-move-preview]').count(),0,
    field+' must not have an authorized ghost');
  await page.mouse.up();
  assert.equal(await obj(page,'Chair',2,2).count(),1,'Chair remains at initial position');
  assert.equal(await obj(page,'Lamp',6,2).count(),1,'Lamp remains at initial position');
  assert.equal(await obj(page,'Chair',3,2).count(),0,'Chair not partly moved');
  assert.equal(await obj(page,'Lamp',7,2).count(),0,'Lamp not partly moved');
  assert.deepEqual(await selected(page),['Chair','Lamp'],'both selected after failed group move');
  assert.equal(await page.locator('.toolbar-actions')
    .getByRole('button',{name:'Undo',exact:true}).isDisabled(),true,
    'rejected move must not create even one Undo command');
  assert.equal(await page.locator('.multi-move-ghost').count(),0);
  assert.equal(await page.locator('[data-wep-verified-export]').count(),0);
  note('ZOOM'+zoom+'_'+field+'_ATOMIC_GROUP_REJECT_NO_UNDO_OR_PARTIAL_MOVE');
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
      await invalidPointerMove(page,field,label);
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
