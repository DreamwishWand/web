// 04 QR-W independent WEP PR683 NEW_ONLY changed-risk QA.
// Synthetic packaged P1G fixtures only. Real Steam Save V1/V2/V3 stays NOT_RUN.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {makeSyntheticP1gProfile} from "./helpers/p1g-fixture.mjs";
import {openWorldSaveBytes, WEP_WORLD_READONLY_626_PROVENANCE} from "../src/lib/wep/world-save-source.ts";
import {worldReadonlyCopy,WORLD_READONLY_COPY_LOCALES} from "../src/lib/wep/world-readonly-copy.js";

const SRC="0de7a828b2aa4104980727a6d77c7277aac3db02";
const MAIN="5bc658f119aec1d08138e10bf8294700c74bd700";
const pins=new Map([
 ["docs/wep/world-editor-localization-inventory-20261002.json","845926ea15316549ee13b389dd0d0e7f6dd3b4a8"],
 ["scripts/wep-schema626-readonly-browser-acceptance.mjs","049f17942e4626fea27b7a784648adae028eed8c"],
 ["src/lib/wep/world-readonly-copy.js","0db2b06c03502f0559b2dd86984ff54aa728d832"],
 ["src/lib/wep/world-save-source.ts","0ed344b94574911c5d797032b5d315a2176194a8"],
 ["src/routes/editor/world/+page.svelte","499929500bf61d20a2e670b89780e507e17a3118"],
 ["tests/wep-world-readonly626.test.mjs","1a8c9eb5cf50bf60fa06c713397b4013e3d76015"]
]);
const qaPaths=[
 ".github/workflows/04qr-w-pr683-steam626-independent.yml",
 "scripts/04qr-w-pr683-steam626-chrome.mjs",
 "tests/04qr-w-pr683-steam626-independent.test.mjs"
];
const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
const delta=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();
function base(){
 return {
  GameInfo:{Version:626,InitialVersion:518,LastSaveDeviceInfo:{deviceType:"DeviceType_Switch"}},
  Player:{OpaqueUser:{keep:"safely in memory"}},
  World:{
   Villages:[{Areas:{"1":{GridIDs:[7],Unlocked:true}}}],
   GridCollection:{Grids:{"7":{ID:7,Objects:{"1":{State:{FutureUnknown:8}}}}}}
  },
  FutureRoot:{opaque:["untouched",8]}
 };
}
async function open(p,opt={sourcePlatform:"steam-windows"}){
 const buf=makeSyntheticP1gProfile(p),previous=Uint8Array.from(buf);
 const out=await openWorldSaveBytes(buf,opt);
 assert.deepEqual(buf,previous,"Synthetic original input must remain byte-for-byte unchanged");
 assert.equal(out.inputFormat,"packaged");
 assert.equal(out.profileSchemaVersion,626);
 assert.equal(out.saveIdentity.sourcePlatform,"steam-windows");
 assert.equal(out.compatibility.readContract,"wep-steam626-local-structural-inspection-only@1");
 assert.equal(out.compatibility.gameVersion,"UNKNOWN");
 assert.equal(out.compatibility.exactBuildKnown,false);
 assert.equal(out.compatibility.productionReadAccepted,false);
 assert.equal(out.compatibility.readOnly,true);
 for(const cap of ["routesAuthorized","editingAuthorized","verifiedReplacementCandidateAuthorized",
                   "productApplyAuthorized","persistentWriteAuthorized"])
  assert.equal(out.compatibility[cap],false,"not authorized: "+cap);
 assert.deepEqual(out.areas,[]);
 assert.deepEqual(out.floatingIslands,[]);
 assert.deepEqual(out.profile.FutureRoot,p.FutureRoot);
 return out;
}
test("QR683 fixed source six Git SHA + QA-only three tree",()=>{
 assert.equal(git("rev-parse",SRC),SRC);
 assert.deepEqual(delta(MAIN,SRC),[...pins.keys()].sort());
 for(const [path,sha] of pins)assert.equal(git("hash-object",path),sha,path);
 assert.deepEqual(delta(SRC,"HEAD"),qaPaths);
});
test("QR683 later absent Village Areas globally UNKNOWN, valid earlier village not false total",async()=>{
 const p=base();p.World.Villages.push({FutureUnknown:{"hold":true}});
 const out=await open(p);
 assert.equal(out.structuralDiagnostics.villageCount,2);
 assert.equal(out.structuralDiagnostics.areaRecordCount,null);
 assert.equal(out.structuralDiagnostics.gridRecordCount,1);
 assert.equal(out.structuralDiagnostics.gridObjectEntryCount,1);
 assert.ok(out.structuralDiagnostics.notes.includes("WEP_STEAM626_FULLVERSION_UNKNOWN"));
});
test("QR683 earlier empty Village & later complete valid map remain zero vs later missing",async()=>{
 const p=base();p.World.Villages=[{Areas:{}},{Areas:{}}];
 p.World.GridCollection.Grids={"7":{ID:7,Objects:{}}};
 const o=await open(p);
 assert.equal(o.structuralDiagnostics.areaRecordCount,0);
 assert.equal(o.structuralDiagnostics.gridObjectEntryCount,0);
 const q=structuredClone(p);delete q.World.Villages[1].Areas;
 assert.equal((await open(q)).structuralDiagnostics.areaRecordCount,null);
});
test("QR683 multiple Grids: absent Objects map makes total UNKNOWN even with valid sibling",async()=>{
 const p=base();
 p.World.GridCollection.Grids["9"]={ID:9,FutureOpaque:{keep:true}};
 const o=await open(p);
 assert.equal(o.structuralDiagnostics.gridRecordCount,2);
 assert.equal(o.structuralDiagnostics.gridObjectEntryCount,null);
 const q=structuredClone(p);q.World.GridCollection.Grids["9"].Objects={};
 assert.equal((await open(q)).structuralDiagnostics.gridObjectEntryCount,1);
});
test("QR683 cross-save last device Switch not spoofed as exact Steam build, forged authority rejected",async()=>{
 const p=base();const q=await open(p);
 assert.equal(q.saveIdentity.sourceLastSaveRelationship,"DIFFERENT_CROSS_SAVE_POSSIBLE");
 const b=makeSyntheticP1gProfile(p);
 for(const spoof of [
  {sourcePlatform:"steam-windows",targetBuild:{platform:"steam-windows",kind:"steam-full-version",value:"fake"}},
  {sourcePlatform:"steam-windows",sourceEvidence:WEP_WORLD_READONLY_626_PROVENANCE},
  {sourcePlatform:"unknown"},
  {sourcePlatform:"switch",targetBuild:{platform:"steam-windows",kind:"steam-full-version",value:"fake"}}
 ])await assert.rejects(()=>openWorldSaveBytes(b,spoof),/SOURCE_VERIFICATION_REQUIRED/);
});
test("QR683 only packaging accepted, 8 locale UNKNOWN and no Writer/Undo/canvas authority",async()=>{
 const p=base();
 await assert.rejects(()=>openWorldSaveBytes(new TextEncoder().encode(JSON.stringify(p)),{sourcePlatform:"steam-windows"}),/626_PACKAGED_SOURCE_REQUIRED/);
 const ui=readFileSync("src/routes/editor/world/+page.svelte","utf8");
 assert.ok(ui.includes("data-wep-steam626-limited"));
 assert.ok(ui.includes("data-wep-steam626-undo-preview"));
 assert.ok(ui.includes("exactBuildKnown=false · productionReadAccepted=false · routesAuthorized=false"));
 assert.ok(ui.includes("sourcePlatform === 'switch' && sourceProvenanceConfirmed"));
 for(const locale of WORLD_READONLY_COPY_LOCALES){
  const copy=worldReadonlyCopy(locale);
  for(const key of ["steamViewing","steamProof","steamBoundary","steamPreview","unknown"]){
    assert.ok(typeof copy[key]==="string"&&copy[key].length>4,locale+key);
  }
  assert.ok(copy.steamProof.includes("UNKNOWN"),locale+" source not presumed");
 }
});
