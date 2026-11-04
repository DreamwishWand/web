// 04 QR W-QR-036, PR401 source-only independent structural guard.
// Switch 1.25.3/schema626 raw references vs 1.25.0/schema624 schematic contract.
// Synthetic profile only; Source SHA is caller-provided, NOT trusted Core CAS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {read626SpatialReferences,inspect626SourceObjectAtRevision,assert624ProjectedObjectsMatchSave}
 from '../src/lib/wep/real-save-spatial-source.ts';
const digest='c'.repeat(64);
const ctx626={platform:'Nintendo Switch',gameVersion:'1.25.3',schema:626,bid:'9A239D3DB569756D',sourceRevision:'epoch:101',sourceSha256:digest};
const ctx624={...ctx626,gameVersion:'1.25.0',schema:624,bid:'52BD625D9B4E0053'};
const grid=(id,objects={})=>({ID:id,GridDataPath:'Area/Grid'+id,TessellationFactor:2,Objects:objects});
const raw=(id,x=4,y=5)=>({ID:id,ItemID:40000047,X:x,Y:y,Orientation:'GridOrientation_Up',State:null});
const profile=(schema=626)=>({GameInfo:{Version:schema},World:{
 Villages:[{Areas:{'7':{GridIDs:[42]}}}],
 GridCollection:{Grids:{'42':grid(42,{'17':raw(17)})},DiffGrids:{}}}});
const document=()=>({
 schema:'dreamwish-wand-wep-editor-document',version:1,
 target:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,contractBuildIdentity:ctx624.bid,
 persistentWriteAuthorized:false,rootGridId:42,gridDataPath:'Area/Grid42'},
 metadata:{directRootProjection:{evidenceStatus:'CONFIRMED'},subGridHierarchy:[]},
 objects:[{editorId:'g42:o17',itemId:40000047,x:4,y:5,orientation:0,
 source:{gridId:42,gridObjectId:17,objectMapKey:'17',relation:'ROOT',parentAddress:null}}]
});
test('626 exact source mapKey+GridID read preserves only native REFERENCES; never accept 2D geometry or Writer',()=>{
 const index=read626SpatialReferences(profile(),ctx626);
 assert.equal(index.status,'READ_ONLY_REFERENCE_INDEX');
 const o=index.objects[0];
 assert.equal(o.address.editorId,'g42:o17');
 assert.equal(o.address.objectMapKey,'17');
 assert.equal(o.serializedX,4);
 assert.equal(o.serializedY,5);
 assert.equal(index.geometryFor2d,'NOT_VERIFIED');
 assert.equal(index.persistentWriteAuthorized,false);
 assert.equal(index.productApplyAuthorized,false);
 assert.equal(index.directSourceReplacementAuthorized,false);
 const inspect=inspect626SourceObjectAtRevision(index,'g42:o17','epoch:101',digest);
 assert.equal(inspect.geometryFor2d,'NOT_VERIFIED');
 assert.throws(()=>inspect626SourceObjectAtRevision(index,'g42:o17','epoch:102',digest),/REVISION_OR_HASH_STALE/);
 console.log('QR_401_626_READONLY_RAW_REFERENCE_EXACT_ID_CAS_NONAUTHORITY_PASS');
});
test('626 native mismatched ID, unresolved DiffGrid and wrong 624 version cannot fabricate visible source authority',()=>{
 const mismatch=profile();mismatch.World.GridCollection.Grids['42'].Objects['17'].ID=99;
 const invalid=read626SpatialReferences(mismatch,ctx626);
 assert.equal(invalid.status,'REFERENCE_ERRORS_FAIL_CLOSED');
 assert.equal(invalid.objects.length,0);
 const diff=profile();diff.World.GridCollection.DiffGrids['42']={ID:42};
 const unresolved=read626SpatialReferences(diff,ctx626);
 assert.equal(unresolved.status,'REFERENCE_ERRORS_FAIL_CLOSED');
 assert.throws(()=>inspect626SourceObjectAtRevision(unresolved,'g42:o17','epoch:101',digest),/GRID_REFERENCE_UNRESOLVED/);
 assert.throws(()=>read626SpatialReferences(profile(),ctx624),/EXACT_VERSION/);
 assert.throws(()=>read626SpatialReferences(profile(624),ctx626),/PROFILE_SCHEMA/);
 console.log('QR_401_626_MAPKEY_DIFFGRID_SCHEMA_FAILCLOSED_PASS');
});
test('624 existing projected IDs checked against identical serialized source; 626 source must not be interpreted as 624',()=>{
 const doc=document(),original=profile(624);
 const match=assert624ProjectedObjectsMatchSave(original,doc,ctx624);
 assert.equal(match.matchingSourceObjects,1);
 assert.equal(match.identityMatches,true);
 assert.equal(match.persistentWriteAuthorized,false);
 doc.objects[0].x=12;
 assert.throws(()=>assert624ProjectedObjectsMatchSave(original,doc,ctx624),/PROJECTED_SOURCE_CHANGED/);
 doc.objects[0].x=4;doc.objects[0].source.objectMapKey='18';
 assert.throws(()=>assert624ProjectedObjectsMatchSave(original,doc,ctx624),/PROJECTED_ID_MISMATCH/);
 doc.objects[0].source.objectMapKey='17';
 assert.throws(()=>assert624ProjectedObjectsMatchSave(profile(626),doc,ctx624),/PROFILE_SCHEMA/);
 console.log('QR_401_624_SOURCE_ID_COORD_MATCH_AND_WRITER_DENY_PASS');
});

test('SOURCE_PROVENANCE_NEGATIVE: caller cannot forge a new native GridObject into a read-only 626 index',()=>{
 const index=read626SpatialReferences(profile(),ctx626);
 const fake={...index.objects[0],address:{
  gridId:42,gridObjectId:999,objectMapKey:'999',editorId:'g42:o999'
 },serializedX:10000,serializedY:10000};
 try {index.objects.push(fake);} catch(error) {
  assert.ok(error instanceof TypeError,String(error));
 }
 assert.throws(()=>inspect626SourceObjectAtRevision(index,'g42:o999','epoch:101',digest),
  /SPATIAL_SOURCE_OBJECT_NOT_FOUND/,
  'Caller-modified read-only index must not be accepted as native ObjectID provenance');
 console.log('QR_401_626_INDEX_FORGED_OBJECT_INSPECTOR_FAILCLOSED_PASS');
});
