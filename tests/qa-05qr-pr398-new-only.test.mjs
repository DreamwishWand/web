// 05 QR independent PR398 NEW-only: local PC JSON file review (not game Save).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 inspectNativePresetLocalFileBytes,inspectNativeToMLocalFileContract,
 NATIVE_LOCAL_PRESET_FILE_MAX_BYTES,NATIVE_LOCAL_TOM_FILE_SUPPORTED
} from '../src/lib/presets/native-local-file-import-contract.mjs';
import {
 createNativePresetBackup,extractNativePresetSnapshots,
 NATIVE_PRESET_LIBRARY_SCHEMA
} from '../src/lib/presets/native-preset-runtime.js';
import {
 describeItemPersonalOverlay, ITEM_OVERLAY_PRODUCT_ENABLED,
 ITEM_OVERLAY_WRITER_ENABLED,ITEM_OVERLAY_TYPED_READ_PLAN
} from '../src/lib/ddv/core/items/local-item-overlay-read-contract.mjs';

const enc=new TextEncoder(),bytes=x=>enc.encode(JSON.stringify(x));
const profile=()=>({
 World:{DecorationPresets:[{
  GridCollection:{Grids:{'0':{ID:0,NextGridObjectID:1,Objects:{
   '0':{ID:0,ItemID:40000001,X:0,Y:0,State:null,
    UnknownNative:{doNotTouch:['x',2]}}}}},DiffGrids:{},NextGridID:1},
  PresetName:'Local Only',ThumbnailItems:[40000001],ShareInfo:null,
  StateFlags:0,FutureOpaque:{preserve:2126}
 }]}
});
const backup=()=>createNativePresetBackup(
 extractNativePresetSnapshots(profile())[0],
 {sourceName:'SYNTHETIC-PC-ONLY',now:'2026-11-04T08:00:00Z',idFactory:()=>'independent'}
);
function off(x){
 assert.equal(x.gameSaveApplyAuthorized,false);
 assert.equal(x.publicSharingAuthorized,false);
 assert.equal(x.sourceBuildAttested,false);
}
test('local JSON review preserves unknown object, SHA identity and never grants Save/Provider/Writer',async()=>{
 const b=backup(),original=bytes(b),before=new Uint8Array(original);
 const out=await inspectNativePresetLocalFileBytes(original);
 assert.equal(out.status,'LOCAL_FILE_VALIDATED_PRESERVE_ONLY');
 assert.equal(out.localFileReady,true);
 assert.match(out.informationalFileSha256,/^[a-f0-9]{64}$/);
 assert.equal(out.sourceBytes,original.byteLength);
 assert.equal(out.sourceProfileSchema,624);
 assert.equal(out.sourceGameVersion,null);assert.equal(out.sourceBID,null);
 off(out);
 assert.equal(out.saveWriterAuthorized,false);
 assert.equal(out.communityPresetCreated,false);
 assert.equal(out.originalSourceModified,false);
 assert.equal(out.localFileWrittenByThisFunction,false);
 assert.deepEqual(out.backups[0].backup.payload.FutureOpaque,{preserve:2126});
 assert.deepEqual(out.backups[0].backup.payload.GridCollection.Grids['0'].Objects['0'].UnknownNative,
   {doNotTouch:['x',2]});
 assert.deepEqual(original,before);
});
test('mixed PC local library import valid unique IDs, duplicate IDs failclosed',async()=>{
 const one=backup(),two={...backup(),id:'native_second'};
 const lib={schema:NATIVE_PRESET_LIBRARY_SCHEMA,version:1,backups:[one,two]};
 const ok=await inspectNativePresetLocalFileBytes(bytes(lib));
 assert.equal(ok.backups.length,2);off(ok);
 assert.equal(ok.localFileReady,true);
 const dup=await inspectNativePresetLocalFileBytes(bytes({...lib,backups:[one,one]}));
 assert.equal(dup.code,'LOCAL_PRESET_FILE_DUPLICATE_ID');off(dup);
});
test('wrong version/schema/rights/share/Source626 cannot forge native restorable/public authority',async()=>{
 const b=backup();
 for(const delta of [
  {version:2},{schema:'wand.tom.design.unknown@1'},
  {persistentWriteAuthorized:true},{publicSharingAuthorized:true},
  {productApplyAuthorized:true},{source:{...b.source,profileSchemaVersion:626}},
  {source:{...b.source,physicalPresetIndex:-1}},
  {payload:{...b.payload,ShareInfo:undefined}},
  {payload:{...b.payload,StateFlags:'bad'}}
 ]){
  const o=await inspectNativePresetLocalFileBytes(bytes({...b,...delta}));
  assert.equal(o.status,'BLOCKED',JSON.stringify(delta));
  off(o);
 }
 const forged={...b,source:{...b.source,
   buildId:'9A239D3DB569756D',sourceFullVersion:'1.25.3',rights:'APPROVED'}};
 const x=await inspectNativePresetLocalFileBytes(bytes(forged));
 assert.equal(x.status,'LOCAL_FILE_VALIDATED_PRESERVE_ONLY');
 assert.equal(x.sourceBuildAttested,false);
 assert.equal(x.sourceBID,null);
 off(x);
});
test('tombstone/root Grid0/unknown ShareInfo cause quarantine, never restore approval',async()=>{
 const b=backup();
 for(const changed of [
  {...b,payload:{...b.payload,GridCollection:{...b.payload.GridCollection,Grids:{}}}},
  {...b,payload:{...b.payload,ShareInfo:{code:'private-secret'}}},
  {...b,payload:{...b.payload,StateFlags:16},deleted:true,
    source:{...b.source,activeSlotOrdinalZeroBased:null}}
 ]){
  const out=await inspectNativePresetLocalFileBytes(bytes(changed));
  assert.equal(out.localFileReady,true);
  assert.equal(out.status,'LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS');
  assert.equal(out.backups[0].quarantine,true);
  off(out);
 }
});
test('oversize, invalid UTF8, pollution keys, unknown ToM format fail closed offline',async()=>{
 const b=backup(),valid=JSON.stringify(b);
 const testInputs=[
  new Uint8Array(0),new Uint8Array([0xff,0xfe]),
  enc.encode(valid.replace('"version":1','"__proto__":{"x":true},"version":1')),
  enc.encode(valid.replace('"version":1','"constructor":{"prototype":{"x":1}},"version":1')),
  bytes({schema:'native-tom-design@unknown',version:1}),
  new Uint8Array(NATIVE_LOCAL_PRESET_FILE_MAX_BYTES+1)
 ];
 for(const input of testInputs){
  const r=await inspectNativePresetLocalFileBytes(input);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.localFileReady,false);
  off(r);
 }
 const t=inspectNativeToMLocalFileContract();
 assert.equal(t.status,'BLOCKED');
 assert.equal(t.code,'NATIVE_TOM_FORMAT_AND_OWNER_PROVENANCE_NOT_YET_VERIFIED');
 assert.equal(NATIVE_LOCAL_TOM_FILE_SUPPORTED,false);
});
test('reference catalog1250 vs Worker1253 must never manufacture Owned, progress or denominator',()=>{
 const index=JSON.parse(readFileSync('static/ddv/collection/v1.25/index.json','utf8'));
 const receipt={contract:'wand.local.save-session.read@1',platform:'switch',
  fullVersion:'1.25.3',buildKind:'switch-bid',buildId:'9A239D3DB569756D',
  schema:626,sourceIdentity:'externally-attested-switch-bid',
  sourceSha256:'a'.repeat(64),sessionId:'b'.repeat(32),
  revision:0,indexGeneration:1,writerAuthorized:false};
 const caps={contract:'wand.local.save-session.read@1',sessionOwner:'worker-singleton',
  readInventory:false,readOwnership:false,
  canCommit:false,canEncodeEditedCopy:false,canApply:false,canReplaceOriginal:false};
 const r=describeItemPersonalOverlay({referenceIndex:index,
  sessionBridge:{getSession:()=>receipt,getCapabilities:()=>caps}});
 assert.equal(r.status,'REFERENCE_ONLY');
 assert.equal(r.reason,'CATALOG_AND_LOCAL_SAVE_BUILD_MISMATCH');
 assert.equal(r.itemState.owned,'UNKNOWN');
 assert.equal(r.itemState.discovered,'UNKNOWN');
 assert.equal(r.itemState.missing,'UNKNOWN');
 assert.equal(r.itemState.entryDenominator,null);
 assert.equal(r.itemState.uniqueDenominator,null);
 assert.equal(r.canShowPercentage,false);
 assert.equal(r.canQueryItemFromExistingWorker,false);
 assert.equal(r.canWriteSave,false);
 assert.equal(ITEM_OVERLAY_PRODUCT_ENABLED,false);
 assert.equal(ITEM_OVERLAY_WRITER_ENABLED,false);
 assert.ok(ITEM_OVERLAY_TYPED_READ_PLAN.every(x=>x.apiAvailableOnPR383===false));
});
test('manager sources local-only file, manual backup, disabled game restore and no Upload path',()=>{
 const code=readFileSync('src/lib/presets/NativePresetManager.svelte','utf8');
 assert.match(code,/inspectNativePresetLocalFileBytes\(new Uint8Array\(await file\.arrayBuffer\(\)\)\)/);
 assert.match(code,/file\.size>NATIVE_LOCAL_PRESET_FILE_MAX_BYTES/);
 assert.match(code,/localStorage\.setItem\(/);
 assert.match(code,/URL\.createObjectURL\(blob\)/);
 assert.match(code,/disabled title=\{copy\.blocked\}>\{copy\.restore\}/);
 assert.match(code,/disabled title=\{copy\.blocked\}>\{copy\.push\}/);
 assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|sendBeacon|CommunityLabClient|supabase\.storage/);
});
