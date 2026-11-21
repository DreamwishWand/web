// 04 QR-W independent new-only adversarial QA for 01B PR666 fixed Source f431953f.
// All fixtures are constructed synthetic 626; this does NOT validate real Steam/Switch P1G.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {read626SpatialReferences,inspect626SourceObjectAtRevision}
  from "../src/lib/wep/real-save-spatial-source.ts";

const SOURCE="f431953f04305a17f75d700d6acf6a7da3f82ccd";
const MAIN="d953f2e064b41ade8fa630bb5b50c37d8417a79c";
const TS="src/lib/wep/real-save-spatial-source.ts";
const ST="tests/01b-real-save-spatial-source.test.mjs";
const OWN_BLOBS=new Map([[TS,"bf0d027e811da59f009c963b49f2d9aa80032ac6"],[ST,"65322830c8c3cc3fe5bb88a9df0c8bc432b6ef9b"]]);
const QA_FILES=[
 ".github/workflows/04qr-w-pr666-village-areas-independent.yml",
 "tests/04qr-w-pr666-village-areas-independent.test.mjs"
];
const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
const changed=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();

const sha="a".repeat(64);
const ctx={platform:"Nintendo Switch",gameVersion:"1.25.3",bid:"9A239D3DB569756D",schema:626,sourceRevision:"epoch:qa",sourceSha256:sha};
const grid=(id,objs={})=>({ID:id,GridDataPath:"World/Synthetic",Objects:objs});
const obj=id=>({ID:id,ItemID:40000101,X:12,Y:19,Orientation:"GridOrientation_Up",State:null});
const rootVillage=()=>({Areas:{"1":{GridIDs:[42],Unlocked:true}}});
const profile=(villages=[rootVillage()])=>({
  GameInfo:{Version:626},
  World:{
    Villages:villages,
    GridCollection:{Grids:{"42":grid(42,{"7":obj(7)})},DiffGrids:{}}
  }
});
function inspect(index,rev=ctx.sourceRevision,hash=sha){
  return inspect626SourceObjectAtRevision(index,"g42:o7",rev,hash);
}
function assertReadOnly(i) {
  assert.equal(i.persistentWriteAuthorized,false);
  assert.equal(i.productApplyAuthorized,false);
  assert.equal(i.directSourceReplacementAuthorized,false);
  assert.equal(i.geometryFor2d,"NOT_VERIFIED");
  assert.equal(i.nativePlacementVerified,false);
}

test("QR666 source original2 blobs plus QA-only2 and trusted Switch626 identity",()=>{
  assert.equal(git("rev-parse",SOURCE),SOURCE);
  assert.deepEqual(changed(MAIN,SOURCE),[...OWN_BLOBS.keys()].sort());
  for(const [path,blob] of OWN_BLOBS)assert.equal(git("hash-object",path),blob,path);
  assert.deepEqual(changed(SOURCE,"HEAD"),QA_FILES);
  assert.throws(()=>read626SpatialReferences(profile(),{...ctx,schema:624}),/SPATIAL_EXACT_VERSION_BID_SCHEMA_REQUIRED/);
  assert.throws(()=>read626SpatialReferences(profile(),{...ctx,bid:"52BD625D9B4E0053"}),/SPATIAL_EXACT_VERSION_BID_SCHEMA_REQUIRED/);
});

test("QR666 corruption in later Village globally vetoes otherwise valid root inspector",()=>{
  for(const invalid of [null,0,false,"corrupt",[],{}, {Areas:null},{Areas:[]},{Areas:""},{Areas:42}]){
    const index=read626SpatialReferences(profile([rootVillage(),invalid]),ctx);
    assert.equal(index.status,"REFERENCE_ERRORS_FAIL_CLOSED",JSON.stringify(invalid));
    assert.deepEqual(index.issues.filter(i=>i.code==="SPATIAL_VILLAGE_AREAS_REQUIRED").map(i=>i.detail),["v1"]);
    assert.equal(index.objects.length,1);
    assert.equal(index.objects[0].relation,"AREA_ROOT"); // valid object not silently omitted
    assert.throws(()=>inspect(index),/SPATIAL_SOURCE_GRID_REFERENCE_UNRESOLVED/);
    assertReadOnly(index);
  }
});

test("QR666 corruption before good Village cannot be masked by later owner reference",()=>{
  const index=read626SpatialReferences(profile([{Areas:null},rootVillage()]),ctx);
  assert.equal(index.status,"REFERENCE_ERRORS_FAIL_CLOSED");
  assert.deepEqual(index.issues.filter(i=>i.code==="SPATIAL_VILLAGE_AREAS_REQUIRED").map(i=>i.detail),["v0"]);
  assert.equal(index.objects[0].relation,"AREA_ROOT");
  assert.throws(()=>inspect(index),/SPATIAL_SOURCE_GRID_REFERENCE_UNRESOLVED/);
  assertReadOnly(index);
});

test("QR666 multiple corrupt Village indices are bounded and do not collapse into empty areas",()=>{
  const index=read626SpatialReferences(profile([rootVillage(),null,{Areas:[]},{Areas:{}},{}]),ctx);
  assert.equal(index.status,"REFERENCE_ERRORS_FAIL_CLOSED");
  assert.deepEqual(index.issues.filter(i=>i.code==="SPATIAL_VILLAGE_AREAS_REQUIRED").map(i=>i.detail),["v1","v2","v4"]);
  assert.throws(()=>inspect(index),/SPATIAL_SOURCE_GRID_REFERENCE_UNRESOLVED/);
});

test("QR666 explicit empty Areas maps are valid and preserve inspector-only geometry-denial",()=>{
  for(const villages of [
    [rootVillage(),{Areas:{}}],
    [{Areas:{}},rootVillage()],
    [rootVillage(),{Areas:{}},{Areas:{}}]
  ]){
    const index=read626SpatialReferences(profile(villages),ctx);
    assert.equal(index.status,"READ_ONLY_REFERENCE_INDEX");
    assert.deepEqual(index.issues,[]);
    const found=inspect(index);
    assert.equal(found.address.editorId,"g42:o7");
    assert.equal(found.relation,"AREA_ROOT");
    assert.equal(found.geometryFor2d,"NOT_VERIFIED");
    assert.equal(found.persistentWriteAuthorized,false);
    assertReadOnly(index);
  }
});

test("QR666 failed source cannot use spoofed epoch or stale hash to bypass global veto",()=>{
  const index=read626SpatialReferences(profile([rootVillage(),{Areas:null}]),ctx);
  assert.throws(()=>inspect(index,"epoch:attacker"),/SPATIAL_SOURCE_REVISION_OR_HASH_STALE/);
  assert.throws(()=>inspect(index,ctx.sourceRevision,"b".repeat(64)),/SPATIAL_SOURCE_REVISION_OR_HASH_STALE/);
  assert.throws(()=>inspect(index),/SPATIAL_SOURCE_GRID_REFERENCE_UNRESOLVED/);
  assertReadOnly(index);
});

test("QR666 source index cloned by UI is not accepted as Core-minted source reference",()=>{
  const index=read626SpatialReferences(profile([rootVillage(),{Areas:{}}]),ctx);
  const cloned=structuredClone(index);
  assert.throws(()=>inspect(cloned),/SPATIAL_SOURCE_INDEX_NOT_MINTED/);
  assertReadOnly(index);
});
