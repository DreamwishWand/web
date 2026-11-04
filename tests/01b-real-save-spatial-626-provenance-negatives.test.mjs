import test from 'node:test';
import assert from 'node:assert/strict';
import {read626SpatialReferences,inspect626SourceObjectAtRevision,SWITCH_626}
  from '../src/lib/wep/real-save-spatial-source.ts';

// Synthetic source only: no private save, native geometry or Writer authority.
const sha='d'.repeat(64);
const ctx={platform:'Nintendo Switch',gameVersion:'1.25.3',schema:626,
 bid:'9A239D3DB569756D',sourceSha256:sha,sourceRevision:'rev-live'};
const original=()=>({GameInfo:{Version:626},World:{
 Villages:[{Areas:{'1':{GridIDs:[42]}}}],
 GridCollection:{Grids:{'42':{ID:42,GridDataPath:'World/A',
  Objects:{'7':{ID:7,ItemID:31700014,X:4,Y:5,Orientation:'GridOrientation_Up',State:null}}}},
  DiffGrids:{}}}});

test('QR414 exact: forged g42:o999 cannot enter real 626 source index for Inspector',()=>{
 const idx=read626SpatialReferences(original(),ctx);
 const fake={...idx.objects[0],address:{gridId:42,gridObjectId:999,objectMapKey:'999',editorId:'g42:o999'},
   serializedX:10000,serializedY:10000};
 assert.throws(()=>idx.objects.push(fake),TypeError);
 assert.throws(()=>inspect626SourceObjectAtRevision(idx,'g42:o999','rev-live',sha),
   /SPATIAL_SOURCE_OBJECT_NOT_FOUND/);
});
test('626 index grids, issues, nested area refs and addresses stay immutable',()=>{
 const profile=original();profile.World.GridCollection.DiffGrids['42']={ID:42};
 const idx=read626SpatialReferences(profile,ctx);
 assert.throws(()=>idx.objects.push(idx.objects[0]),TypeError);
 assert.throws(()=>idx.grids.push(idx.grids[0]),TypeError);
 assert.throws(()=>idx.grids[0].areaRefs.push('v999:a999'),TypeError);
 assert.throws(()=>idx.issues.pop(),TypeError);
 assert.throws(()=>{idx.objects[0].address.gridObjectId=999},TypeError);
 assert.throws(()=>inspect626SourceObjectAtRevision(idx,'g42:o7','rev-live',sha),
   /SPATIAL_SOURCE_GRID_REFERENCE_UNRESOLVED/);
});
test('626 Inspector refuses constructed or structured-cloned index even with copied SHA/epoch',()=>{
 const idx=read626SpatialReferences(original(),ctx);
 const fake={...idx,version:SWITCH_626,objects:[...idx.objects]};
 assert.throws(()=>inspect626SourceObjectAtRevision(fake,'g42:o7','rev-live',sha),
  /SPATIAL_SOURCE_INDEX_NOT_MINTED/);
});
