import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEditorDocument, createEditorSession } from '../src/lib/wep/editor-runtime.ts';
import { bindRealSaveSpatialRead, inspectRealSaveSpatialRead, applyRealSaveReadToScene }
  from '../src/lib/wep/real-save-spatial-read.ts';
const FP='a'.repeat(64);
const path='GridData/Villages/Village04-BeachLevel-GridData.json';
const item=40000048;
const obj=(id,x=2,y=3)=>({
 editorId:'g42:o'+id,itemId:item,layer:'furniture',x,y,orientation:0,
 footprint:[{x:0,y:0}],source:{gridId:42,gridObjectId:id,objectMapKey:String(id),relation:'ROOT'},
 portableState:null,dependencyIds:[],editability:'editable',
 metadata:{geometryStatus:'RESOLVED',footprintMode:'ORIENTED_BOUNDING_RECT',
 sourceGridDataPath:path,worldClass:'FurnitureItemData',stateKind:'NONE'}
});
function fixture(){
 const opened={profileSchemaVersion:624,saveIdentity:{sourcePlatform:'switch'},
  compatibility:{routesAuthorized:true,gameVersion:'1.25.0'},
  profile:{World:{Villages:[{Areas:{'7':{GridIDs:[42]}}}],
    GridCollection:{Grids:{'42':{ID:42,GridDataPath:path,TessellationFactor:2,
      Objects:{'7':{ID:7,ItemID:item,X:2,Y:3,Orientation:'GridOrientation_Up',State:0}}}}}}}};
 const doc=normalizeEditorDocument({schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,
    buildIdentity:null,rootGridId:42,villageIndex:0,areaId:7,gridDataPath:path,tessellationFactor:2},
  objects:[obj(7)],networks:{roads:null,fences:null},capabilities:{},
  metadata:{rootGridBounds:{x:0,y:0,w:40,h:32,status:'AUTHORITATIVE_GRIDDATAPATH'}}});
 const session=createEditorSession(doc);
 const bind=bindRealSaveSpatialRead({opened,document:doc,session,sourceFingerprint:FP,sourceEpoch:1});
 return {opened,doc,session,bind};
}
const inspect=f=>inspectRealSaveSpatialRead(f.bind,f.doc,f.session,FP,1);
test('QR445 independent valid raw v1250 Grid7 native ID remains read-only, 626 mismatch is blocked',()=>{
 const f=fixture();
 const positive=inspect(f);
 assert.equal(positive.status,'READY');
 assert.equal(positive.allowed.has('g42:o7'),true);
 assert.equal(positive.persistentWriteAuthorized,false);
 f.opened.profileSchemaVersion=626;
 assert.throws(()=>bindRealSaveSpatialRead({opened:f.opened,document:f.doc,session:f.session,sourceFingerprint:FP,sourceEpoch:1}),/VERSION_OR_PLATFORM/);
 console.log('QR445_REAL_SOURCE_RAW_GRID_POSITIVE_AND_626_WRITER_DENY_PASS');
});
test('QR445 SOURCE RED regression: post-bind fake Native GridObjectID cannot be minted by mutable ReadonlyMap',()=>{
 const f=fixture(),forged=obj(999,8,3);
 const copiedIdentity={editorId:'g42:o999',gridId:42,objectId:999,itemId:item,
   sourceGridDataPath:path,worldClass:'FurnitureItemData'};
 // Caller must NOT be able to modify native source references minted from raw Save.
 // At TS runtime ReadonlyMap is not an immutable authority. This must throw or be ignored.
 try{f.bind.identities.set(forged.editorId,copiedIdentity);}catch(e){
  assert.ok(e instanceof TypeError||e instanceof Error);
 }
 f.doc.objects.push(forged);
 const result=inspect(f);
 assert.equal(result.allowed.has(forged.editorId),false,
  'RED: foreign GridObjectID 999 absent in raw P1G passed without Core source membership');
 console.log('QR445_FORGED_MUTABLE_SOURCE_ID_FAILCLOSED_PASS');
});
test('QR445 SOURCE RED regression: caller cannot mutate allowed Native IDs post-inspection',()=>{
 const f=fixture(),v=inspect(f);
 assert.equal(v.allowed.has('g42:o999'),false);
 try{v.allowed.add('g42:o999');}catch(e){assert.ok(e instanceof TypeError||e instanceof Error);}
 assert.equal(v.allowed.has('g42:o999'),false,
  'RED: UI mutable allowed Set bypasses the inspector after one epoch');
 const forgedScene={objects:[{editorId:'g42:o999'}],unresolved:[],persistentWriteAuthorized:false};
 assert.equal(applyRealSaveReadToScene(forgedScene,v).objects.length,0);
 console.log('QR445_INSPECT_ALLOWED_IMMUTABLE_NO_FORGED_SCENE_PASS');
});

test('QR445 repaired mint authority: caller-spread fabricated binding is STALE',()=>{
 const f=fixture(),fake=obj(999,7,8);
 const foreign={editorId:'g42:o999',gridId:42,objectId:999,itemId:item,sourceGridDataPath:path,worldClass:'FurnitureItemData'};
 const forged={...f.bind,identities:new Map([...f.bind.identities.entries(),[fake.editorId,foreign]])};
 f.doc.objects.push(fake);
 const result=inspectRealSaveSpatialRead(forged,f.doc,f.session,FP,1);
 assert.equal(result.status,'STALE');
 assert.equal(result.allowed.has(fake.editorId),false);
 assert.equal(applyRealSaveReadToScene({objects:[{editorId:fake.editorId}],unresolved:[],persistentWriteAuthorized:false},result).objects.length,0);
 console.log('QR445_UNISSUED_BINDING_STALE_NO_NATIVE_GRANT_PASS');
});
test('QR445 repaired mint authority: synthetic READY verdict cannot paint native ID',()=>{
 const f=fixture();
 const spoof={status:'READY',allowed:new Set(['g42:o999']),unresolved:[],persistentWriteAuthorized:false};
 const scene={objects:[{editorId:'g42:o999'}],unresolved:[],persistentWriteAuthorized:false};
 assert.equal(applyRealSaveReadToScene(scene,spoof).objects.length,0);
 const clean=inspect(f);
 assert.equal(clean.allowed.has('g42:o7'),true);
 assert.equal(clean.persistentWriteAuthorized,false);
 console.log('QR445_UNMINTED_VERDICT_NO_NATIVE_GRANT_PASS');
});
