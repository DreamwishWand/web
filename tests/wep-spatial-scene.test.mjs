import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorSession } from '../src/lib/wep/editor-runtime.ts';
import { buildSpatialScene, spatialHitTest, spatialSelectedDetails,
  WEP_SPATIAL_SCENE_CONTRACT } from '../src/lib/wep/spatial-scene.ts';
import { SPATIAL_SCENE_LOCALES, spatialSceneCopy } from '../src/lib/wep/spatial-scene-copy.js';

const furniture = (editorId, x, y, patch={}) => ({
  editorId,itemId:40000001,layer:'furniture',x,y,orientation:0,
  footprint:[{x:0,y:0},{x:1,y:0}],source:{rootGridId:42,gridObjectId:editorId},
  portableState:null,dependencyIds:[],editability:'editable',
  metadata:{reasons:[],rootGridId:42},...patch
});
const doc = (objects,target={platform:'switch',rootGridId:42,areaKey:'AREA_A'}) => ({
  schema:'dreamwish-wand-wep-editor-document',version:1,target,
  metadata:{rootGridBounds:{x:0,y:0,w:20,h:12}},
  networks:{roads:null,fences:null},roomFinish:null,capabilities:{},
  objects
});
const scene = d => buildSpatialScene(d,{bounds:d.metadata.rootGridBounds});
test('real-source-shaped Area/Grid scene keeps editorID/native GridObject ID and rotated footprint cell hit test',()=>{
  const d=doc([furniture('object-911',2,2),furniture('object-922',6,2)]);
  const view=scene(d);
  assert.equal(view.contract,WEP_SPATIAL_SCENE_CONTRACT);
  assert.equal(view.objects.length,2);
  assert.deepEqual(view.unresolved,[]);
  assert.equal(view.objects[0].spatial.nativeGridObjectId,'object-911');
  assert.equal(spatialHitTest(view,3.5,2.5)?.editorId,'object-911');
  assert.equal(spatialHitTest(view,6.1,2.1)?.editorId,'object-922');
  assert.equal(spatialHitTest(view,19.9,11.9),null);
  assert.equal(spatialSelectedDetails(view,'object-911')?.rootGridId,'42');
  assert.equal(view.persistentWriteAuthorized,false);
});
test('overlapping footprints use same painter ordering, never unrelated or made-up ObjectID',()=>{
  const d=doc([furniture('bottom',2,2),furniture('top',2,2)]);
  const v=scene(d);
  assert.equal(spatialHitTest(v,2.5,2.5)?.editorId,v.objects.at(-1).editorId);
  assert.equal(spatialHitTest(v,NaN,2),null);
  assert.equal(spatialSelectedDetails(v,'injected-neighbor'),null);
});
test('source Grid mismatch/SubGrid transform or native ObjectID contradiction is unverified, not painted',()=>{
 const base=furniture('valid',2,2);
 const cases=[
  [furniture('bad',5,2,{metadata:{reasons:[],rootGridId:43}}),'SPATIAL_GRID_CONFLICT'],
  [furniture('bad',5,2,{source:{rootGridId:43,gridObjectId:'bad'}}),'SPATIAL_GRID_CONFLICT'],
  [furniture('bad',5,2,{source:{rootGridId:42,parentGridId:42,subGridDataPath:'Sub/child'}}),'SPATIAL_SUBGRID_TRANSFORM_UNPROVEN'],
  [furniture('bad',5,2,{metadata:{rootGridId:42,subGridId:4}}),'SPATIAL_SUBGRID_TRANSFORM_UNPROVEN'],
  [furniture('bad',5,2,{source:{rootGridId:42,gridObjectId:'native1'},metadata:{rootGridId:42,gridObjectId:'native2'}}),'SPATIAL_OBJECT_ID_CONFLICT'],
  [furniture('bad',22,2),'SPATIAL_OUTSIDE_ACTIVE_GRID'],
  [furniture('bad',5,2,{footprint:[{x:0,y:0},{x:1,y:100}]}),'SPATIAL_OUTSIDE_ACTIVE_GRID']
 ];
 for(const [invalid,reason] of cases){
  const d=doc([base,invalid]);const v=scene(d);
  assert.equal(v.objects.length,1,reason);
  assert.equal(v.unresolved.length,1,reason);
  assert.equal(v.unresolved[0].code,reason);
  assert.equal(spatialHitTest(v,invalid.x,invalid.y),null);
  assert.equal(v.persistentWriteAuthorized,false);
 }
});
test('missing root for Switch read-only fails closed; synthetic draft may render without pretending native identity',()=>{
 const native=doc([furniture('native',2,2)],{platform:'switch',areaKey:'AREA_B'});
 assert.equal(scene(native).unresolved[0].code,'SPATIAL_ROOT_GRID_UNPROVEN');
 const d=doc([{...furniture('synthetic',2,2),source:null,metadata:{reasons:[]}}],{platform:'synthetic',areaKey:'test'});
 const v=scene(d);
 assert.equal(v.objects.length,1);
 assert.equal(v.objects[0].spatial.nativeGridObjectId,null);
 assert.equal(v.objects[0].spatial.rootGridId,null);
});
test('single authoritative EditorSession reproject after Move, Rotate, Undo/Redo agrees with draft review diff',()=>{
 const original=doc([furniture('chair',2,2),furniture('lamp',6,2)]);
 const s=createEditorSession(original,{allowInvalidDraft:true});
 s.setSelection(['chair','lamp']);
 const before=scene(s.getDocument());
 assert.equal(s.previewStrictMove(null,1,0,original.metadata.rootGridBounds).ok,true);
 assert.equal(scene(s.getDocument()).objects[0].x,before.objects[0].x);
 const moved=s.move(null,1,0,{strict:true,areaBounds:original.metadata.rootGridBounds});
 assert.equal(moved.applied,true);
 assert.equal(s.getHistoryState().undoDepth,1);
 assert.equal(scene(s.getDocument()).objects[0].x,3);
 assert.equal(s.reviewChanges().changes.find(x=>x.editorId==='chair').after.x,3);
 s.undo();
 assert.equal(scene(s.getDocument()).objects[0].x,2);
 assert.equal(s.reviewChanges().changes.length,0);
 s.redo();
 assert.equal(scene(s.getDocument()).objects[0].x,3);
});
test('scene is layer/search filtered and eight locale control text does not add a writer',()=>{
 const d=doc([furniture('chair',2,2),furniture('lamp',6,2)]);
 assert.equal(buildSpatialScene(d,{query:'object-911'}).objects.length,0);
 assert.equal(SPATIAL_SCENE_LOCALES.length,8);
 for(const locale of SPATIAL_SCENE_LOCALES){
  const c=spatialSceneCopy(locale);
  for(const field of ['zoomIn','zoomOut','fit','panHint','unresolved','changes'])
   assert.ok(c[field].length>1,locale+':'+field);
 }
});
