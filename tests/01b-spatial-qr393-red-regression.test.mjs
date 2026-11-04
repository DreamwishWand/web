import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSourceSpatialScene,hitTestSource,selectHitCandidate} from '../src/lib/wep/source-spatial-model.ts';
const DIM='75f33dc20d521d579070aa7919a96c23ce5dd329dbc6f58392f267c9dd0b1aaa';
const a=(gridId,gridObjectId)=>({gridId,gridObjectId,objectMapKey:String(gridObjectId)});
const node=(gridId,id,x,more={})=>({editorId:'g'+gridId+':o'+id,itemId:40000047,layer:'furniture',x,y:3,orientation:0,
 footprint:[{x:0,y:0}],source:{...a(gridId,id),relation:'ROOT',parentAddress:null},portableState:null,
 dependencyIds:[],editability:'editable',metadata:{stateKind:'NONE',footprintMode:'ORIENTED_BOUNDING_RECT'},...more});
const fixture=()=>({schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{platform:'Nintendo Switch',gameVersion:'1.25.0',contractBuildIdentity:'52BD625D9B4E0053',
 profileSchemaVersion:624,persistentWriteAuthorized:false,rootGridId:73,gridDataPath:'Root/73',tessellationFactor:1},
 metadata:{directRootProjection:{evidenceStatus:'CONFIRMED',boundsAuthority:{sha256:DIM}},
 rootGridBounds:{x:0,y:0,w:40,h:30,status:'AUTHORITATIVE_GRIDDATAPATH'},subGridHierarchy:[]},
 networks:{roads:null,fences:null},capabilities:{},objects:[node(73,101,2),node(73,102,10)]});
test('QR393 RED1: genuine hit cannot append a nonhit GridObject ID',()=>{
 const scene=projectSourceSpatialScene(fixture(),'qa-rev'),cam={gridId:73,cellPixels:1,panX:0,panY:0};
 const hit=hitTestSource(scene,{x:2.5,y:3.5},cam);
 assert.deepEqual(hit.candidates.map(x=>x.editorId),['g73:o101']);
 assert.throws(()=>hit.candidates.push(scene.nodes[1]),TypeError);
 assert.throws(()=>selectHitCandidate(scene,hit,'g73:o102','qa-rev'),/SPATIAL_HIT_CANDIDATE_REQUIRED/);
});
test('QR393 RED2: generated scene source ID list rejects forgery',()=>{
 const scene=projectSourceSpatialScene(fixture(),'qa-rev');
 assert.throws(()=>scene.nodes.push({...scene.nodes[0],editorId:'g73:o9999',address:a(73,9999)}),TypeError);
});
test('QR393 RED3: nested child parent must originate in immediate parent Grid',()=>{
 const d=fixture();
 d.objects.push(node(73,120,15,{metadata:{stateKind:'SubGrid',rawState:{SubGrid:{GridID:905}}}}));
 d.objects.push(node(73,121,18,{metadata:{stateKind:'SubGrid',rawState:{SubGrid:{GridID:906}}}}));
 const goodParent=a(73,120),wrongParent=a(73,121);
 const grid905={gridId:905,parentAddress:goodParent,gridDataPath:'Child/905',tessellationFactor:1,
  bounds:{x:0,y:0,w:20,h:20,status:'AUTHORITATIVE_GRIDDATAPATH'},dimensionSourceSha256:'fixture',objects:[],children:[]};
 grid905.children.push({gridId:906,parentAddress:wrongParent,gridDataPath:'Child/906',tessellationFactor:1,
  bounds:{x:0,y:0,w:12,h:12,status:'AUTHORITATIVE_GRIDDATAPATH'},dimensionSourceSha256:'fixture',
  objects:[node(906,1,2,{source:{...a(906,1),relation:'SUBGRID_CHILD',parentAddress:wrongParent}})],children:[]});
 d.metadata.subGridHierarchy=[grid905];
 assert.throws(()=>projectSourceSpatialScene(d,'qa-rev'),/SPATIAL_SUBGRID_PARENT_GRID_MISMATCH/);
});