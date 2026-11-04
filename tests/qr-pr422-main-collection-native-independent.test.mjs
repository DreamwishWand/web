// 04 QR W-QR-041: independent current protected main PR422 Collection+PC local preset seam.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeItemPersonalOverlay,ITEM_OVERLAY_PRODUCT_ENABLED,ITEM_OVERLAY_WRITER_ENABLED}
 from '../src/lib/ddv/core/items/local-item-overlay-read-contract.mjs';
import {inspectNativePresetLocalFileBytes,inspectNativeToMLocalFileContract,NATIVE_LOCAL_PRESET_FILE_MAX_BYTES}
 from '../src/lib/presets/native-local-file-import-contract.mjs';
const index=JSON.parse(readFileSync('static/ddv/collection/v1.25/index.json','utf8'));
const receipt={contract:'wand.local.save-session.read@1',platform:'switch',fullVersion:'1.25.3',
 buildKind:'switch-bid',buildId:'9A239D3DB569756D',schema:626,
 sourceIdentity:'externally-attested-switch-bid',sourceSha256:'a'.repeat(64),
 sessionId:'b'.repeat(32),revision:0,indexGeneration:1,writerAuthorized:false};
const caps={contract:'wand.local.save-session.read@1',sessionOwner:'worker-singleton',
 readInventory:true,readOwnership:true,canCommit:false,canEncodeEditedCopy:false,canApply:false,canReplaceOriginal:false};
const bridge=(rec=receipt,c=caps)=>({getSession:()=>rec,getCapabilities:()=>c});
const noState=r=>{
 assert.equal(r.canShowPersonalState,false);assert.equal(r.canShowPercentage,false);
 assert.equal(r.canQueryItemFromExistingWorker,false);assert.equal(r.canWriteSave,false);
 assert.deepEqual([r.itemState.owned,r.itemState.discovered,r.itemState.missing],['UNKNOWN','UNKNOWN','UNKNOWN']);
 assert.equal(r.itemState.progressRatio,null);assert.equal(r.itemState.uniqueDenominator,null);
};
test('QR422 independent main composite 1250 Catalog versus 1253 Worker stays UNKNOWN even synthetic client full read claims',()=>{
 const result=describeItemPersonalOverlay({referenceIndex:index,sessionBridge:bridge()});
 assert.equal(result.reason,'CATALOG_AND_LOCAL_SAVE_BUILD_MISMATCH');
 assert.equal(result.catalog.buildId,'52BD625D9B4E0053');
 assert.equal(result.saveTarget.buildId,'9A239D3DB569756D');noState(result);
 assert.equal(ITEM_OVERLAY_PRODUCT_ENABLED,false);assert.equal(ITEM_OVERLAY_WRITER_ENABLED,false);
 for(const bad of [{...receipt,revision:12},{...receipt,writerAuthorized:true},{...receipt,sourceIdentity:'derived'},
  {...receipt,sourceSha256:'unverified'}, {...receipt,indexGeneration:0}])
  noState(describeItemPersonalOverlay({referenceIndex:index,sessionBridge:bridge(bad)}));
 console.log('QR_422_MAIN_1250_1253_NO_PERSONAL_JOIN_WRITER_FALSE_PASS');
});
test('QR422 independent PC JSON import stays bounded/UTF8/version and no DDV Save, ToM or Community grant',async()=>{
 const bytes=text=>new TextEncoder().encode(text);
 for(const payload of [
   '{"schema":"wand.tom-native-backup@1","version":1}',
   '{"__proto__":{"isAdmin":true},"schema":"wand.in-game-preset-backup@1"}',
   '{"schema":"wand.in-game-preset-library@1","version":1,"backups":[]}'
 ]) {
   const res=await inspectNativePresetLocalFileBytes(bytes(payload));
   assert.equal(res.status,'BLOCKED');assert.equal(res.gameSaveApplyAuthorized,false);
   assert.equal(res.publicSharingAuthorized,false);
 }
 const oversized=await inspectNativePresetLocalFileBytes(new Uint8Array(NATIVE_LOCAL_PRESET_FILE_MAX_BYTES+1));
 assert.equal(oversized.status,'BLOCKED');
 const tom=inspectNativeToMLocalFileContract();
 assert.equal(tom.status,'BLOCKED');assert.equal(tom.gameSaveApplyAuthorized,false);
 const ui=readFileSync('src/lib/presets/NativePresetManager.svelte','utf8');
 assert.match(ui,/inspectNativePresetLocalFileBytes/);
 assert.match(ui,/disabled title=\{copy\.blocked\}>\{copy\.restore\}/);
 assert.match(ui,/disabled title=\{copy\.blocked\}>\{copy\.push\}/);
 assert.doesNotMatch(ui,/fetch\s*\(\s*['"]https:.*upload/);
 console.log('QR_422_MAIN_PC_LOCAL_JSON_BOUNDS_TOM_WRITER_PUBLIC_DENY_PASS');
});
