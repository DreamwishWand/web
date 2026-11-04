// 04 QR independent new-only changed integration risk on PR418 main-based selective
// PR401 latest read-only Native reference bridge (626) next to preexisting 624 UI.
// Source-only synthetic; no genuine P1G Native 2D placement nor Writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {read626SpatialReferences,inspect626SourceObjectAtRevision,
 assert624ProjectedObjectsMatchSave} from '../src/lib/wep/real-save-spatial-source.ts';

const sha='b'.repeat(64), c626={platform:'Nintendo Switch',gameVersion:'1.25.3',
 schema:626,bid:'9A239D3DB569756D',sourceRevision:'qr-int:1',sourceSha256:sha};
const c624={...c626,gameVersion:'1.25.0',schema:624,bid:'52BD625D9B4E0053'};
const raw=id=>({ID:id,ItemID:40000047,X:3,Y:4,Orientation:'GridOrientation_Up',State:null});
function p626(schema=626){return {GameInfo:{Version:schema},World:{
 Villages:[{Areas:{'1':{GridIDs:[12]}}}],
 GridCollection:{Grids:{'12':{ID:12,GridDataPath:'Area/12',TessellationFactor:1,Objects:{'42':raw(42)}}},DiffGrids:{}}}};}
const a=(gridId,gridObjectId)=>({gridId,gridObjectId,objectMapKey:String(gridObjectId)});
test('only actually minted immutable 626 Index retains current main Source identity, no forged GridObject',()=>{
 const original=p626(),before=JSON.stringify(original);
 const idx=read626SpatialReferences(original,c626);
 assert.equal(idx.status,'READ_ONLY_REFERENCE_INDEX');
 assert.equal(idx.geometryFor2d,'NOT_VERIFIED');
 assert.equal(idx.nativePlacementVerified,false);
 assert.equal(idx.persistentWriteAuthorized,false);
 assert.equal(idx.productApplyAuthorized,false);
 const known=inspect626SourceObjectAtRevision(idx,'g12:o42','qr-int:1',sha);
 assert.deepEqual(known.address,{...a(12,42),editorId:'g12:o42'});
 const injected={...idx.objects[0],address:{...a(12,999),editorId:'g12:o999'}};
 assert.throws(()=>idx.objects.push(injected),TypeError);
 assert.throws(()=>inspect626SourceObjectAtRevision(idx,'g12:o999','qr-int:1',sha),/SOURCE_OBJECT_NOT_FOUND/);
 const copied={...idx,objects:[...idx.objects]};
 assert.throws(()=>inspect626SourceObjectAtRevision(copied,'g12:o42','qr-int:1',sha),/INDEX_NOT_MINTED/);
 assert.throws(()=>inspect626SourceObjectAtRevision(idx,'g12:o42','qr-int:2',sha),/REVISION_OR_HASH_STALE/);
 assert.equal(JSON.stringify(original),before,'no mutation of original game Save source');
 console.log('QR_418_INTEGRATED_MINTED_626_INDEX_NO_FAKE_ID_OR_NATIVE_WRITER_PASS');
});
test('624 root source ID matches original but 626 cannot borrow 624 geometry',()=>{
 const src=p626(624);
 const d={schema:'dreamwish-wand-wep-editor-document',version:1,
  target:{platform:'Nintendo Switch',gameVersion:'1.25.0',profileSchemaVersion:624,
   contractBuildIdentity:c624.bid,persistentWriteAuthorized:false,rootGridId:12,gridDataPath:'Area/12'},
  objects:[{editorId:'g12:o42',itemId:40000047,x:3,y:4,orientation:0,
   source:{...a(12,42),relation:'ROOT',parentAddress:null}}],
  metadata:{directRootProjection:{evidenceStatus:'CONFIRMED'},subGridHierarchy:[]}};
 const good=assert624ProjectedObjectsMatchSave(src,d,c624);
 assert.equal(good.identityMatches,true);
 assert.equal(good.persistentWriteAuthorized,false);
 d.objects[0].source.objectMapKey='999';
 assert.throws(()=>assert624ProjectedObjectsMatchSave(src,d,c624),/PROJECTED_ID_MISMATCH/);
 assert.throws(()=>read626SpatialReferences(p626(626),c624),/EXACT_VERSION/);
 console.log('QR_418_INTEGRATED_624_RAW_ADDRESS_MATCH_626_VERSION_SEPARATION_PASS');
});
