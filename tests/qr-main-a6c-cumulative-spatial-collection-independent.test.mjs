// 04 QR / 09 INT post-merge single protected main a6c...
// Independently check cross-stream version/identity/UNKNOWN boundaries, not ancestor unit suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {read626SpatialReferences,inspect626SourceObjectAtRevision}
 from '../src/lib/wep/real-save-spatial-source.ts';
import {inspectCollectionSaveFlag,ITEM_PERSONAL_OVERLAY_ENABLED,ITEM_WRITER_ENABLED}
 from '../src/lib/ddv/core/items/item-semantics-contract.mjs';
import {describeItemPersonalOverlay,ITEM_OVERLAY_PRODUCT_ENABLED,ITEM_OVERLAY_WRITER_ENABLED}
 from '../src/lib/ddv/core/items/local-item-overlay-read-contract.mjs';
import {inspectNativePresetLocalFileBytes,inspectNativeToMLocalFileContract}
 from '../src/lib/presets/native-local-file-import-contract.mjs';
const sha='f'.repeat(64);
const catalog=JSON.parse(readFileSync('static/ddv/collection/v1.25/index.json','utf8'));
test('QR main 626 raw spatial provenance and 1250 source catalog cannot infer personal item owned',()=>{
 const context={platform:'Nintendo Switch',gameVersion:'1.25.3',schema:626,
   bid:'9A239D3DB569756D',sourceRevision:'main:1',sourceSha256:sha};
 const original={GameInfo:{Version:626},World:{
  Villages:[{Areas:{'1':{GridIDs:[12]}}}],
  GridCollection:{Grids:{'12':{ID:12,GridDataPath:'World/12',Objects:{
   '42':{ID:42,ItemID:40000047,X:2,Y:3,Orientation:'GridOrientation_Up',State:null}
  }}},DiffGrids:{}}}};
 const index=read626SpatialReferences(original,context);
 assert.equal(index.status,'READ_ONLY_REFERENCE_INDEX');
 assert.equal(index.geometryFor2d,'NOT_VERIFIED');
 assert.equal(index.persistentWriteAuthorized,false);
 const ref=inspect626SourceObjectAtRevision(index,'g12:o42','main:1',sha);
 assert.equal(ref.address.gridObjectId,42);
 assert.throws(()=>index.objects.push({...index.objects[0],address:{editorId:'g12:o999'}}),TypeError);
 assert.throws(()=>inspect626SourceObjectAtRevision(index,'g12:o999','main:1',sha),/SOURCE_OBJECT_NOT_FOUND/);
 const receipt={contract:'wand.local.save-session.read@1',platform:'switch',fullVersion:'1.25.3',
  buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626,
  sourceIdentity:'externally-attested-switch-bid',sourceSha256:sha,
  revision:0,indexGeneration:1,writerAuthorized:false};
 const caps={contract:'wand.local.save-session.read@1',sessionOwner:'worker-singleton',
  readInventory:true,readOwnership:true,canCommit:false,canEncodeEditedCopy:false,canApply:false,canReplaceOriginal:false};
 const overlay=describeItemPersonalOverlay({referenceIndex:catalog,sessionBridge:{
  getSession:()=>receipt,getCapabilities:()=>caps}});
 assert.equal(overlay.reason,'CATALOG_AND_LOCAL_SAVE_BUILD_MISMATCH');
 assert.equal(overlay.itemState.owned,'UNKNOWN');
 assert.equal(overlay.itemState.discovered,'UNKNOWN');
 assert.equal(overlay.itemState.entryDenominator,null);
 assert.equal(overlay.canWriteSave,false);
 console.log('QR_MAIN_A6C_626_GRID_PROVENANCE_1250_CATALOG_PERSONAL_UNKNOWN_PASS');
});
test('QR main 624 source raw collection boolean does not imply 626 ownership or consent',()=>{
 const source={GameInfo:{Version:624},Player:{CollectionSets:[{
  CollectionDefinitionID:2120000121,GroupData:[{GroupIndex:0,GroupsCollectionItems:{'40000047':true}}]}]}};
 const id={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.0',
   buildId:'52BD625D9B4E0053',profileSchema:624};
 const view=inspectCollectionSaveFlag({profile:source,identity:id,definitionId:2120000121,itemId:40000047});
 assert.equal(view.status,'RAW_SAVE_STRUCTURE_ONLY');
 assert.equal(view.rawFlag,'SAVE_BOOL_TRUE');
 assert.equal(view.owned,'UNKNOWN');assert.equal(view.discovered,'UNKNOWN');
 assert.equal(view.personalCollectionDisplayAuthorized,false);
 assert.equal(ITEM_PERSONAL_OVERLAY_ENABLED,false);assert.equal(ITEM_WRITER_ENABLED,false);
 assert.equal(ITEM_OVERLAY_PRODUCT_ENABLED,false);assert.equal(ITEM_OVERLAY_WRITER_ENABLED,false);
 console.log('QR_MAIN_A6C_624_RAW_TRUE_NOT_NATIVE_OWNERSHIP_PASS');
});
test('QR main PC native preset file operation cannot make DDV Save Writer or Community asset',async()=>{
 const file=new TextEncoder().encode('{"schema":"wand.tom-native-backup@1","version":1}');
 const inspected=await inspectNativePresetLocalFileBytes(file);
 assert.equal(inspected.status,'BLOCKED');
 assert.equal(inspected.gameSaveApplyAuthorized,false);
 assert.equal(inspected.publicSharingAuthorized,false);
 assert.equal(inspectNativeToMLocalFileContract().gameSaveApplyAuthorized,false);
 const src=readFileSync('src/lib/presets/NativePresetManager.svelte','utf8');
 assert.match(src,/disabled title=\{copy\.blocked\}>\{copy\.restore\}/);
 assert.match(src,/disabled title=\{copy\.blocked\}>\{copy\.push\}/);
 console.log('QR_MAIN_A6C_PC_IMPORT_NO_P1G_WRITER_OR_COMMUNITY_PUBLIC_PASS');
});
