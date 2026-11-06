// 04 QR-W PR672 repaired-head new-only independent changed risk.
// Synthetic schema624 local-file JSON; never native DDV Save or ToM application.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {webcrypto} from "node:crypto";
import {inspectNativePresetLocalFileBytes,inspectNativeToMLocalFileContract}
 from "../src/lib/presets/native-local-file-import-contract.mjs";
import {nativeLocalPresetQuarantineWarnings}
 from "../src/lib/presets/native-local-preset-quarantine.mjs";

const SOURCE="cc1cec6c385279f5eedaf81684fbb464728fffc7";
const OLD="90f8cfaf79a4dada266a59e76f4841f1a1fe2295";
const SOURCE_BLOBS=new Map([
 ["src/lib/presets/native-local-file-import-contract.mjs","9ee79fb05b495950add726aeb38f68971aea43bb"],
 ["src/lib/presets/native-local-preset-quarantine.mjs","427fc1c3ba50e8a42a0c58ef6202d18e243eb9ba"],
 ["tests/01d-native-local-preset-quarantine.test.mjs","4da6c307b4160084036a014b2109856ae93b0993"],
 ["tests/01d-native-preset-local-file-import-contract.test.mjs","15d6ae29f351f63ee663b170d7bc184f2cfc95dc"]
]);
const QA_FILES=[
 ".github/workflows/04qr-w-pr672-repair-cc1c.yml",
 "tests/04qr-w-pr672-repair-cc1c.test.mjs"
];
const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
const diff=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();

function backup(){
 return {
  schema:"wand.in-game-preset-backup@1",version:1,id:"native_QA672_FIX_SYNTH",
  source:{profileSchemaVersion:624,physicalPresetIndex:0,activeSlotOrdinalZeroBased:0},
  deleted:false,persistentWriteAuthorized:false,productApplyAuthorized:false,
  publicSharingAuthorized:false,
  payload:{
   PresetName:"SYNTHETIC PRIVATE",StateFlags:0,ShareInfo:null,
   GridCollection:{Grids:{"0":{ID:0,Objects:{"0":{ID:0,State:null}},NextGridObjectID:1}},
    DiffGrids:{},NextGridID:1},ThumbnailItems:[40000001],
   FutureOpaque:{unknown:[{must:"survive"}]}
  }
 };
}
async function inspect(entry){
 const before=structuredClone(entry);
 const data=new TextEncoder().encode(JSON.stringify(entry));
 const dataBefore=Uint8Array.from(data);
 const x=await inspectNativePresetLocalFileBytes(data,{cryptoRef:webcrypto});
 assert.deepEqual(data,dataBefore);
 assert.deepEqual(entry,before);
 assert.equal(x.localFileReady,true);
 assert.equal(x.sourceProfileSchema,624);
 assert.equal(x.sourceGameVersion,null);
 assert.equal(x.sourceBID,null);
 assert.equal(x.sourceBuildAttested,false);
 assert.equal(x.originalSourceModified,false);
 assert.equal(x.localFileWrittenByThisFunction,false);
 assert.equal(x.gameSaveApplyAuthorized,false);
 assert.equal(x.saveWriterAuthorized,false);
 assert.equal(x.publicSharingAuthorized,false);
 assert.equal(x.communityPresetCreated,false);
 assert.deepEqual(x.backups[0].backup.payload,before.payload);
 return x;
}
test("QR672 fixed Source4 SHA and only 3 repair changes + QA2",()=>{
 assert.equal(git("rev-parse",SOURCE),SOURCE);
 assert.deepEqual(diff(OLD,SOURCE),[
  "src/lib/presets/native-local-preset-quarantine.mjs",
  "tests/01d-native-local-preset-quarantine.test.mjs",
  "tests/01d-native-preset-local-file-import-contract.test.mjs"]);
 for(const [file,sha] of SOURCE_BLOBS)assert.equal(git("hash-object",file),sha,file);
 assert.deepEqual(diff(SOURCE,"HEAD"),QA_FILES);
});
test("QR672 old RED SubGrid record with missing/wrong GridID quarantines actual file import",async()=>{
 for(const idShape of [{},{GridID:null},{GridID:"2"},{GridID:-1},{GridID:1.5},{GridID:true}]){
  const b=backup();b.payload.GridCollection.Grids["0"].Objects["0"].State={SubGrid:idShape};
  const pre=structuredClone(b.payload);
  assert.ok(nativeLocalPresetQuarantineWarnings(b.payload).includes("SUBGRID_REFERENCE_MALFORMED"),
   "must quarantine "+JSON.stringify(idShape));
  const r=await inspect(b);
  assert.equal(r.status,"LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS");
  assert.equal(r.backups[0].quarantine,true);
  assert.ok(r.backups[0].structuralWarnings.includes("SUBGRID_REFERENCE_MALFORMED"));
  assert.deepEqual(r.backups[0].backup.payload,pre);
 }
});
test("QR672 old RED malformed DiffGrids entries quarantine with no payload loss",async()=>{
 for(const invalid of [null,42,false,"bad",[],3.5]){
  const b=backup();b.payload.GridCollection.DiffGrids={"9":invalid};
  assert.ok(nativeLocalPresetQuarantineWarnings(b.payload).includes("DIFF_GRIDS_MALFORMED"));
  const r=await inspect(b);
  assert.equal(r.status,"LOCAL_FILE_VALIDATED_WITH_QUARANTINED_BACKUPS");
  assert.equal(r.backups[0].quarantine,true);
  assert.ok(r.backups[0].structuralWarnings.includes("DIFF_GRIDS_MALFORMED"));
 }
});
test("QR672 legal nonnegative integer SubGrid & record DiffGrids retain opaque fields without writer",async()=>{
 for(const gid of [0,2]){
  const b=backup();b.payload.GridCollection.Grids["0"].Objects["0"].State={SubGrid:{GridID:gid,FutureField:{"owner":"unknown"}}};
  b.payload.GridCollection.DiffGrids={"9":{UnknownOpaque:{"code":7}}};
  const r=await inspect(b);
  assert.equal(r.status,"LOCAL_FILE_VALIDATED_PRESERVE_ONLY");
  assert.equal(r.backups[0].quarantine,false);
  assert.deepEqual(r.backups[0].structuralWarnings,[]);
  assert.equal(r.backups[0].nativeGameSaveApplyAuthorized,false);
 }
});
test("QR672 no implicit schema626 or ToM/Community permission after repair",async()=>{
 const b=backup();b.source.profileSchemaVersion=626;
 const bytes=new TextEncoder().encode(JSON.stringify(b));
 const r=await inspectNativePresetLocalFileBytes(bytes,{cryptoRef:webcrypto});
 assert.equal(r.status,"BLOCKED");
 assert.equal(r.gameSaveApplyAuthorized,false);
 const tom=inspectNativeToMLocalFileContract();
 assert.equal(tom.status,"BLOCKED");
 assert.equal(tom.sourceBuildAttested,false);
 assert.equal(tom.publicSharingAuthorized,false);
});
