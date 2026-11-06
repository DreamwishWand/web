// 04 QR-W / independent PR672 changed-only PC schema624 import integrity QA.
// Synthetic JSON backup only; never a real Steam/Switch Save, Native Writer, ToM or cloud.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {webcrypto} from "node:crypto";
import {
  inspectNativePresetLocalFileBytes,
  inspectNativeToMLocalFileContract
} from "../src/lib/presets/native-local-file-import-contract.mjs";
import {nativeLocalPresetQuarantineWarnings}
  from "../src/lib/presets/native-local-preset-quarantine.mjs";

const SOURCE="90f8cfaf79a4dada266a59e76f4841f1a1fe2295";
const MAIN="5bc658f119aec1d08138e10bf8294700c74bd700";
const files=new Map([
  ["src/lib/presets/native-local-file-import-contract.mjs","9ee79fb05b495950add726aeb38f68971aea43bb"],
  ["src/lib/presets/native-local-preset-quarantine.mjs","cb084732bdf15f69e41cc6cf41ec082e719bcba4"],
  ["tests/01d-native-local-preset-quarantine.test.mjs","9622f8ed6376cf4950fbe925fbbac91f343ed726"]
]);
const qaFiles=[
  ".github/workflows/04qr-w-pr672-native-preset-structural.yml",
  "tests/04qr-w-pr672-native-preset-structural.test.mjs"
];
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const paths=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();
const bytes=x=>new TextEncoder().encode(JSON.stringify(x));
function cleanBackup(){
  return {
    schema:"wand.in-game-preset-backup@1",version:1,id:"native_SYNTHETIC_QA",
    source:{profileSchemaVersion:624,physicalPresetIndex:0,activeSlotOrdinalZeroBased:0},
    deleted:false,persistentWriteAuthorized:false,
    productApplyAuthorized:false,publicSharingAuthorized:false,
    payload:{
      PresetName:"SYNTHETIC PRIVATE",StateFlags:0,ShareInfo:null,
      GridCollection:{
        Grids:{"0":{ID:0,Objects:{"0":{ID:0,State:null}},NextGridObjectID:1}},
        DiffGrids:{},NextGridID:1
      },
      ThumbnailItems:[40000001],FutureNativeOpaque:{newKey:[1,{anything:"preserve"}]}
    }
  };
}
async function inspect(x){
  const b=bytes(x),original=Uint8Array.from(b);
  const r=await inspectNativePresetLocalFileBytes(b,{cryptoRef:webcrypto});
  assert.deepEqual(b,original,"The imported bytes must not be modified");
  assert.equal(r.sourceBuildAttested,false);
  assert.equal(r.sourceGameVersion,null);
  assert.equal(r.sourceBID,null);
  assert.equal(r.originalSourceModified,false);
  assert.equal(r.localFileWrittenByThisFunction,false);
  assert.equal(r.gameSaveApplyAuthorized,false);
  assert.equal(r.saveWriterAuthorized,false);
  assert.equal(r.publicSharingAuthorized,false);
  assert.equal(r.communityPresetCreated,false);
  return r;
}
test("QR672 original Source3 Git SHA and QA-only2 exact scope",()=>{
  assert.equal(git("rev-parse",SOURCE),SOURCE);
  assert.deepEqual(paths(MAIN,SOURCE),[...files.keys()].sort());
  for(const [path,blob] of files)assert.equal(git("hash-object",path),blob,path);
  assert.deepEqual(paths(SOURCE,"HEAD"),qaFiles);
});
test("QR672 clean schema624 backup remains preservation-only and unknown JSON retained",async()=>{
  const x=cleanBackup();
  const r=await inspect(x);
  assert.equal(r.status,"LOCAL_FILE_VALIDATED_PRESERVE_ONLY");
  assert.equal(r.localFileReady,true);
  assert.equal(r.backups[0].quarantine,false);
  assert.deepEqual(r.backups[0].structuralWarnings,[]);
  assert.deepEqual(r.backups[0].backup.payload.FutureNativeOpaque,x.payload.FutureNativeOpaque);
  assert.equal(r.backups[0].nativeGameSaveApplyAuthorized,false);
});
test("QR672 missing or invalid DiffGrids container leads quarantine not trusted import",async()=>{
  for(const val of [undefined,null,[],42,"wrong"]){
    const x=cleanBackup();x.payload.GridCollection.DiffGrids=val;
    const r=await inspect(x);
    assert.equal(r.status,"LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS");
    assert.equal(r.backups[0].quarantine,true);
    assert.ok(r.backups[0].structuralWarnings.includes("DIFF_GRIDS_MALFORMED"));
  }
});
test("QR672 malformed Objects or Object record and primitive State quarantine",async()=>{
  for(const xform of [
    x=>{x.payload.GridCollection.Grids["0"].Objects=null},
    x=>{x.payload.GridCollection.Grids["0"].Objects=[]},
    x=>{x.payload.GridCollection.Grids["0"].Objects["0"]=null},
    x=>{x.payload.GridCollection.Grids["0"].Objects["0"].State=[]},
    x=>{x.payload.GridCollection.Grids["0"].Objects["0"].State="bad"},
    x=>{x.payload.GridCollection.Grids["0"].Objects["0"].State={SubGrid:[]}}
  ]){
    const x=cleanBackup();xform(x);
    const r=await inspect(x);
    assert.equal(r.status,"LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS");
    assert.equal(r.backups[0].quarantine,true);
  }
});
test("QR672 invalid thumbnail integers cannot be silently coerced",async()=>{
  for(const thumb of [0,-1,2.5,"40000001",null,[],true]){
    const x=cleanBackup();x.payload.ThumbnailItems=[thumb];
    const r=await inspect(x);
    assert.equal(r.status,"LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS");
    assert.ok(r.backups[0].structuralWarnings.includes("THUMBNAIL_ITEM_ID_MALFORMED"));
  }
});
test("QR672 structurally incomplete SubGrid object must quarantine not be treated as valid",async()=>{
  // A record object without an integer GridID is not a verified native parent link.
  for(const sub of [{},{GridID:null},{GridID:"2"},{GridID:-1},{GridID:2.5}]){
    const x=cleanBackup();x.payload.GridCollection.Grids["0"].Objects["0"].State={SubGrid:sub};
    const warnings=nativeLocalPresetQuarantineWarnings(x.payload);
    assert.ok(warnings.includes("SUBGRID_REFERENCE_MALFORMED"),
      "Invalid record-typed SubGrid incorrectly escaped structural warning: "+JSON.stringify(sub));
    const r=await inspect(x);
    assert.equal(r.status,"LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS");
    assert.equal(r.backups[0].quarantine,true);
    assert.equal(r.backups[0].nativeGameSaveApplyAuthorized,false);
  }
});
test("QR672 malformed DiffGrids entries cannot disappear behind an object-shaped map",async()=>{
  // The container being a plain record alone does not authenticate its entries.
  const x=cleanBackup();
  x.payload.GridCollection.DiffGrids={"9":null};
  const warnings=nativeLocalPresetQuarantineWarnings(x.payload);
  assert.ok(warnings.includes("DIFF_GRIDS_MALFORMED"),
    "Invalid DiffGrid entry must force preservation-only quarantine");
  const r=await inspect(x);
  assert.equal(r.status,"LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS");
});
test("QR672 other version, ToM format and public apply remain OFF",async()=>{
  const x=cleanBackup();x.source.profileSchemaVersion=626;
  const r=await inspectNativePresetLocalFileBytes(bytes(x),{cryptoRef:webcrypto});
  assert.equal(r.status,"BLOCKED");
  assert.equal(r.gameSaveApplyAuthorized,false);
  const tom=inspectNativeToMLocalFileContract();
  assert.equal(tom.status,"BLOCKED");
  assert.equal(tom.sourceBuildAttested,false);
  assert.equal(tom.publicSharingAuthorized,false);
});
