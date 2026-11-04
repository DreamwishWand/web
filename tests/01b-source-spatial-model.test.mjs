import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSourceSpatialScene, sourceToScreen, screenToSource,
 hitTestSource, selectHitCandidate, previewSourceTransform } from '../src/lib/wep/source-spatial-model.ts';
const sha='75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa';
const rect=(w,h)=>Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w)}));
const obj=(g,id,x,y,patch={})=>({editorId:`g${g}:o${id}`,itemId:40000001,layer:'furniture',x,y,orientation:0,footprint:rect(2,1),
 source:{gridId:g,gridObjectId:id,objectMapKey:String(id),relation:'ROOT',parentAddress:null},portableState:null,dependencyIds:[],editability:'editable',metadata:{stateKind:'NONE',footprintMode:'ORIENTED_BOUNDING_RECT'},...patch});
const fixture=()=>({schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{gameVersion:'1.25.0',platform:'Nintendo Switch',contractBuildIdentity:'52BD625D9B4E0053',profileSchemaVersion:624,persistentWriteAuthorized:false,rootGridId:42,gridDataPath:'World/A',tessellationFactor:2},
 metadata:{directRootProjection:{evidenceStatus:'CONFIRMED',boundsAuthority:{sha256:sha}},rootGridBounds:{x:0,y:0,w:40,h:32,status:'AUTHORITATIVE_GRIDDATAPATH'},subGridHierarchy:[]},
 networks:{roads:null,fences:null},capabilities:{},objects:[obj(42,7,2,3),obj(42,8,8,3)]});
const project=d=>projectSourceSpatialScene(d,'source:rev:1');
test('source x/y <-> 2D coordinates is reversible with zoom and pan',()=>{
 const c={gridId:42,cellPixels:16,panX:-3,panY:5};
 assert.deepEqual(sourceToScreen({x:12.25,y:10.5},c),{x:244,y:88});
 assert.deepEqual(screenToSource({x:244,y:88},c),{x:12.25,y:10.5});
 assert.throws(()=>sourceToScreen({x:0,y:0},{...c,cellPixels:0}),/SCALE_INVALID/);
});
test('project, hit, selection and preview preserve SAME raw GridObject identity',()=>{
 const d=fixture(),s=project(d),c={gridId:42,cellPixels:20,panX:0,panY:0};
 const hit=hitTestSource(s,{x:45,y:65},c);
 assert.equal(hit.ambiguous,false);assert.equal(hit.candidates.length,1);
 const selected=selectHitCandidate(s,hit,'g42:o7','source:rev:1');
 assert.deepEqual(selected.address,{gridId:42,gridObjectId:7,objectMapKey:'7'});
 const prior=JSON.stringify(s);
 const move=previewSourceTransform(s,selected.editorId,'source:rev:1',{dx:2,dy:1});
 assert.equal(move.editorId,selected.editorId);assert.deepEqual(move.address,selected.address);
 assert.equal(move.after.x,4);assert.equal(move.after.y,4);
 assert.equal(move.persistentWriteAuthorized,false);assert.equal(move.nativePlacementVerified,false);
 assert.equal(JSON.stringify(s),prior,'Preview never mutates source scene');
});
test('quarter turn footprint is 2x1 -> 1x2; native Orientation advances by 4, never Writer',()=>{
 const s=project(fixture());const r=previewSourceTransform(s,'g42:o7','source:rev:1',{dx:0,dy:0,quarterTurns:1});
 assert.deepEqual(r.footprint,[{x:0,y:0},{x:0,y:1}]);assert.equal(r.after.orientation,4);
 assert.equal(r.status,'SCHEMATIC_ONLY');
 assert.throws(()=>previewSourceTransform(s,'g42:o7','source:rev:1',{dx:0,dy:0,quarterTurns:4}),/ROTATE_TURNS_INVALID/);
});
test('duplicate GridObject ID and map key mismatch are rejected',()=>{
 const d=fixture();d.objects.push(obj(42,7,3,3));assert.throws(()=>project(d),/DUPLICATE_SOURCE_ID/);
 const x=fixture();x.objects[0].source.objectMapKey='8';assert.throws(()=>project(x),/SOURCE_ADDRESS_INVALID/);
 const y=fixture();y.objects[0].editorId='independent-uuid';assert.throws(()=>project(y),/EDITOR_ID_NOT_SOURCE_ADDRESS/);
});
test('Grid mismatch fails and deliberate cross-version geometry reuse is denied',()=>{
 const d=fixture();d.objects[0].source.gridId=99;assert.throws(()=>project(d),/GRID_ID_MISMATCH/);
 const x=fixture();x.target.profileSchemaVersion=626;x.target.gameVersion='1.25.3';assert.throws(()=>project(x),/SOURCE_BUILD_UNSUPPORTED/);
});
test('footprint duplicates, out-of-bounds and unknown geometry are blocked',()=>{
 const a=fixture();a.objects[0].footprint=[{x:0,y:0},{x:0,y:0}];assert.throws(()=>project(a),/FOOTPRINT_DUPLICATE_CELL/);
 const b=fixture();b.objects[0].x=39;assert.throws(()=>project(b),/FOOTPRINT_OUT_OF_GRID/);
 const c=fixture();c.objects[0].metadata.footprintMode='UNKNOWN';assert.throws(()=>previewSourceTransform(project(c),'g42:o7','source:rev:1',{dx:1,dy:0}),/FOOTPRINT_UNVERIFIED/);
});
test('overlap must return both identities, never invent native z-order',()=>{
 const d=fixture();d.objects[1].x=2;const s=project(d);const hit=hitTestSource(s,{x:2.5,y:3.5},{gridId:42,cellPixels:1,panX:0,panY:0});
 assert.equal(hit.ambiguous,true);assert.deepEqual(hit.candidates.map(x=>x.editorId),['g42:o7','g42:o8']);assert.equal(hit.selected,null);
 assert.throws(()=>previewSourceTransform(s,'g42:o7','source:rev:1',{dx:1,dy:0}),/OCCUPANCY_COLLISION/);
});
test('source revision change denies hit selection and preview',()=>{
 const s=project(fixture()),hit=hitTestSource(s,{x:2.5,y:3.5},{gridId:42,cellPixels:1,panX:0,panY:0});
 assert.throws(()=>selectHitCandidate(s,hit,'g42:o7','source:rev:2'),/STALE_VIEW_REVISION/);
 assert.throws(()=>previewSourceTransform(s,'g42:o7','source:rev:2',{dx:1,dy:0}),/STALE_VIEW_REVISION/);
});
function subgridFixture(){const d=fixture();const p=obj(42,9,12,3,{metadata:{stateKind:'SubGrid',rawState:{SubGrid:{GridID:99}},footprintMode:'ORIENTED_BOUNDING_RECT'}});
 d.objects.push(p);const parent={gridId:42,gridObjectId:9,objectMapKey:'9'};
 const child=obj(99,1,1,1,{source:{gridId:99,gridObjectId:1,objectMapKey:'1',relation:'SUBGRID_CHILD',parentAddress:parent}});
 d.metadata.subGridHierarchy=[{gridId:99,gridDataPath:'Child/99',tessellationFactor:1,bounds:{x:0,y:0,w:16,h:16,status:'AUTHORITATIVE_GRIDDATAPATH'},dimensionSourceSha256:'sample-source-digest',parentAddress:parent,objects:[child],children:[]}];return d;}
