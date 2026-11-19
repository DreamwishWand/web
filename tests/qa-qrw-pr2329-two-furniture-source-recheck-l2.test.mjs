// Independent 04 QR-W changed-only L2 for 02 WEP PR2329.
// Bounded local Save-free Scene ONLY; never real Save, inventory ownership,
// native Grid, approved spatial writer, cloud or auto-apply.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCollectionRuntime} from '../src/lib/collection/runtime.js';
import {buildSharedCatalogDirectory} from '../src/lib/entity/shared-catalog-directory.mjs';
import {createSwitchWorldReadAdapter} from '../src/lib/wep/world-browser-adapter.ts';
import {
 buildSaveFreeTwoFurnitureScene,buildSaveFreeFirstNonemptyScene,
 WEP_SAVEFREE_TWO_FURNITURE_LOCAL_SCENE_OPERATION
} from '../src/lib/wep/savefree-first-scene.ts';
import {preflightScene,validatePublishablePreset} from '../src/lib/wep/scene-preset-runtime.ts';
import {buildReadonlyLocalSceneReuseDraft} from '../src/lib/wep/local-scene-reuse-readonly.ts';

const root=new URL('../',import.meta.url);
const localFetch=async url=>{
 const path=new URL(String(url),'https://wand.invalid').pathname;
 return new Response(await readFile(new URL('./static'+path,root)),{status:200});
};
const [catalog,binding]=await Promise.all([
 loadCollectionRuntime('',localFetch),
 createSwitchWorldReadAdapter({basePath:'',fetchImpl:localFetch})
]);
const directory=buildSharedCatalogDirectory(catalog.index,catalog.rows,'en');
const target=40000047,base={directory,binding,firstItemId:target,secondItemId:target,
 secondX:3,secondY:0,title:'User-chosen second verified furniture'};
const build=(changes={})=>buildSaveFreeTwoFurnitureScene({...base,...changes});
const refusal=(c)=>assert.throws(()=>build(c),/WEP_SAVEFREE_SCENE_/);

