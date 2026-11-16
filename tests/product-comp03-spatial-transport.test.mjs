import test from 'node:test';
import assert from 'node:assert/strict';
import {createSteam626Comp03Transport,createSteam626Comp03SpatialTransport,createSteam626VaseAddTransport} from '../src/lib/ddv/core/save/product-scoped-placement-transport.mjs';
const h=c=>c.repeat(64),id='a'.repeat(32),original=h('b'),projected=h('f');
const initial={contract:'wand.product.single-save-session.boundary@1',schema:626,sessionId:id,revision:0,indexGeneration:1,decodedSha256:original,productWorkerBound:true,fullDocumentJsonValidated:true,writerAuthorized:false,editedCopyAuthorized:false,applyAuthorized:false};
const identity={platform:'steam-windows',buildKind:'steam-full-version',buildId:'releases_1.25-v1.25.3-44-g0b41250d9ac0-incremental-22',schema:626};
const env={sessionId:id,revision:0,indexGeneration:1,decodedSha256:original};
const preview={...env,contract:'wand.worker.steam626.scoped-comp03-layout@1',itemId:40100038,gridId:90001,seedId:500,nextObjectId:510,oldAmount:30,newAmount:30,inventoryDelta:0,gridSha256:h('c'),seedSha256:h('d'),inventoryEntrySha256:h('e'),projectedDecodedSha256:projected,exactFieldChangedCount:9,scopedCandidate:true,writerAuthorized:false,editedCopyAuthorized:false};
const anchors=()=>[
 {objectId:500,x:12,y:16,role:'retained'},
 {objectId:510,x:16,y:16,role:'proposed'},
 {objectId:511,x:20,y:16,role:'proposed'},
 {objectId:512,x:12,y:20,role:'proposed'},
 {objectId:513,x:16,y:20,role:'proposed'},
 {objectId:514,x:20,y:20,role:'proposed'},
 {objectId:515,x:12,y:24,role:'proposed'},
 {objectId:516,x:16,y:24,role:'proposed'},
 {objectId:517,x:20,y:24,role:'proposed'}
];
const spatial=()=>({...env,contract:'wand.worker.steam626.comp03-spatial-preview@1',rootSceneItemId:1540000150,gridId:90001,seedId:500,nextObjectId:510,anchors:anchors(),projectedDecodedSha256:projected,writerAuthorized:false,editedCopyAuthorized:false});
function setup(patch={},factory=createSteam626Comp03SpatialTransport,{missing=false,previewPatch={}}={}){
 let active=true, rev=0;const calls=[];
 const w={
  preview_steam626_comp03(...a){calls.push(['preview',...a]);return JSON.stringify({...preview,...previewPatch})},
  preview_steam626_comp03_spatial(...a){calls.push(['spatial',...a]);return JSON.stringify({...spatial(),...patch})},
  stage_steam626_comp03(...a){calls.push(['stage',...a]);return JSON.stringify({...env,contract:preview.contract,revision:++rev,indexGeneration:rev+1,stagedDecodedSha256:projected,operationCount:9,exactFieldChangedCount:9,applied:true,writerAuthorized:false,originalOverwriteAuthorized:false})},
  toggle_scoped_edit(){throw Error('not used')},begin_scoped_edit_output(){throw Error('not used')},next_scoped_edit_output_chunk(){throw Error('not used')},
  preview_steam626_vase_add(){throw Error('not used')},stage_steam626_vase_add(){throw Error('not used')}
 };
 if(missing)delete w.preview_steam626_comp03_spatial;
 const t=factory(w,initial,identity,{parse:JSON.parse,current:()=>active,revoke:()=>{active=false},maxBytes:4096,chunkBytes:8});
 return {t,calls,active:()=>active,close:()=>{active=false}};
}
test('COMP03 companion binds current private Preview and returns only immutable presentation anchors',()=>{
 const s=setup();const p=s.t.previewTarget({seedId:500});
 assert.equal(p.projectedDecodedSha256,undefined);assert.equal(p.sessionId,undefined);
 const r=s.t.spatialPreview();assert.deepEqual(s.calls[1],['spatial',500,projected,id,0n,1n,original]);
 assert.deepEqual(r.anchors,anchors());assert(Object.isFrozen(r));assert(Object.isFrozen(r.anchors));assert(r.anchors.every(Object.isFrozen));
 assert.deepEqual(Object.keys(r).sort(),['anchors','editedCopyAuthorized','gridId','nextObjectId','rootSceneItemId','seedId','writerAuthorized'].sort());
 assert.equal(r.writerAuthorized,false);assert.equal(r.editedCopyAuthorized,false);
 assert.equal(s.t.stage().applied,true);assert.deepEqual(s.calls[2],['stage',500,90001,510,30,h('c'),h('d'),h('e'),projected,id,0n,1n,original]);
 assert.throws(()=>s.t.spatialPreview());assert.equal(s.active(),false);
});
test('COMP03 companion never auto-enables on legacy or Vase and fails closed before Preview/after close',()=>{
 for(const f of [createSteam626Comp03Transport,createSteam626VaseAddTransport]){
  const s=setup({},f);assert.equal(s.t.spatialPreview,undefined);
  assert.equal(setup({},f,{missing:true}).t.spatialPreview,undefined);
 }
 assert.throws(()=>setup({},createSteam626Comp03SpatialTransport,{missing:true}));
 let s=setup();assert.throws(()=>s.t.spatialPreview());assert.equal(s.calls.length,0);assert.equal(s.active(),false);
 s=setup();s.t.previewTarget({seedId:500});s.close();assert.throws(()=>s.t.spatialPreview());assert.equal(s.calls.length,1);
 s=setup({},createSteam626Comp03SpatialTransport,{previewPatch:{gridId:0}});assert.throws(()=>s.t.previewTarget({seedId:500}));assert.throws(()=>s.t.spatialPreview());assert.equal(s.calls.length,1);
});
test('COMP03 companion rejects forged scope, projection, root, IDs, roles, bounds and authority',()=>{
 const change=(i,p)=>anchors().map((a,j)=>i===j?{...a,...p}:a);
 const cases=[{contract:'wrong'},{rootSceneItemId:1540000153},{gridId:90002},{seedId:501},{nextObjectId:511},
 {sessionId:'c'.repeat(32)},{revision:1},{indexGeneration:2},{decodedSha256:h('d')},{projectedDecodedSha256:h('a')},
 {writerAuthorized:true},{editedCopyAuthorized:true},{unexpected:1},{anchors:anchors().slice(1)},{anchors:[...anchors(),anchors()[0]]},
 {anchors:change(1,{objectId:500})},{anchors:change(2,{objectId:512})},{anchors:change(0,{role:'proposed'})},
 {anchors:change(1,{role:'retained'})},{anchors:change(1,{x:12,y:16})},{anchors:change(1,{x:261})},
 {anchors:change(1,{y:-1})},{anchors:change(1,{x:'16'})},{anchors:change(1,{x:16.5})},{anchors:change(1,{writerAuthorized:true})}];
 for(const patch of cases){
  const s=setup(patch);s.t.previewTarget({seedId:500});assert.throws(()=>s.t.spatialPreview());assert.equal(s.active(),false);
  assert.throws(()=>s.t.stage());assert.equal(s.calls.filter(a=>a[0]==='stage').length,0);
 }
});
test('COMP03 companion uses latest successful Preview and does not synthesize coordinates',()=>{
 const s=setup({anchors:anchors().map((a,i)=>i===1?{...a,x:17}:a)});
 s.t.previewTarget({seedId:500});s.t.previewTarget({seedId:500});const r=s.t.spatialPreview();
 assert.equal(r.anchors[1].x,17);assert.equal(s.calls.filter(a=>a[0]==='preview').length,2);
});
