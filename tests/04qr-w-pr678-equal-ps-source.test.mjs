// 04 QR-W independent PR678 Typed P=S syntax-only, no Native/public promotion.
// Fixed-HEAD source3 and new QA3; no private Save or game media used.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {
  makeEntityRef,createSharedEntityRegistry,nativeEntityPath
} from "../src/lib/entity/shared-entity-identity.mjs";

const MAIN="5bc658f119aec1d08138e10bf8294700c74bd700";
const SOURCE="58ff476c150ea66cd91f51061a0e72ece63714d4";
const SourceBlobs=new Map([
 ["scripts/web-typed-entity-boundary-chrome.mjs","276ba233598babea8d10120cf37cb6bb821930ea"],
 ["src/lib/foundation/SharedTypedEntityGate.svelte","2b000fe522f006a56500351446822b198d3e7e3d"],
 ["tests/shared-typed-entity-boundary.test.mjs","a883389746a2f92ce0e4393030139d8c1d9386a5"]
]);
const QA_FILES=[
 ".github/workflows/04qr-w-pr678-equal-ps-independent.yml",
 "scripts/04qr-w-pr678-equal-ps-chrome.mjs",
 "tests/04qr-w-pr678-equal-ps-source.test.mjs"
];
const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
const changed=(a,b)=>git("diff","--name-only",a,b).split("\n").filter(Boolean).sort();
const gate=readFileSync("src/lib/foundation/SharedTypedEntityGate.svelte","utf8");
const scope={platform:"Nintendo Switch",fullVersion:"1.25.0",
 bid:"52BD625D9B4E0053",schema:624,dlc:[]};

test("QR678 source3 pinned and QA3-only direct checkout, inherited merge source cannot mutate source3",()=>{
  assert.equal(git("rev-parse",SOURCE),SOURCE);
  assert.deepEqual(changed(MAIN,SOURCE),[...SourceBlobs.keys()].sort());
  for(const [file,sha] of SourceBlobs)assert.equal(git("hash-object",file),sha,file);
  const changedPaths=changed(SOURCE,"HEAD");
  for(const path of QA_FILES)assert.ok(changedPaths.includes(path),path);
  if(process.env.GITHUB_WORKFLOW!=="CI")
    assert.deepEqual(changedPaths,QA_FILES);
  else
    for(const x of SourceBlobs.keys())assert.equal(changedPaths.includes(x),false,x);
});
test("QR678 equal P=S allowed only shape; even correct version empty registry NOT_FOUND",()=>{
 const ref=makeEntityRef({kind:"ITEM",primaryId:"40000047",secondaryId:"40000047"});
 assert.deepEqual(ref,{kind:"ITEM",primaryId:"40000047",secondaryId:"40000047"});
 assert.equal(createSharedEntityRegistry([]).resolveNative("40000047","40000047",scope).status,"NOT_FOUND");
 const candidate=nativeEntityPath(ref,"ja");
 assert.equal(candidate,"/ja/40000047/40000047/");
 assert.equal(ref.primaryId,ref.secondaryId);
});
test("QR678 forged numeric ID and kind cannot mint P=S tuple",()=>{
 for(const x of ["0","0001","-1","1e3","9007199254740992","40000047/1","4%2F2",""]){
  assert.throws(()=>makeEntityRef({kind:"ITEM",primaryId:x,secondaryId:x}),/SHARED_ENTITY_/);
 }
 for(const kind of ["", "ENTRY","UNKNOWN","item","CREATOR", "WORK","PRESET"]){
  assert.throws(()=>makeEntityRef({kind,primaryId:"40000047",secondaryId:"40000047"}),/SHARED_ENTITY_/);
 }
 assert.throws(()=>makeEntityRef({kind:"QUEST",primaryId:"40000047",secondaryId:"0001"}),/SHARED_ENTITY_/);
});
test("QR678 UI uses sole PRODUCT parser, not local registry or source authority",()=>{
 assert.match(gate,/import \{ makeEntityRef \} from '\$lib\/entity\/shared-entity-identity\.mjs'/);
 assert.match(gate,/makeEntityRef\(\{kind:'ITEM',primaryId:primary,secondaryId:secondary\}\)/);
 for(const bad of ["primaryId !== secondaryId","parseSharedPrimaryId(","resolveNative(","createSharedEntityRegistry(","fetch(","localStorage","getLocalSaveSessionBridge","publishWork("]){
  assert.equal(gate.includes(bad),false,bad);
 }
 assert.match(gate,/noindex,nofollow/);
 for(const proof of [
  'data-typed-entity-gate="closed"','data-public-indexable="false"',
  'data-writer="off"','data-provider="off"','data-relations-verified="false"',
  'data-alias-resolved="false"','data-personal-state="unknown"'
 ]) assert.ok(gate.includes(proof),proof);
 assert.doesNotMatch(gate,/<img|<picture|srcset|<form|rel="canonical"|hreflang/);
});
