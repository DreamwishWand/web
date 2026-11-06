// 04 QR-W PR683 independent NEW_ONLY: Steam626 V1 structure and provenance.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { openWorldSaveBytes, WEP_WORLD_READONLY_626_PROVENANCE } from "../src/lib/wep/world-save-source.ts";
import { makeSyntheticP1gProfile } from "./helpers/p1g-fixture.mjs";

const BASE="5bc658f119aec1d08138e10bf8294700c74bd700";
const SOURCE="0de7a828b2aa4104980727a6d77c7277aac3db02";
const sourceBlobs=new Map([
  ["docs/wep/world-editor-localization-inventory-20261002.json","845926ea15316549ee13b389dd0d0e7f6dd3b4a8"],
  ["scripts/wep-schema626-readonly-browser-acceptance.mjs","049f17942e4626fea27b7a784648adae028eed8c"],
  ["src/lib/wep/world-readonly-copy.js","0db2b06c03502f0559b2dd86984ff54aa728d832"],
  ["src/lib/wep/world-save-source.ts","0ed344b94574911c5d797032b5d315a2176194a8"],
  ["src/routes/editor/world/+page.svelte","499929500bf61d20a2e670b89780e507e17a3118"],
  ["tests/wep-world-readonly626.test.mjs","1a8c9eb5cf50bf60fa06c713397b4013e3d76015"]
]);
const qaFiles=[
  ".github/workflows/04qr-w-pr683-steam626-independent.yml",
  "scripts/04qr-w-pr683-steam626-chrome.mjs",
  "tests/04qr-w-pr683-steam626-independent.test.mjs"
];
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const changed=(from,to)=>git("diff","--name-only",from,to).split("\n").filter(Boolean).sort();
const profile=()=>({
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:"DeviceType_Windows"}},
  Player:{OpaquePlayer:{extra:true}},
  World:{
    Villages:[
      {Areas:{"1":{GridIDs:[10],Unlocked:true}}},
      {Areas:{"2":{GridIDs:[11],Unlocked:false}}}
    ],
    GridCollection:{Grids:{
      "10":{ID:10,Objects:{"100":{Opaque:true}}},
      "11":{ID:11,Objects:{"101":{Opaque:true}}}
    }}
  },
  UnrecognizedRoot:{unchanged:[1,2,3]}
});
const open=async p=>openWorldSaveBytes(makeSyntheticP1gProfile(p),{sourcePlatform:"steam-windows"});

test("PR683 fixed original SIX git blobs and QA-only THREE; no Source or ancestor mutation",()=>{
  assert.equal(git("rev-parse",SOURCE),SOURCE);
  assert.deepEqual(changed(BASE,SOURCE),[...sourceBlobs.keys()].sort());
  for(const [path,blob] of sourceBlobs)assert.equal(git("hash-object",path),blob,path);
  assert.deepEqual(changed(SOURCE,"HEAD"),qaFiles);
});

test("SECOND Village missing Areas makes total UNKNOWN, not positive first-only count",async()=>{
  const p=profile();
  delete p.World.Villages[1].Areas;
  const original=makeSyntheticP1gProfile(p);
  const sha=createHash("sha256").update(original).digest("hex");
  const r=await openWorldSaveBytes(original,{sourcePlatform:"steam-windows"});
  assert.equal(createHash("sha256").update(original).digest("hex"),sha);
  assert.equal(r.structuralDiagnostics.villageCount,2);
  assert.equal(r.structuralDiagnostics.areaRecordCount,null);
  assert.equal(r.structuralDiagnostics.gridRecordCount,2);
  assert.equal(r.structuralDiagnostics.gridObjectEntryCount,2);
  assert.deepEqual(r.profile.UnrecognizedRoot,p.UnrecognizedRoot);
  assert.equal(r.compatibility.gameVersion,"UNKNOWN");
  assert.equal(r.compatibility.exactBuildKnown,false);
  assert.equal(r.compatibility.productionReadAccepted,false);
  assert.equal(r.compatibility.routesAuthorized,false);
  assert.equal(r.compatibility.editingAuthorized,false);
  assert.equal(r.compatibility.productApplyAuthorized,false);
  assert.equal(r.compatibility.persistentWriteAuthorized,false);
});

