// 04 QR W-QR-030: independently exercise ONLY new PR386 typed Spatial Contract.
// Does NOT rerun accepted PR382/QA387 2D Chromium/UI or native Save/Writer tests.
// Repo-shaped synthetic structural fixtures, Switch v1.25.0 schema624 only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSourceSpatialScene, sourceToScreen, screenToSource,
 hitTestSource, selectHitCandidate, previewSourceTransform, SPATIAL_SOURCE }
 from '../src/lib/wep/source-spatial-model.ts';

const DIM='75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa';
const rectangle=()=>[{x:0,y:0},{x:1,y:0}];
const address=(gridId,gridObjectId)=>({gridId,gridObjectId,objectMapKey:String(gridObjectId)});
const node=(gridId,id,x,y,more={})=>({
 editorId:`g${gridId}:o${id}`,itemId:40000047,layer:'furniture',x,y,orientation:0,
 footprint:rectangle(),source:{...address(gridId,id),relation:'ROOT',parentAddress:null},
 portableState:null,dependencyIds:[],editability:'editable',
 metadata:{stateKind:'NONE',footprintMode:'ORIENTED_BOUNDING_RECT'},...more
});
function fixture(){
 return {
   schema:'dreamwish-wand-wep-editor-document',version:1,
   target:{platform:'Nintendo Switch',gameVersion:'1.25.0',
     contractBuildIdentity:'52BD625D9B4E0053',profileSchemaVersion:624,
     persistentWriteAuthorized:false,rootGridId:73,gridDataPath:'Root/73',tessellationFactor:1},
   metadata:{directRootProjection:{evidenceStatus:'CONFIRMED',boundsAuthority:{sha256:DIM}},
     rootGridBounds:{x:0,y:0,w:40,h:30,status:'AUTHORITATIVE_GRIDDATAPATH'},
     subGridHierarchy:[]},
   networks:{roads:null,fences:null},capabilities:{},
   objects:[node(73,101,2,3),node(73,102,9,3)]
 };
}
const project=(d,rev='qa-rev-10')=>projectSourceSpatialScene(d,rev);
function attachChild(d,parentId,childGridId=905){
 d.objects.push(node(73,parentId,13,3,{metadata:{
   stateKind:'SubGrid',footprintMode:'ORIENTED_BOUNDING_RECT',
   rawState:{SubGrid:{GridID:childGridId}}}}));
 const parent=address(73,parentId);
 const child=node(childGridId,7,4,5,{source:{...address(childGridId,7),relation:'SUBGRID_CHILD',parentAddress:parent}});
 const grid={gridId:childGridId,parentAddress:parent,gridDataPath:'Child/'+childGridId,
  tessellationFactor:1,
  bounds:{x:0,y:0,w:20,h:18,status:'AUTHORITATIVE_GRIDDATAPATH'},
  dimensionSourceSha256:'verified-structure-only',
  objects:[child],children:[]};
 d.metadata.subGridHierarchy.push(grid);
 return grid;
}
test('source address, mapKey, GridID and schema624 identity preserved through hit/selection/schematic Move',()=>{
 const d=fixture(),before=JSON.stringify(d),s=project(d);
 assert.deepEqual(SPATIAL_SOURCE,{platform:'Nintendo Switch',gameVersion:'1.25.0',
   bid:'52BD625D9B4E0053',schema:624,gridDataDimensionsSha256:DIM});
 assert.equal(s.persistentWriteAuthorized,false);
 assert.equal(s.productApplyAuthorized,false);
 assert.equal(s.directSourceReplacementAuthorized,false);
 const cam={gridId:73,cellPixels:32,panX:-2,panY:2};
 const p={x:2.25,y:3.5};
 const px=sourceToScreen(p,cam);
 assert.deepEqual(screenToSource(px,cam),p);
 const hit=hitTestSource(s,px,cam);
 assert.equal(hit.ambiguous,false);
 assert.deepEqual(hit.candidates.map(o=>o.editorId),['g73:o101']);
 const selected=selectHitCandidate(s,hit,'g73:o101','qa-rev-10');
 assert.deepEqual(selected.address,address(73,101));
 assert.equal(selected.editorId,'g73:o101');
 const result=previewSourceTransform(s,selected.editorId,'qa-rev-10',{dx:2,dy:1});
 assert.deepEqual(result.address,address(73,101));
 assert.deepEqual(result.after,{x:4,y:4,orientation:0});
 assert.equal(result.status,'SCHEMATIC_ONLY');
 assert.equal(result.nativePlacementVerified,false);
 assert.equal(result.persistentWriteAuthorized,false);
 assert.equal(JSON.stringify(d),before);
 console.log('QR_386_TYPED_ID_GRID_MAPKEY_HIT_MOVE_IMMUTABLE_INPUT_PASS');
});
test('fresh v1.25.3/schema626 and conflicting actual BID fail closed independently of UI',()=>{
 for(const mutate of [
   d=>{d.target.gameVersion='1.25.3';d.target.profileSchemaVersion=626;},
   d=>{d.target.sourceBuildIdentity='9A239D3DB569756D';},
   d=>{d.target.exactBuildKnown=true;},
   d=>{d.target.persistentWriteAuthorized=true;},
   d=>{d.objects[0].source.objectMapKey='102';},
   d=>{d.objects[0].source.gridId=905;},
   d=>{d.objects[0].editorId='not-canonical';},
   d=>{d.objects[0].x=39;},
 ]){const d=fixture();mutate(d);assert.throws(()=>project(d),/SPATIAL_/);}
 console.log('QR_386_VERSION_SCHEMA_BID_GRID_MAPKEY_BOUNDS_FAILCLOSED_PASS');
});
test('valid child Grid is local only; never permit schematic Move, parent native GridID binding preserved',()=>{
 const d=fixture(),child=attachChild(d,120),s=project(d);
 const n=s.nodes.find(x=>x.editorId==='g905:o7');
 assert.equal(n.relation,'SUBGRID_CHILD');
 assert.deepEqual(n.parentAddress,address(73,120));
 const hit=hitTestSource(s,{x:4.5,y:5.5},{gridId:905,cellPixels:1,panX:0,panY:0});
 assert.equal(selectHitCandidate(s,hit,n.editorId,'qa-rev-10').editorId,n.editorId);
 assert.throws(()=>previewSourceTransform(s,n.editorId,'qa-rev-10',{dx:1,dy:0}),/SPATIAL_TRANSFORM_PREVIEW_ROOT_ONLY/);
 assert.throws(()=>selectHitCandidate(project(d,'qa-rev-11'),hit,n.editorId,'qa-rev-11'),/SPATIAL_HIT_SCENE_STALE_OR_FORGED/);
 console.log('QR_386_CHILD_GRID_LOCAL_SELECTION_NATIVE_PARENT_NO_WRITER_PASS');
});
test('overlap returns candidates, stale revision/foreign Scene rejects, collision and out-of-grid preview denied',()=>{
 const d=fixture();d.objects[1].x=2;
 const s=project(d),cam={gridId:73,cellPixels:1,panX:0,panY:0};
 const hit=hitTestSource(s,{x:2.5,y:3.5},cam);
 assert.equal(hit.ambiguous,true);
 assert.deepEqual(hit.candidates.map(x=>x.editorId),['g73:o101','g73:o102']);
 assert.throws(()=>selectHitCandidate(s,hit,'g73:o101','qa-rev-11'),/SPATIAL_STALE_VIEW_REVISION/);
 assert.throws(()=>previewSourceTransform(s,'g73:o101','qa-rev-10',{dx:1,dy:0}),/SPATIAL_PREVIEW_OCCUPANCY_COLLISION/);
 const out=project(fixture());
 assert.throws(()=>previewSourceTransform(out,'g73:o101','qa-rev-10',{dx:-10,dy:0}),/SPATIAL_PREVIEW_OUT_OF_BOUNDS/);
 console.log('QR_386_OVERLAP_STALE_AND_COLLISION_NEGATIVES_PASS');
});
test('SECURITY_NEGATIVE: mutated genuine hit cannot select an object outside original hit cell',()=>{
 const s=project(fixture()),cam={gridId:73,cellPixels:1,panX:0,panY:0};
 const hit=hitTestSource(s,{x:2.5,y:3.5},cam);
 assert.deepEqual(hit.candidates.map(x=>x.editorId),['g73:o101']);
 // An actual hit handle can be mutated by a caller after the WeakMap binds it.
 // If the hit candidate list is mutable, the WeakMap itself cannot prove cell membership.
 assert.throws(()=>hit.candidates.push(s.nodes.find(x=>x.editorId==='g73:o102')),TypeError,
   'genuine hit candidates must be immutable; otherwise caller can forge selected ObjectID');
 assert.throws(()=>selectHitCandidate(s,hit,'g73:o102','qa-rev-10'),/SPATIAL_HIT_CANDIDATE_REQUIRED/);
 console.log('QR_386_MUTATED_HIT_CANDIDATE_FORGERY_DENIED_PASS');
});
test('HIERARCHY_NEGATIVE: child of Grid905 cannot reference root-only parent of Grid906',()=>{
 const d=fixture();
 const grid905=attachChild(d,120,905);
 // Root parent 121 genuinely owns Grid906, BUT Grid906 is now nested under
 // Grid905 in hierarchy: immediate parent grid mismatch must be rejected.
 d.objects.push(node(73,121,19,3,{metadata:{stateKind:'SubGrid',footprintMode:'ORIENTED_BOUNDING_RECT',
  rawState:{SubGrid:{GridID:906}}}}));
 const wrongParent=address(73,121);
 grid905.children.push({gridId:906,parentAddress:wrongParent,
   gridDataPath:'Nested/906',tessellationFactor:1,
   bounds:{x:0,y:0,w:12,h:12,status:'AUTHORITATIVE_GRIDDATAPATH'},
   dimensionSourceSha256:'synthetic-structure-only',
   objects:[node(906,1,2,2,{source:{...address(906,1),relation:'SUBGRID_CHILD',parentAddress:wrongParent}})],
   children:[]});
 assert.throws(()=>project(d),/SPATIAL_SUBGRID_(PARENT|HIERARCHY|GRID)/,
   'native parent must belong to the immediate containing Grid905, not unrelated root Grid73');
 console.log('QR_386_NESTED_PARENT_GRID_CLOSURE_DENIED_PASS');
});
test('IMMUTABILITY_NEGATIVE: projection result cannot have forged unrelated nodes appended',()=>{
 const scene=project(fixture());
 const forged={...scene.nodes[0],editorId:'g73:o9999',address:address(73,9999)};
 assert.throws(()=>scene.nodes.push(forged),TypeError,
   'Readonly scene nodes must not permit runtime insertion of fabricated native ObjectID');
 assert.equal(scene.nodes.find(x=>x.editorId==='g73:o9999'),undefined);
 console.log('QR_386_SCENE_NODE_RUNTIME_IMMUTABLE_PASS');
});
