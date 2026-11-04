// Independent 04 QR changed-RED-only retest on PR386 Source 620eb421...
// Prior QA393 found three exact source-only synthetic Fail-Closed RED.
// Do not rerun accepted PR382 / QA387 / main PR388 or claim Native V3.
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSourceSpatialScene,hitTestSource,selectHitCandidate}
 from '../src/lib/wep/source-spatial-model.ts';
const DIM='75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa';
const address=(gridId,gridObjectId)=>({gridId,gridObjectId,objectMapKey:String(gridObjectId)});
const object=(gridId,id,x,patch={})=>({
 editorId:`g${gridId}:o${id}`,itemId:40000047,layer:'furniture',x,y:3,orientation:0,
 footprint:[{x:0,y:0}],source:{...address(gridId,id),relation:'ROOT',parentAddress:null},
 dependencyIds:[],portableState:null,editability:'editable',metadata:{stateKind:'NONE',footprintMode:'ORIENTED_BOUNDING_RECT'},...patch
});
function fixture(){return {
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{platform:'Nintendo Switch',gameVersion:'1.25.0',contractBuildIdentity:'52BD625D9B4E0053',
 profileSchemaVersion:624,persistentWriteAuthorized:false,rootGridId:73,gridDataPath:'Root/73',tessellationFactor:1},
 metadata:{directRootProjection:{evidenceStatus:'CONFIRMED',boundsAuthority:{sha256:DIM}},
 rootGridBounds:{x:0,y:0,w:40,h:30,status:'AUTHORITATIVE_GRIDDATAPATH'},subGridHierarchy:[]},
 networks:{roads:null,fences:null},capabilities:{},
 objects:[object(73,101,2),object(73,102,10)]
};}
const project=d=>projectSourceSpatialScene(d,'qr-rev');
test('QR393 RED1: real hit handle must reject appended nonhit GridObject candidate',()=>{
 const scene=project(fixture()),camera={gridId:73,cellPixels:1,panX:0,panY:0};
 const hit=hitTestSource(scene,{x:2.5,y:3.5},camera);
 assert.deepEqual(hit.candidates.map(x=>x.editorId),['g73:o101']);
 assert.throws(()=>hit.candidates.push(scene.nodes[1]),TypeError,
  'untrusted caller must not alter source-bound candidate list');
 assert.throws(()=>selectHitCandidate(scene,hit,'g73:o102','qr-rev'),/SPATIAL_HIT_CANDIDATE_REQUIRED/);
 console.log('QR_386_REPAIR_1_NONHIT_CANDIDATE_FORGERY_DENIED_PASS');
});
test('QR393 RED2: forged Scene node cannot appear as imported GridObject under real Hit Test',()=>{
 const scene=project(fixture()),forged={...scene.nodes[0],editorId:'g73:o9999',address:address(73,9999)};
 assert.throws(()=>scene.nodes.push(forged),TypeError,
  'ReadonlyArray alone is not runtime immutability');
 const hit=hitTestSource(scene,{x:2.5,y:3.5},{gridId:73,cellPixels:1,panX:0,panY:0});
 assert.deepEqual(hit.candidates.map(x=>x.editorId),['g73:o101']);
 console.log('QR_386_REPAIR_2_SCENE_NODE_INJECTION_DENIED_PASS');
});
test('QR393 RED3: nested Grid child must point to object in immediate parent Grid',()=>{
 const d=fixture();
 d.objects.push(object(73,120,15,{metadata:{stateKind:'SubGrid',rawState:{SubGrid:{GridID:905}}}}));
 d.objects.push(object(73,121,18,{metadata:{stateKind:'SubGrid',rawState:{SubGrid:{GridID:906}}}}));
 const realParent=address(73,120),wrongParent=address(73,121);
 d.metadata.subGridHierarchy=[{gridId:905,parentAddress:realParent,gridDataPath:'Child/905',tessellationFactor:1,
 bounds:{x:0,y:0,w:20,h:20,status:'AUTHORITATIVE_GRIDDATAPATH'},dimensionSourceSha256:'fixture',
 objects:[],children:[{gridId:906,parentAddress:wrongParent,gridDataPath:'Child/906',tessellationFactor:1,
 bounds:{x:0,y:0,w:12,h:12,status:'AUTHORITATIVE_GRIDDATAPATH'},dimensionSourceSha256:'fixture',
 objects:[object(906,1,2,{source:{...address(906,1),relation:'SUBGRID_CHILD',parentAddress:wrongParent}})],
 children:[]}]}];
 assert.throws(()=>project(d),/SPATIAL_SUBGRID_PARENT_GRID_MISMATCH/);
 console.log('QR_386_REPAIR_3_IMMEDIATE_SUBGRID_PARENT_CLOSURE_DENIED_PASS');
});
