import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localSceneReadonlyMapFromDraft,localSceneReadonlyMapCopy,
  LOCAL_SCENE_MAP_LOCALES,LOCAL_SCENE_MAP_MAX_CELLS}
 from '../src/lib/presets/local-scene-readonly-map.mjs';

const item=(itemId=40000047,x=0,y=0,footprint=[{x:0,y:0}])=>({
 artifactObjectId:'o'+itemId,itemId,layer:'furniture',x,y,orientation:0,
 footprint,dependencyIds:[],editability:'readonly',source:null,nativeGridObjectId:null
});
const draft=()=>({
 operation:'WEP_LOCAL_SCENE_REUSE_DETACHED_READONLY_DRAFT@1',
 localOnly:true,detachedFromEditorSession:true,inventoryVerified:false,
 nativePlacementAuthorized:false,editorMutationAuthorized:false,
 writeReady:false,applyReady:false,bounds:{w:7,h:5},
 objects:[item(40000047,1,1,[{x:0,y:0},{x:1,y:0},{x:0,y:1}]),
          item(40000048,5,3)]
});
test('verified detached local Scene has bounded exact-cell 2D projection without Native identity',()=>{
 const out=localSceneReadonlyMapFromDraft(draft());
 assert.equal(out.readOnly,true);
 assert.equal(out.nativeApplyAuthorized,false);
 assert.deepEqual([out.width,out.height,out.objectCount],[7,5,2]);
 assert.deepEqual(out.cells.map(x=>[x.x,x.y,x.itemId]),
  [[1,1,40000047],[2,1,40000047],[1,2,40000047],[5,3,40000048]]);
 assert.deepEqual([...out.itemIds],[40000047,40000048]);
 assert.equal(Object.isFrozen(out),true);
 assert.equal(Object.isFrozen(out.cells),true);
 assert.ok(out.cells.every(c=>Object.isFrozen(c)));
 assert.equal(Object.hasOwn(out,'gridId'),false);
 assert.equal(Object.hasOwn(out,'nativeObjectId'),false);
 assert.equal(Object.hasOwn(out,'saveBytes'),false);
});
test('forged write authority, unsupported geometry, overflow and missing 02WEP denial are failclosed',()=>{
 for(const broken of [
  {writeReady:true},{applyReady:true},{localOnly:false},{detachedFromEditorSession:false},
  {inventoryVerified:true},{nativePlacementAuthorized:true},{editorMutationAuthorized:true},
  {operation:'WEP_LOCAL_SCENE_REUSE_WRITER@1'},
  {bounds:{w:0,h:5}},{bounds:{w:4097,h:5}},{bounds:{w:7,h:4097}},
  {objects:[{...item(),x:7}]},
  {objects:[{...item(),footprint:[{x:-1,y:0}]}]},
  {objects:[{...item(),footprint:[{x:1.5,y:0}]}]},
  {objects:[{...item(),nativeGridObjectId:123}]},
  {objects:[{...item(),editability:'editable'}]},
  {objects:[{...item(),layer:'road'}]},
  {objects:[{...item(),itemId:0}]},
  {objects:[item(40000047),item(40000047)]},
  {objects:[]},
  {objects:Array.from({length:LOCAL_SCENE_MAP_MAX_CELLS+1},(_,n)=>item(40000047+n))}
 ]){
  assert.equal(localSceneReadonlyMapFromDraft({...draft(),...broken}),null,JSON.stringify(broken).slice(0,170));
 }
 assert.equal(localSceneReadonlyMapFromDraft(null),null);
 assert.equal(localSceneReadonlyMapFromDraft({}),null);
});
test('exact 8 locale map notices never imply game Apply; Svelte only renders after explicit Scene verification',()=>{
 assert.deepEqual([...LOCAL_SCENE_MAP_LOCALES],
   ['en','ja','fr','it','de','es-ES','zh-CN','pt-BR']);
 for(const loc of LOCAL_SCENE_MAP_LOCALES){
  const copy=localSceneReadonlyMapCopy(loc);
  for(const k of ['title','notice','itemId','cells'])
   assert.ok(typeof copy[k]==='string'&&copy[k].trim().length>2,loc+'/'+k);
 }
 const route=readFileSync(new URL('../src/routes/presets/+page.svelte',import.meta.url),'utf8');
 assert.match(route,/const current=await readLocalSceneById\(id\)/);
 assert.match(route,/current\.revision!==deviceScenesRevision/);
 assert.match(route,/const readiness=preflightScene\(current\.entry\.artifact\)/);
 assert.match(route,/const draft=buildReadonlyLocalSceneReuseDraft\(/);
 assert.match(route,/deviceSceneMap=localSceneReadonlyMapFromDraft\(draft\)/);
 assert.match(route,/data-device-scene-readonly-map/);
 assert.match(route,/data-device-scene-map-apply="off"/);
 assert.match(route,/data-device-scene-map-ownership="unknown"/);
 assert.match(route,/\{#if deviceSceneMap\}/);
 assert.match(route,/data-scene-write-ready="false"/);
 assert.doesNotMatch(route,/nativeGridObjectId:|applyNativeScene|saveToGame|writeLocalScene/);
});