test("SECOND Grid missing Objects makes total UNKNOWN, not positive first-only count",async()=>{
  const p=profile();
  delete p.World.GridCollection.Grids["11"].Objects;
  const r=await open(p);
  assert.equal(r.structuralDiagnostics.areaRecordCount,2);
  assert.equal(r.structuralDiagnostics.gridRecordCount,2);
  assert.equal(r.structuralDiagnostics.gridObjectEntryCount,null);
  assert.deepEqual(r.areas,[]);
  assert.deepEqual(r.floatingIslands,[]);
  assert.equal(r.compatibility.readOnly,true);
  assert.equal(r.compatibility.verifiedReplacementCandidateAuthorized,false);
});

test("Malformed second nested map fails to UNKNOWN, explicit empty second map is zero/positive arithmetic",async()=>{
  const malformed=profile();
  malformed.World.Villages[1].Areas=[];
  malformed.World.GridCollection.Grids["11"].Objects=[{}];
  const r=await open(malformed);
  assert.equal(r.structuralDiagnostics.areaRecordCount,null);
  assert.equal(r.structuralDiagnostics.gridObjectEntryCount,null);
  const empty=profile();
  empty.World.Villages[1].Areas={};
  empty.World.GridCollection.Grids["11"].Objects={};
  const e=await open(empty);
  assert.equal(e.structuralDiagnostics.areaRecordCount,1);
  assert.equal(e.structuralDiagnostics.gridObjectEntryCount,1);
  assert.equal(e.structuralDiagnostics.villageCount,2);
  assert.equal(e.structuralDiagnostics.gridRecordCount,2);
});

test("User-declared Steam with Switch cross-save is never Steam version/BID proof",async()=>{
  const p=profile();p.GameInfo.LastSaveDeviceInfo.deviceType="DeviceType_Switch";
  const r=await open(p);
  assert.equal(r.saveIdentity.sourcePlatform,"steam-windows");
  assert.equal(r.compatibility.readContract,"wep-steam626-local-structural-inspection-only@1");
  assert.equal(r.compatibility.gameVersion,"UNKNOWN");
  assert.equal(r.compatibility.exactBuildKnown,false);
  assert.equal(r.compatibility.productionReadAccepted,false);
  assert.equal(r.compatibility.routesAuthorized,false);
  assert.equal(r.compatibility.editingAuthorized,false);
  assert.equal(r.compatibility.persistentWriteAuthorized,false);
});

test("Steam forged externally verified Switch source and Steam target reject, no product grant",async()=>{
  const raw=makeSyntheticP1gProfile(profile());
  await assert.rejects(()=>openWorldSaveBytes(raw,{sourcePlatform:"steam-windows",sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE}),/EXTERNAL_SOURCE_VERIFICATION_REQUIRED/);
  await assert.rejects(()=>openWorldSaveBytes(raw,{
    sourcePlatform:"steam-windows",
    targetBuild:{platform:"switch",kind:"switch-bid",value:"9A239D3DB569756D"},
    sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE
  }),/EXTERNAL_SOURCE_VERIFICATION_REQUIRED/);
  await assert.rejects(()=>openWorldSaveBytes(raw,{
    sourcePlatform:"steam-windows",
    targetBuild:{platform:"steam-windows",kind:"steam-full-version",value:"1.25.3"}
  }),/EXTERNAL_SOURCE_VERIFICATION_REQUIRED/);
  await assert.rejects(()=>openWorldSaveBytes(new TextEncoder().encode(JSON.stringify(profile())),{sourcePlatform:"steam-windows"}),/PACKAGED_SOURCE_REQUIRED/);
});