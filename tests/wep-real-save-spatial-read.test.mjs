import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorSession, normalizeEditorDocument } from '../src/lib/wep/editor-runtime.ts';
import { buildSpatialScene, spatialHitTest, spatialSelectedDetails } from '../src/lib/wep/spatial-scene.ts';
import {
  bindRealSaveSpatialRead, inspectRealSaveSpatialRead,
  applyRealSaveReadToScene
} from '../src/lib/wep/real-save-spatial-read.ts';

// Synthetic P1G-SHAPED source. Never substitute this fixture for genuine
// private V1/V2, native same-build semantics or independent acceptance.
const FP='a'.repeat(64);
const BID='52BD625D9B4E0053';
const path='GridData/Villages/Village04-BeachLevel-GridData.json';
const obj=(id,x,y,orientation=0)=>({
  editorId:'g42:o'+id,itemId:40000048,layer:'furniture',
  x,y,orientation,
  footprint:orientation===4?[{x:0,y:0},{x:0,y:1}]:[{x:0,y:0},{x:1,y:0}],
  source:{gridId:42,gridObjectId:id,objectMapKey:String(id),relation:'ROOT'},
  portableState:null,dependencyIds:[],editability:'editable',
  metadata:{
    geometryStatus:'RESOLVED',footprintMode:'ORIENTED_BOUNDING_RECT',
    sourceGridDataPath:path,worldClass:'FurnitureItemData',stateKind:'NONE'
  }
});
const raw=(id,x,y,orientation='GridOrientation_Up')=>({
  ID:id,ItemID:40000048,X:x,Y:y,Orientation:orientation,State:0
});
function fixture(){
  const opened={
    profileSchemaVersion:624,
    saveIdentity:{sourcePlatform:'switch'},
    compatibility:{routesAuthorized:true,gameVersion:'1.25.0'},
    profile:{World:{
      Villages:[{Areas:{'7':{GridIDs:[42]}}}],
      GridCollection:{Grids:{'42':{
        ID:42,GridDataPath:path,TessellationFactor:2,
        Objects:{'7':raw(7,2,3),'8':raw(8,8,3,'GridOrientation_Right')}
      }}}
    }}
  };
  const document=normalizeEditorDocument({
    schema:'dreamwish-wand-wep-editor-document',version:1,
    target:{
      platform:'Nintendo Switch',gameVersion:'1.25.0',
      profileSchemaVersion:624,buildIdentity:null,
      rootGridId:42,villageIndex:0,areaId:7,gridDataPath:path,tessellationFactor:2
    },
    objects:[obj(7,2,3),obj(8,8,3,4)],
    networks:{roads:null,fences:null},capabilities:{},
    metadata:{rootGridBounds:{x:0,y:0,w:40,h:32,status:'AUTHORITATIVE_GRIDDATAPATH'}}
  });
  const session=createEditorSession(document);
  return {opened,document,session};
}
const bind=f=>bindRealSaveSpatialRead({
  opened:f.opened,document:f.document,session:f.session,
  sourceFingerprint:FP,sourceEpoch:1
});
const view=(f,b,hash=FP,epoch=1,session=f.session)=>{
  const document=session.getDocument();
  const proof=inspectRealSaveSpatialRead(b,document,session,hash,epoch);
  const scene=applyRealSaveReadToScene(buildSpatialScene(document,{
    bounds:document.metadata.rootGridBounds
  }),proof);
  return {proof,scene};
};

