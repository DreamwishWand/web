import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SINGLEFENCE_PROOF9_BASE as base,SINGLEFENCE_PROOF9_BID as build,
 SINGLEFENCE_PROOF9_PINS as pins,SINGLEFENCE_PROOF9_ALLOWED_DIFF as allowed,
 verifySteamSingleFenceProof9Preflight as check} from '../scripts/readonly-release/steam-singlefence-proof9-preflight.mjs';
const candidate='a'.repeat(40);
function fixture(){
 return {repositoryId:1371485649,protectedMain:base,parent:base,candidate,buildId:build,
  changedPaths:[...allowed],blobs:Object.fromEntries(pins.map(p=>[p.path,{sha:p.sha,mode:p.mode,type:p.type}]))};
}
const refused=x=>assert.throws(()=>check(x),/SINGLEFENCE_PROOF9_PREFLIGHT_DENIED/);
test('SingleFence Proof9 pins exact independent Source preflight ONLY, no release authority',()=>{
 const receipt=check(fixture());
 assert.equal(receipt.status,'SINGLEFENCE_PROOF9_SOURCE_PINS_EXACT_ONLY');
 assert.equal(receipt.pinCount,pins.length);
 for(const k of ['proofDispatched','signedSubjectsVerified','realEncryptedSaveV2Verified',
  'releaseAuthorized','writerAuthorized','operationOn'])assert.equal(receipt[k],false);
 assert.equal(receipt.protectedMain,base);assert.equal(receipt.exactBuildId,build);
});
test('SingleFence Proof9 rejects missing, changed, forged and extra protected inputs',()=>{
 for(const pin of pins){
  const miss=fixture();delete miss.blobs[pin.path];refused(miss);
  const changed=fixture();changed.blobs[pin.path].sha='f'.repeat(40);refused(changed);
  const mode=fixture();mode.blobs[pin.path].mode='100755';refused(mode);
  const type=fixture();type.blobs[pin.path].type='tree';refused(type);
 }
 const extra=fixture();extra.blobs['private-original.p1g']={sha:'f'.repeat(40),mode:'100644',type:'blob'};refused(extra);
});
test('SingleFence Proof9 rejects stale main and permissive dispatch variants',()=>{
 const revisions=[
  {repositoryId:0},{protectedMain:'b'.repeat(40)},{parent:'b'.repeat(40)},
  {candidate:base},{candidate:'HEAD'},{buildId:'Switch626/9A239D3DB569756D'},
  {changedPaths:[]},{changedPaths:[...allowed,'src/lib/ddv/core/save/product-rust-wasm-release-trust.mjs']},
  {changedPaths:[allowed[0],allowed[0]]},{changedPaths:[...allowed].reverse(),writerAuthorized:true}
 ];
 for(const delta of revisions)refused(Object.assign(fixture(),delta));
});
test('SingleFence Proof9 never accepts user flags, mutable result, or signing authority',()=>{
 const a=fixture();a.signedSubjectsVerified=true;refused(a);
 const b=fixture();b.writerEnabled=true;refused(b);
 const c=fixture();c.operationOn=true;refused(c);
 const result=check(fixture());assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(pins));
});
