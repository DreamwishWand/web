import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeSyntheticP1gProfile } from './helpers/p1g-fixture.mjs';
import { openWorldSaveBytes, WEP_WORLD_READONLY_626_PROVENANCE } from '../src/lib/wep/world-save-source.ts';
import { bind626SourceInspector, inspect626BoundObject, page626BoundObjects } from '../src/lib/wep/schema626-source-inspector.ts';

const BID='9A239D3DB569756D';
const FP=b=>createHash('sha256').update(b).digest('hex');
function profile(x=2) { return {
 GameInfo:{Version:626,InitialVersion:624,LastSaveDeviceInfo:{deviceType:'DeviceType_Switch'}},
 Player:{Name:'Local synthetic fixture'},
 World:{Villages:[{Areas:{'7':{GridIDs:[42],Unlocked:true}}}],
 GridCollection:{Grids:{
  '42':{ID:42,GridDataPath:'GridData/624-geometry-NOT-allowed.json',TessellationFactor:2,
    Objects:{'7':{ID:7,ItemID:40000047,X:x,Y:3,Orientation:'GridOrientation_Up',
      State:{SubGrid:{GridID:43,DesignID:null}}}}},
  '43':{ID:43,GridDataPath:'GridData/child.json',TessellationFactor:2,
    Objects:{'9':{ID:9,ItemID:40000049,X:0,Y:1,Orientation:'GridOrientation_Up',State:null}}}
 },DiffGrids:{}}}
}};
async function load(x=2) {
 const bytes=Buffer.from(makeSyntheticP1gProfile(profile(x)));
 const sha=FP(bytes);
 const opened=await openWorldSaveBytes(bytes,{
  sourcePlatform:'switch',
  targetBuild:{platform:'switch',kind:'switch-bid',value:BID},
  sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE
 });
 const bind=bind626SourceInspector(opened,sha,1,BID);
 return {bytes,sha,opened,bind};
}
const inspect=(f,g=42,o=7,b=f.bind)=>inspect626BoundObject(b,f.opened,f.sha,1,g,o);

test('04QR 457 legitimate 626 root+child have distinct raw IDs, no 624 placement or Write',async()=>{
 const f=await load();
 const root=inspect(f),child=inspect(f,43,9);
 assert.equal(root.editorId,'g42:o7');
 assert.equal(child.editorId,'g43:o9');
 assert.equal(child.parentEditorId,'g42:o7');
 assert.equal(root.serializedGridLocalX,2);
 for(const value of [root,child]){
  assert.equal(value.geometryFor2d,'NOT_VERIFIED');
  assert.equal(value.nativePlacementVerified,false);
  assert.equal(value.trustedCoreRevision,false);
  assert.equal(value.persistentWriteAuthorized,false);
  assert.equal(value.productApplyAuthorized,false);
 }
 assert.equal(FP(f.bytes),f.sha);
 console.log('QR457_626_ROOT_CHILD_READONLY_RAW_ONLY_PASS');
});

test('04QR 457 unminted clone index cannot supply forged parent or native ID',async()=>{
 const f=await load();
 const cloned={...f.bind,index:{...f.bind.index}};
 assert.throws(()=>inspect(f,42,7,cloned),/SPATIAL_SOURCE_INDEX_NOT_MINTED/);
 assert.equal(Object.isFrozen(f.bind.index.objects),true);
 assert.equal(Object.isFrozen(f.bind.index.objects[0]),true);
 assert.throws(()=>inspect(f,42,999),/SPATIAL_SOURCE_OBJECT_NOT_FOUND/);
 const safe=page626BoundObjects(f.bind,f.opened,f.sha,1,42,0,10);
 assert.deepEqual(safe.items.map(x=>x.editorId),['g42:o7']);
 console.log('QR457_UNMINTED_SOURCE_INDEX_AND_FOREIGN_ID_DENIED_PASS');
});

test('04QR 457 mutable profile is rechecked and A->B cannot recycle a stale index',async()=>{
 const a=await load(2),b=await load(16);
 assert.throws(()=>inspect626BoundObject(a.bind,b.opened,a.sha,1,42,7),/STALE_SOURCE_OR_SESSION/);
 assert.equal(inspect(b).serializedGridLocalX,16);
 assert.equal(inspect(a).serializedGridLocalX,2);
 a.opened.profile.World.GridCollection.Grids['42'].Objects['7'].X=999;
 assert.throws(()=>inspect(a),/RAW_SOURCE_CHANGED/);
 a.opened.profile.World.GridCollection.Grids['42'].Objects['7'].X=2;
 a.opened.profile.World.GridCollection.Grids['42'].Objects['999']={
  ID:999,ItemID:40000047,X:5,Y:5,Orientation:'GridOrientation_Up',State:null
 };
 assert.throws(()=>inspect(a,42,999),/SOURCE_OBJECT_NOT_FOUND/);
 console.log('QR457_SOURCE_INSTANCE_SHA_EPOCH_AND_MUTATED_PROFILE_DENIED_PASS');
});

test('04QR 457 wrong BID, 624 conversion, pagination and malformed numeric keys fail closed',async()=>{
 const f=await load();
 assert.throws(()=>bind626SourceInspector(f.opened,f.sha,1,'52BD625D9B4E0053'),/EXACT_READONLY_SOURCE_REQUIRED/);
 assert.throws(()=>inspect626BoundObject(f.bind,f.opened,'b'.repeat(64),1,42,7),/STALE_SOURCE_OR_SESSION/);
 assert.throws(()=>inspect(f,'042',7),/CANONICAL_ADDRESS_REQUIRED/);
 assert.throws(()=>page626BoundObjects(f.bind,f.opened,f.sha,1,42,0,26),/PAGE_BOUNDS_INVALID/);
 assert.throws(()=>page626BoundObjects(f.bind,f.opened,f.sha,1,42,-1,1),/PAGE_BOUNDS_INVALID/);
 assert.throws(()=>page626BoundObjects(f.bind,f.opened,f.sha,1,42,0,0),/PAGE_BOUNDS_INVALID/);
 assert.throws(()=>bind626SourceInspector({...f.opened,profileSchemaVersion:624},f.sha,1,BID),/EXACT_READONLY_SOURCE_REQUIRED/);
 console.log('QR457_626_CROSS_BUILD_AND_BOUNDED_READ_FAILCLOSED_PASS');
});