test('SubGrid child identity and parent address survive; child coordinates are Grid-local and preview blocked',()=>{
 const s=project(subgridFixture());const child=s.nodes.find(x=>x.editorId==='g99:o1');
 assert.equal(child.relation,'SUBGRID_CHILD');assert.equal(child.parentAddress.gridObjectId,9);
 assert.equal(hitTestSource(s,{x:1.5,y:1.5},{gridId:99,cellPixels:1,panX:0,panY:0}).candidates[0].editorId,child.editorId);
 assert.throws(()=>previewSourceTransform(s,child.editorId,'source:rev:1',{dx:1,dy:0}),/ROOT_ONLY/);
});
test('SubGrid parent reference, cross-grid ancestry and cycles fail-closed',()=>{
 const d=subgridFixture();d.metadata.subGridHierarchy[0].parentAddress={gridId:42,gridObjectId:8,objectMapKey:'8'};d.metadata.subGridHierarchy[0].objects[0].source.parentAddress={gridId:42,gridObjectId:8,objectMapKey:'8'};
 assert.throws(()=>project(d),/PARENT_NOT_OBJECT/);
 const x=subgridFixture();x.metadata.subGridHierarchy[0].objects[0].source.parentAddress={gridId:42,gridObjectId:8,objectMapKey:'8'};
 assert.throws(()=>project(x),/PARENT_ADDRESS_MISMATCH/);
 const z=subgridFixture();z.metadata.subGridHierarchy[0].children=[{...z.metadata.subGridHierarchy[0],gridId:99}];
 assert.throws(()=>project(z),/CYCLE_OR_DUPLICATE/);
});
test('Building/Road/Fence and unknown state never get source Transform Preview',()=>{
 for (const layer of ['building','road','fence','static']){const d=fixture();d.objects[0].layer=layer;
 assert.throws(()=>previewSourceTransform(project(d),'g42:o7','source:rev:1',{dx:1,dy:0}),/ROOT_ONLY/);}
 const d=fixture();d.objects[0].metadata.stateKind='UNKNOWN';assert.throws(()=>previewSourceTransform(project(d),'g42:o7','source:rev:1',{dx:1,dy:0}),/ROOT_ONLY/);
});
test('invalid caller camera and selection target cannot fabricate source identity',()=>{
 const s=project(fixture());assert.throws(()=>hitTestSource(s,{x:1,y:2},{gridId:999,cellPixels:1,panX:0,panY:0}),/GRID_NOT_IN_SCENE/);
 const hit=hitTestSource(s,{x:2.5,y:3.5},{gridId:42,cellPixels:1,panX:0,panY:0});
 assert.throws(()=>selectHitCandidate(s,hit,'g42:o8','source:rev:1'),/HIT_CANDIDATE_REQUIRED/);
});

test('hit from prior Save/scene cannot select same GridObject ID in a reopened scene',()=>{
 const first=project(fixture());const hit=hitTestSource(first,{x:2.5,y:3.5},{gridId:42,cellPixels:1,panX:0,panY:0});
 const fresh=project(fixture());
 assert.throws(()=>selectHitCandidate(fresh,hit,'g42:o7','source:rev:1'),/HIT_SCENE_STALE_OR_FORGED/);
 const forged={...hit};assert.throws(()=>selectHitCandidate(first,forged,'g42:o7','source:rev:1'),/HIT_SCENE_STALE_OR_FORGED/);
});
test('external source BID conflicting with projected v1.25.0 contract is denied',()=>{
 const d=fixture();d.target.sourceBuildIdentity='9A239D3DB569756D';d.target.exactBuildKnown=false;
 assert.throws(()=>project(d),/ACTUAL_SOURCE_BID_MISMATCH/);
 const e=fixture();e.target.exactBuildKnown=true;assert.throws(()=>project(e),/EXACT_BID_ATTESTATION_MISSING/);
});
