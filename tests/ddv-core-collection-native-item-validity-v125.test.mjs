import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyNativeItemValidityEvidenceV125, inspectNativeItemValidityBoundaryV125,NATIVE_ITEM_VALIDITY_EVIDENCE_V125_SHA256} from '../src/lib/ddv/core/collection/native-item-validity-v125.js';
const raw=readFileSync('static/ddv/core/collection/v1.25/native-item-validity-callgraph-v125.json');
const identity={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
const verify=()=>verifyNativeItemValidityEvidenceV125(raw,identity);
const probe=(verifiedSource,itemId)=>inspectNativeItemValidityBoundaryV125({verifiedSource,identity,itemId});

test('Source SHA verifies exact Switch1250 eligibility branch proof, not runtime membership',async()=>{
  const v=await verify();assert.equal(v.status,'VERIFIED_NATIVE_VALIDITY_CONTROL_FLOW_ONLY');
  assert.equal(v.sourceSha256,NATIVE_ITEM_VALIDITY_EVIDENCE_V125_SHA256);
  assert.equal(v.finalNativeMembershipAuthorized,false);
});
test('GetItemsInGroup does not directly invoke IsValid, but GetNewGroup does',async()=>{
  const v=await verify();assert.equal(v.isValidInsideGroupSetComposition,false);
  assert.equal(v.isValidInvokedByGetNewGroup,true);
});
test('Native first registry lookup and its per-record virtual predicate are separate gates',async()=>{
  const v=await verify();assert.equal(v.nativeFirstRegistryAndVirtualGateConfirmed,true);
  const r=probe(v,10000098);assert.equal(r.firstRegistryLookup,'REQUIRES_NATIVE_RUNTIME');
  assert.equal(r.firstVirtualPredicate,'REQUIRES_NATIVE_RUNTIME');
});
test('Native second registry lookup and enum equality never imply static eligibility',async()=>{
  const v=await verify();assert.equal(v.optionalSecondRegistryAndEnumEqualityGateConfirmed,true);
  const r=probe(v,130000404);assert.equal(r.nativeEligibility,'UNKNOWN');assert.equal(r.denominator,null);
});
test('A mismatching first-stage source ID never becomes a guessed Missing or Collected',async()=>{
  const v=await verify();const r=probe(v,99999999);
  assert.equal(r.nativeEligibility,'UNKNOWN');assert.equal(r.collected,'UNKNOWN');assert.equal(r.owned,'UNKNOWN');
});
test('Negative/zero/noninteger ItemID fails closed',async()=>{
  const v=await verify();for(const id of [-1,0,1.25,NaN,Infinity,'10000098'])assert.equal(probe(v,id).status,'BLOCKED');
});
test('Forged capability fails closed even when status string agrees',()=>{
  assert.equal(probe({status:'VERIFIED_NATIVE_VALIDITY_CONTROL_FLOW_ONLY'},10000098).code,'VERIFIED_SOURCE_CAPABILITY_REQUIRED');
});
test('One-byte modified machine artifact is rejected by real SHA comparison',async()=>{
  const b=Buffer.from(raw);b[105]^=1;assert.equal((await verifyNativeItemValidityEvidenceV125(b,identity)).code,'SOURCE_SHA256_MISMATCH');
});
test('Wrong source build, Steam, schema626, game 1253 cannot inherit eligibility',async()=>{
  for(const x of [{buildId:'9A239D3DB569756D'},{platform:'steam-windows'},{profileSchema:626},{gameVersion:'1.25.3'}])
    assert.equal((await verifyNativeItemValidityEvidenceV125(raw,{...identity,...x})).code,'EXACT_SWITCH_1250_IDENTITY_REQUIRED');
});
test('No source supports new false set denominator or runtime registry names',()=>{
  const e=JSON.parse(raw);assert.equal(e.callgraph.runtimeRegistryMeaning,'UNKNOWN');
  assert.equal(e.callgraph.secondRegistryEnumSemantic,'UNKNOWN');
  assert.equal(e.callgraph.allProfileCreationAndRefreshCallers,'UNKNOWN');
  assert.equal(e.evidenceClass.finalCollectionMembership,'UNKNOWN');
});
test('Artifact is source-only and contains no private save, writer, or entitlements',()=>{
  const e=JSON.parse(raw);assert.equal(e.privacy.containsPersonalSave,false);
  assert.equal(e.privacy.personalCollectionMetricsAuthorized,false);
  assert.equal(e.privacy.entitlementWritesAuthorized,false);
  assert.equal(e.privacy.nativeWriterAuthorized,false);
});
