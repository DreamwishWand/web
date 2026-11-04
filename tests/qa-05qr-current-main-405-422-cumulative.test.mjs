// 05 QR independent current main a6c69b: cumulative Item+Collection/PC JSON changes.
// PR392, PR409, QR431 and QR433 original accepted tests are REUSED, not copied.
// All inputs artificial; no original P1G/decoded user Save/Provider traffic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 inspectCollectionSaveFlag,inspectInventoryAmount,previewInventoryAmountCAS,
 ITEM_PERSONAL_OVERLAY_ENABLED,ITEM_WRITER_ENABLED
} from '../src/lib/ddv/core/items/item-semantics-contract.mjs';
import {
 describeItemPersonalOverlay,ITEM_OVERLAY_PRODUCT_ENABLED,ITEM_OVERLAY_WRITER_ENABLED
} from '../src/lib/ddv/core/items/local-item-overlay-read-contract.mjs';
import {
 inspectNativePresetLocalFileBytes,inspectNativeToMLocalFileContract
} from '../src/lib/presets/native-local-file-import-contract.mjs';
import {
 createNativePresetBackup,extractNativePresetSnapshots
} from '../src/lib/presets/native-preset-runtime.js';
import {SINGLE_SAVESESSION_CONTRACT,LOCAL_MAX_P1G_BYTES}
 from '../src/lib/ddv/core/save/local-save-session-bridge.mjs';
const catalog=JSON.parse(readFileSync('static/ddv/collection/v1.25/index.json','utf8'));
const oldId={platform:'switch',sourcePlatform:'switch',gameVersion:'1.25.0',
 buildId:'52BD625D9B4E0053',profileSchema:624};
const p=()=>({GameInfo:{Version:624},Player:{
 CollectionSets:[{CollectionDefinitionID:2120000121,GroupData:[{GroupIndex:0,
  GroupsCollectionItems:{'40700050':true,'40700051':false}}]}],
 ListInventories:{'0':{CompatibleItemType:4,Inventory:{
  '40700050':{Amount:0,Opaque:{kept:1}},'40700051':{Amount:19}}}}
}});
const active={contract:'wand.local.save-session.read@1',platform:'switch',fullVersion:'1.25.3',
 buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626,
 sourceIdentity:'externally-attested-switch-bid',sourceSha256:'a'.repeat(64),
 sessionId:'b'.repeat(32),revision:0,indexGeneration:1,writerAuthorized:false};
const caps={contract:'wand.local.save-session.read@1',sessionOwner:'worker-singleton',
 readInventory:false,readOwnership:false,canCommit:false,canEncodeEditedCopy:false,
 canApply:false,canReplaceOriginal:false};
test('source-only bool + amount + inert CAS cannot mint displayed Owned on current main',()=>{
 const original=p(),bytes=JSON.stringify(original);
 const t=inspectCollectionSaveFlag({profile:original,identity:oldId,
  definitionId:2120000121,groupIndex:0,itemId:40700050});
 const f=inspectCollectionSaveFlag({profile:original,identity:oldId,
  definitionId:2120000121,groupIndex:0,itemId:40700051});
 const absent=inspectCollectionSaveFlag({profile:original,identity:oldId,
  definitionId:2120000121,groupIndex:0,itemId:40700052});
 assert.deepEqual([t.rawFlag,f.rawFlag,absent.rawFlag],
  ['SAVE_BOOL_TRUE','SAVE_BOOL_FALSE','ABSENT_ITEM_ENTRY']);
 const i=inspectInventoryAmount({profile:original,identity:oldId,inventoryId:0,
  canonicalItemId:40700050,compatibleItemType:4});
 assert.equal(i.rawAmount,0);
 assert.equal(i.owned,'UNKNOWN');
 const preview=previewInventoryAmountCAS({inspection:i,expectedOldAmount:0,nextAmount:2});
 assert.equal(preview.status,'HYPOTHETICAL_CAS_PREVIEW_ONLY');
 assert.equal(preview.writerAuthorized,false);
 assert.equal(preview.exportAuthorized,false);
 assert.equal(JSON.stringify(original),bytes,'read-only source exact opaque preservation');
 assert.equal(ITEM_PERSONAL_OVERLAY_ENABLED,false);
 assert.equal(ITEM_WRITER_ENABLED,false);
});
test('same main 1250 reference + 1253 Worker session strictly unavailable personal Owned',()=>{
 const result=describeItemPersonalOverlay({referenceIndex:catalog,sessionBridge:{
  getSession:()=>active,getCapabilities:()=>caps}});
 assert.equal(result.reason,'CATALOG_AND_LOCAL_SAVE_BUILD_MISMATCH');
 assert.equal(result.itemState.owned,'UNKNOWN');
 assert.equal(result.itemState.discovered,'UNKNOWN');
 assert.equal(result.itemState.missing,'UNKNOWN');
 assert.equal(result.itemState.entryDenominator,null);
 assert.equal(result.itemState.uniqueDenominator,null);
 assert.equal(result.canShowPercentage,false);
 assert.equal(result.canQueryItemFromExistingWorker,false);
 assert.equal(ITEM_OVERLAY_PRODUCT_ENABLED,false);
 assert.equal(ITEM_OVERLAY_WRITER_ENABLED,false);
 assert.equal(SINGLE_SAVESESSION_CONTRACT,'wand.local.save-session.read@1');
 assert.equal(LOCAL_MAX_P1G_BYTES,128*1024*1024);
});
test('same main local DecorationPreset JSON import preserves opaque unknown, never game Writer',async()=>{
 const raw={GridCollection:{Grids:{'0':{ID:0,NextGridObjectID:1,
  Objects:{'0':{ID:0,ItemID:40000001,X:0,Y:0,State:null,Unknown:'do-not-erase'}}}},
  DiffGrids:{},NextGridID:1},PresetName:'Synthetic',ThumbnailItems:[40000001],
  ShareInfo:null,StateFlags:0,UnknownExtra:{V:626}};
 const backup=createNativePresetBackup(extractNativePresetSnapshots({
  World:{DecorationPresets:[raw]}})[0],{
  sourceName:'only-local-synthetic',
  now:'2026-11-04T00:00:00Z',idFactory:()=>'cumulative'});
 const before=JSON.stringify(backup);
 const inspected=await inspectNativePresetLocalFileBytes(new TextEncoder().encode(before));
 assert.equal(inspected.localFileReady,true);
 assert.equal(inspected.status,'LOCAL_FILE_VALIDATED_PRESERVE_ONLY');
 assert.deepEqual(inspected.backups[0].backup.payload.UnknownExtra,{V:626});
 assert.equal(inspected.sourceBuildAttested,false);
 assert.equal(inspected.gameSaveApplyAuthorized,false);
 assert.equal(inspected.saveWriterAuthorized,false);
 assert.equal(inspected.publicSharingAuthorized,false);
 assert.equal(JSON.stringify(backup),before);
 const unknown=inspectNativeToMLocalFileContract();
 assert.equal(unknown.status,'BLOCKED');
 assert.equal(unknown.gameSaveApplyAuthorized,false);
});