test('actual signed Catalog and geometry produce 12 disjoint occupied grid cells without overclaiming any Save identity',()=>{
 const scene=build(),a=scene.artifact;
 assert.equal(scene.operation,WEP_SAVEFREE_TWO_FURNITURE_LOCAL_SCENE_OPERATION);
 assert.deepEqual(a.bounds,{w:6,h:2});
 assert.equal(a.objects.length,2);
 assert.equal(a.requirements.itemQuantities[String(target)],2);
 const coordinates=[];
 for(const item of a.objects){
  assert.equal(item.itemId,target);
  assert.equal(item.footprint.length,6);
  assert.equal(item.orientation,0);
  assert.equal(item.portableState,null);
  assert.equal(item.dependencyIds?.length??0,0);
  for(const cell of item.footprint)coordinates.push((item.localX+cell.x)+','+(item.localY+cell.y));
 }
 assert.equal(coordinates.length,12);
 assert.equal(new Set(coordinates).size,12);
 assert.equal(Math.min(...a.objects.map(o=>o.localX)),0);
 assert.equal(Math.max(...a.objects.map(o=>o.localX)),3);
 assert.equal(a.source.platform,'synthetic');
 assert.equal(a.networks.roads,null);assert.equal(a.networks.fences,null);
 assert.equal(a.requirements.roadTopology,false);
 assert.equal(a.requirements.fenceTopology,false);
 assert.equal(validatePublishablePreset(a).ok,true);
 assert.equal(preflightScene(a).writeReady,false);
 assert.equal(scene.localOnly,true);assert.equal(scene.inventoryVerified,false);
 assert.equal(scene.editorSessionCreated,false);assert.equal(scene.nativePlacementAuthorized,false);
 assert.equal(scene.writeReady,false);assert.equal(scene.applyReady,false);
 assert.equal('saveBytes' in a,false);assert.equal('nativeGridId' in a,false);
});
test('two verified furniture can be stacked on disjoint y-cells and first-item only remains original single object',()=>{
 const onY=build({secondX:0,secondY:2});
 assert.deepEqual(onY.artifact.bounds,{w:3,h:4});
 assert.deepEqual(onY.artifact.objects.map(o=>[o.localX,o.localY]),[[0,0],[0,2]]);
 const once=buildSaveFreeFirstNonemptyScene({directory,binding,itemId:target,title:base.title});
 assert.equal(once.artifact.objects.length,1);
 assert.deepEqual(once.artifact.bounds,{w:3,h:2});
 assert.equal(once.writeReady,false);
 assert.equal(onY.artifact.requirements.itemQuantities[String(target)],2);
 assert.equal(once.artifact.requirements.itemQuantities[String(target)],1);
});
test('no noninteger, NaN, infinity, negative, border-crossing or overlapping coordinates can be captured',()=>{
 const cases=[
  {secondX:0,secondY:0},{secondX:2,secondY:1},
  {secondX:2,secondY:0},{secondX:1,secondY:1},
  {secondX:NaN},{secondY:NaN},{secondX:Infinity},
  {secondY:-Infinity},{secondX:'3'},{secondY:'0'},
  {secondX:1.1},{secondY:2.5},{secondX:-1},
  {secondY:-1},{secondX:63},{secondY:63},
  {secondX:Number.MAX_SAFE_INTEGER},{secondY:2147483648}
 ];
 for(const c of cases)refusal(c);
});
test('cross-Build, forged read provenance, duplicate catalogue and invalid scope must deny before any local Scene authority',()=>{
 for(const directoryVariant of [
  {...directory,source:{...directory.source,buildID:'UNVERIFIED'}},
  {...directory,source:{...directory.source,gameVersion:'1.25.3'}},
  {...directory,status:'UNKNOWN'},
  {...directory,entries:directory.entries.filter(x=>x.itemId!==target)},
  {...directory,entries:[...directory.entries,...directory.entries.filter(x=>x.itemId===target)]},
  {...directory,entries:directory.entries.map(x=>x.itemId===target?{...x,family:'Clothing'}:x)}
 ]) refusal({directory:directoryVariant});
 for(const bindingVariant of [
  {...binding,source:{...binding.source,profileSchemaVersion:626}},
  {...binding,provenance:{...binding.provenance,readDataBuildID:'UNVERIFIED'}},
  {...binding,provenance:{...binding.provenance,readDataSha256:'0'.repeat(64)}},
  {...binding,provenance:{...binding.provenance,gridDataDimensionsSha256:'0'.repeat(64)}}
 ]) refusal({binding:bindingVariant});
});
test('malicious geometry policy or a stale replaced second-item source cannot be used to bypass trusted footprints',()=>{
 for(const mutator of [
  cap=>({...cap,productApplyAuthorized:true}),
  cap=>({...cap,persistentWriteAuthorized:true}),
  cap=>({...cap,verifiedReplacementExportSupported:true}),
  cap=>({...cap,canonicalIdentity:{...cap.canonicalIdentity,itemId:target+1}}),
  cap=>({...cap,footprintSize:{w:1,h:1}}),
  cap=>({...cap,footprint:[...cap.footprint.slice(1),cap.footprint[1]]}),
  cap=>({...cap,reasons:['UNKNOWN_NATIVE_PERMISSION']}),
  cap=>({...cap,orientation:1}),
  cap=>({...cap,status:'UNKNOWN'})
 ]){
  let invoked=0;
  const guarded={...binding,resolveDraftPlacementSource:(id,scale)=>{
   const cap=binding.resolveDraftPlacementSource(id,scale);
   invoked++;
   return invoked===2?mutator(cap):cap;
  }};
  refusal({binding:guarded});
  assert.equal(invoked,2,'second item geometry must be re-read, not inferred from cached first footprint');
 }
});
test('every preflight output remains detached read-only and cannot mint an Editor mutation after explicit local reuse',()=>{
 const scene=build();
 const draft=buildReadonlyLocalSceneReuseDraft({
  sceneId:'scene_11111111-1111-4111-8111-111111111111',
  sourceRevision:1,artifact:scene.artifact
 });
 assert.deepEqual(draft.bounds,{w:6,h:2});
 assert.equal(draft.objects.length,2);
 assert.equal(draft.nativePlacementAuthorized,false);
 assert.equal(draft.editorMutationAuthorized,false);
 assert.equal(draft.writeReady,false);
 assert.equal(draft.applyReady,false);
 assert.equal(draft.sourceRevision,1);
 assert.equal(scene.artifact.networks.roads,null);
 assert.equal(scene.artifact.networks.fences,null);
});
