import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEditorDocument, createEditorSession } from '../src/lib/wep/editor-runtime.ts';
import { buildSpatialScene, spatialHitTest, spatialSelectedDetails } from '../src/lib/wep/spatial-scene.ts';
import { bindRealSaveSpatialRead, inspectRealSaveSpatialRead, applyRealSaveReadToScene }
  from '../src/lib/wep/real-save-spatial-read.ts';
import { describeThreeDomainReadCapabilities, readThreeDomainPage }
  from '../src/lib/ddv/core/save/three-domain-read-facade.mjs';

const fp='a'.repeat(64),path='GridData/Villages/Village04-BeachLevel-GridData.json';
const oid=(id,x,y)=>({
 editorId:'g42:o'+id,itemId:40000048,layer:'furniture',x,y,orientation:0,
 footprint:[{x:0,y:0}],source:{gridId:42,gridObjectId:id,objectMapKey:String(id),relation:'ROOT'},
 portableState:null,dependencyIds:[],editability:'editable',
 metadata:{geometryStatus:'RESOLVED',footprintMode:'ORIENTED_BOUNDING_RECT',
 sourceGridDataPath:path,worldClass:'FurnitureItemData',stateKind:'NONE'}
});
function fixture(){
 const opened={profileSchemaVersion:624,saveIdentity:{sourcePlatform:'switch'},
  compatibility:{routesAuthorized:true,gameVersion:'1.25.0'},
  profile:{World:{Villages:[{Areas:{'7':{GridIDs:[42]}}}],GridCollection:{Grids:{
   '42':{ID:42,GridDataPath:path,TessellationFactor:2,Objects:{
    '7':{ID:7,ItemID:40000048,X:2,Y:3,Orientation:'GridOrientation_Up',State:0},
    '8':{ID:8,ItemID:40000048,X:8,Y:3,Orientation:'GridOrientation_Up',State:0}
   }}
  }}}}};
 const document=normalizeEditorDocument({schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,
   buildIdentity:null,rootGridId:42,villageIndex:0,areaId:7,gridDataPath:path,tessellationFactor:2},
  objects:[oid(7,2,3),oid(8,8,3)],networks:{roads:null,fences:null},capabilities:{},
  metadata:{rootGridBounds:{x:0,y:0,w:40,h:32,status:'AUTHORITATIVE_GRIDDATAPATH'}}});
 const session=createEditorSession(document);
 const binding=bindRealSaveSpatialRead({opened,document,session,sourceFingerprint:fp,sourceEpoch:1});
 return {opened,document,session,binding};
}
const scene=f=>{
 const doc=f.session.getDocument();
 const proof=inspectRealSaveSpatialRead(f.binding,doc,f.session,fp,1);
 return {proof,view:applyRealSaveReadToScene(buildSpatialScene(doc,{bounds:doc.metadata.rootGridBounds}),proof)};
};
test('04QR integration: raw Grid42 Object7 source → scene → hit → inspector → Move draft → Undo retains immutable Native ID',()=>{
 const f=fixture(),first=scene(f);
 assert.equal(first.proof.status,'READY');
 assert.deepEqual(first.view.objects.map(o=>o.editorId),['g42:o7','g42:o8']);
 assert.equal(spatialHitTest(first.view,2.5,3.5)?.editorId,'g42:o7');
 assert.equal(spatialSelectedDetails(first.view,'g42:o7')?.nativeGridObjectId,'7');
 assert.equal(f.binding.persistentWriteAuthorized,false);
 f.session.setSelection(['g42:o7']);
 const moved=f.session.move(['g42:o7'],1,0,{strict:true,areaBounds:{x:0,y:0,w:40,h:32}});
 assert.equal(moved.applied,true);
 const post=scene(f);
 assert.equal(post.view.objects.find(o=>o.editorId==='g42:o7').x,3);
 assert.equal(post.proof.allowed.has('g42:o7'),true);
 assert.equal(f.session.reviewChanges().changes.some(x=>x.editorId==='g42:o7'),true);
 assert.equal(f.session.undo().applied,true);
 assert.equal(f.session.reviewChanges().changes.length,0);
 assert.equal(scene(f).view.objects.find(o=>o.editorId==='g42:o7').x,2);
 assert.equal(f.binding.trustedCoreRevision,false);
 console.log('QR472_CUMULATIVE_NATIVE_ID_SCENE_HIT_INSPECT_MOVE_UNDO_PASS');
});
test('04QR integration: A/B epoch and forged Scene IDs cannot reuse issued native authority',()=>{
 const f=fixture(),v=scene(f);
 const forged={objects:[{editorId:'g42:o999'}],unresolved:[],persistentWriteAuthorized:true};
 assert.equal(applyRealSaveReadToScene(forged,v.proof).objects.length,0);
 assert.equal(typeof f.binding.identities.set,'undefined');
 assert.equal(typeof v.proof.allowed.add,'undefined');
 const stale=inspectRealSaveSpatialRead(f.binding,f.session.getDocument(),f.session,'b'.repeat(64),1);
 assert.equal(stale.status,'STALE');
 assert.equal(applyRealSaveReadToScene(forged,stale).objects.length,0);
 const second=createEditorSession(f.document);
 assert.equal(inspectRealSaveSpatialRead(f.binding,second.getDocument(),second,fp,1).status,'STALE');
 console.log('QR472_CUMULATIVE_FORGED_ID_AND_CROSS_SESSION_DENIED_PASS');
});
test('04QR integration: schema626 cannot borrow 624 world geometry; single Core Session World/Collection remain unavailable',async()=>{
 const f=fixture();
 f.opened.profileSchemaVersion=626;
 assert.throws(()=>bindRealSaveSpatialRead({opened:f.opened,document:f.document,session:f.session,
  sourceFingerprint:fp,sourceEpoch:1,externalBid:'9A239D3DB569756D'}),/VERSION_OR_PLATFORM/);
 const claimed={getSession:()=>({}),getCapabilities:()=>({readGrid:true,readOwnership:true,canCommit:true})};
 const caps=describeThreeDomainReadCapabilities(claimed);
 assert.equal(caps.domains.World.workerReadAvailable,false);
 assert.equal(caps.domains.Collection.workerReadAvailable,false);
 assert.equal(caps.canEncodeEditedCopy,false);
 await assert.rejects(readThreeDomainPage(claimed,{domain:'World'}),/LOCAL_DOMAIN_READ_NOT_ACCEPTED/);
 await assert.rejects(readThreeDomainPage(claimed,{domain:'Collection'}),/LOCAL_DOMAIN_READ_NOT_ACCEPTED/);
 console.log('QR472_CUMULATIVE_626_NO_624_GEOMETRY_OR_CORE_WORLD_CAPABILITY_PASS');
});