test('raw GridObject -> same EditorSession scene/click/inspector/Move/Undo identity',()=>{
  const f=fixture(), b=bind(f);
  const first=view(f,b);
  assert.equal(first.proof.status,'READY');
  assert.deepEqual(first.scene.objects.map(o=>o.editorId),['g42:o7','g42:o8']);
  assert.equal(spatialHitTest(first.scene,2.5,3.5)?.editorId,'g42:o7');
  assert.equal(spatialHitTest(first.scene,8.5,4.5)?.editorId,'g42:o8');
  assert.equal(spatialSelectedDetails(first.scene,'g42:o7')?.nativeGridObjectId,'7');
  f.session.setSelection(['g42:o7']);
  const result=f.session.move(['g42:o7'],1,0,{strict:true,areaBounds:{x:0,y:0,w:40,h:32}});
  assert.equal(result.applied,true);
  const moved=view(f,b).scene;
  assert.equal(moved.objects[0].x,3);
  assert.equal(spatialSelectedDetails(moved,'g42:o7')?.editorId,'g42:o7');
  assert.equal(f.session.reviewChanges().changes.some(c=>c.editorId==='g42:o7'),true);
  assert.equal(f.session.undo().applied,true);
  assert.equal(view(f,b).scene.objects[0].x,2);
  assert.equal(f.session.redo().applied,true);
  assert.equal(view(f,b).scene.objects[0].x,3);
  assert.equal(b.persistentWriteAuthorized,false);
  assert.equal(b.trustedCoreRevision,false);
});
test('stale fingerprint/epoch or A->B Session clears all rendered IDs',()=>{
  const f=fixture(), b=bind(f);
  assert.equal(view(f,b,'b'.repeat(64)).scene.objects.length,0);
  assert.equal(view(f,b,FP,2).proof.status,'STALE');
  const second=createEditorSession(f.document);
  const stale=view(f,b,FP,1,second);
  assert.equal(stale.scene.objects.length,0);
  assert.ok(stale.scene.unresolved.every(x=>x.code==='SPATIAL_READ_SOURCE_REVISION_MISMATCH'));
});
test('raw GridObject changed without source Session rebind fails only that ID',()=>{
  const f=fixture();
  f.opened.profile.World.GridCollection.Grids['42'].Objects['7'].X=99;
  const b=bind(f), v=view(f,b);
  assert.deepEqual(v.scene.objects.map(o=>o.editorId),['g42:o8']);
  assert.equal(v.scene.unresolved.some(x=>x.code==='SPATIAL_READ_RAW_OBJECT_CONFLICT'),true);
});
test('unknown source, parent SubGrid and missing native map are not painted',()=>{
  const f=fixture();
  f.document.objects.push(obj(9,12,3));
  f.document.objects[0].source.parentAddress={gridId:42,gridObjectId:8,objectMapKey:'8'};
  const b=bind(f),v=view(f,b);
  assert.deepEqual(v.scene.objects.map(o=>o.editorId),['g42:o8']);
  assert.equal(v.scene.unresolved.some(x=>x.code==='SPATIAL_READ_SOURCE_ID_OR_PARENT_UNPROVEN'),true);
  assert.equal(v.scene.unresolved.some(x=>x.code==='SPATIAL_READ_NATIVE_OBJECT_MISSING'),true);
});
test('forged duplicate native ID is completely excluded',()=>{
  const f=fixture();
  f.document.objects.push({...obj(7,2,3),metadata:{...obj(7,2,3).metadata}});
  const b=bind(f),v=view(f,b);
  assert.equal(v.scene.objects.some(o=>o.editorId==='g42:o7'),false);
  assert.equal(v.scene.unresolved.some(x=>x.code==='SPATIAL_READ_DUPLICATE_NATIVE_ID'),true);
});
test('unsupported platform/schema/BID/route/dimensions are global fail-closed',()=>{
  const f=fixture();
  const run=()=>bind(f);
  f.opened.profileSchemaVersion=626;assert.throws(run,/VERSION_OR_PLATFORM/);f.opened.profileSchemaVersion=624;
  f.document.target.gameVersion='1.25.3';assert.throws(run,/VERSION_OR_PLATFORM/);f.document.target.gameVersion='1.25.0';
  f.document.target.buildIdentity='9A239D3DB569756D';assert.throws(run,/BID_MISMATCH/);f.document.target.buildIdentity=null;
  f.opened.profile.World.Villages[0].Areas['7'].GridIDs=[43];assert.throws(run,/AREA_GRID_MEMBERSHIP/);
  f.opened.profile.World.Villages[0].Areas['7'].GridIDs=[42];
  f.document.metadata.rootGridBounds.status='UNVERIFIED';assert.throws(run,/BOUNDS_UNVERIFIED/);
});
test('rotated footprint and overlapping same-cell hit use unchanged painter order',()=>{
  const f=fixture();
  f.opened.profile.World.GridCollection.Grids['42'].Objects['8'].X=2;
  f.opened.profile.World.GridCollection.Grids['42'].Objects['8'].Y=3;
  f.document.objects[1].x=2;f.document.objects[1].y=3;
  const v=view(f,bind(f)), hit=spatialHitTest(v.scene,2.5,3.5);
  assert.equal(v.scene.objects.length,2);
  assert.equal(hit?.editorId,'g42:o7'); // Current WEP layer/painter ordering, not source map key order
});
test('locally authored draft remains schematic without a forged native GridObject ID',()=>{
  const f=fixture(),b=bind(f);
  f.session.insertDraftGraph([{
    localId:'new',itemId:40000048,layer:'furniture',
    localX:0,localY:0,footprint:[{x:0,y:0}],dependencyLocalIds:[]
  }],{anchorX:15,anchorY:5});
  const v=view(f,b);
  assert.equal(v.scene.objects.length,3);
  const draft=v.scene.objects.find(o=>o.editorId.startsWith('draft-'));
  assert.ok(draft);
  assert.equal(draft.spatial.nativeGridObjectId,null);
  assert.equal(b.persistentWriteAuthorized,false);
});

test('main PR418 01B direct-root cross-check rejects native extra GridObject and forged provenance',()=>{
  const f=fixture();
  f.document.target.contractBuildIdentity=BID;
  f.document.target.persistentWriteAuthorized=false;
  f.document.metadata.directRootProjection={evidenceStatus:'CONFIRMED'};
  f.document.metadata.subGridHierarchy=[];
  const proof=bind(f);
  assert.equal(proof.identities.size,2);
  // A source object not emitted by a projector is never a complete direct root.
  f.opened.profile.World.GridCollection.Grids['42'].Objects['9']=raw(9,20,3);
  assert.throws(()=>bind(f),/SPATIAL_624_ROOT_SOURCE_OBJECT_SET_INCOMPLETE/);
  delete f.opened.profile.World.GridCollection.Grids['42'].Objects['9'];
  f.document.metadata.directRootProjection.evidenceStatus='UNVERIFIED';
  assert.throws(()=>bind(f),/SPATIAL_624_PROJECTION_AUTHORITY_MISSING/);
});

test('main 626 structural source cannot borrow 624 Spatial Scene geometry',()=>{
  const f=fixture();
  f.opened.profileSchemaVersion=626;
  f.opened.compatibility.gameVersion='1.25.3';
  f.opened.compatibility.routesAuthorized=false;
  assert.throws(()=>bind(f),/SPATIAL_READ_VERSION_OR_PLATFORM_UNSUPPORTED/);
});
