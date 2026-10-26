import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyNativeGroupCompositionEvidenceV125,previewNativeGroupCompositionV125,NATIVE_GROUP_COMPOSITION_V125_SHA256} from '../src/lib/ddv/core/collection/native-group-composition-v125.js';
const bytes=readFileSync('static/ddv/core/collection/v1.25/native-group-composition-evidence-v125.json');
const identity={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
const verify=()=>verifyNativeGroupCompositionEvidenceV125(bytes,identity);
const t=(itemIds,ignore=false,family='MemoryShard')=>({family,itemIds,ignore,predicateCoverage:'CALLER_SUPPLIED_UNVERIFIED'});
const i=(itemIds,ignore=false)=>({itemIds,ignore});
const preview=(verifiedSource,typedSelectorResults,explicitItemFilters,includeIgnored=false)=>previewNativeGroupCompositionV125({verifiedSource,identity,typedSelectorResults,explicitItemFilters,includeIgnored});

test('Actual SHA-pinned native control flow confirms union then subtraction without exposing final membership',async()=>{
  const proof=await verify();assert.equal(proof.status,'VERIFIED_NATIVE_GROUP_CONTROL_FLOW_ONLY');
  assert.equal(proof.nativeUnionExcludeOrderingConfirmed,true);assert.equal(proof.sha256,NATIVE_GROUP_COMPOSITION_V125_SHA256);
  assert.equal(proof.familyPredicatesRemainingUnknown,182);assert.equal(proof.finalNativeMembershipAuthorized,false);
});
test('Same typed and explicit ID excluded from final default preview, even if present in positive inputs',async()=>{
  const proof=await verify();const r=preview(proof,[t([100,101]),t([100],true)],[i([101,102]),i([102],true)]);
  assert.deepEqual(r.resultItemIds,[101]);assert.equal(r.status,'UNTRUSTED_PREDICATE_COMPOSITION_PREVIEW_ONLY');assert.equal(r.denominator,null);
});
test('includeIgnored=true adds ignored filters and does not subtract',async()=>{
  const proof=await verify();const r=preview(proof,[t([100,101]),t([100,103],true)],[i([101,102]),i([102,104],true)],true);
  assert.deepEqual(r.resultItemIds,[100,101,102,103,104]);assert.equal(r.finalMembershipKnown,false);
});
test('Source-equivalent MemoryShard overlap from definition 2120000349 only produces previewânot a Native denominator',async()=>{
  const proof=await verify();const r=preview(proof,[t([130000404,130000405,130000406,130000418,130000419,130000420,130000421,130000422]),t([130000387,130000404,130000405,130000406],true)],[]);
  assert.deepEqual(r.resultItemIds,[130000418,130000419,130000420,130000421,130000422]);
  assert.equal(r.sourceInputsAttested,false);assert.equal(r.collected,'UNKNOWN');assert.equal(r.owned,'UNKNOWN');
});
test('Duplicate items dedupe within one composed set without claim of cross-category unique metrics',async()=>{
  const proof=await verify();const r=preview(proof,[t([1,1,2])],[i([2,2,3])]);
  assert.deepEqual(r.resultItemIds,[1,2,3]);assert.equal(r.personalCollectionMetricsAuthorized,false);
});
test('Unverified typed selector results and missing family fail closed',async()=>{
  const proof=await verify();const r=preview(proof,[{family:'Furniture',ignore:false,itemIds:[40000001]}],[]);
  assert.equal(r.code,'UNVERIFIED_OR_MALFORMED_PREDICATE_INPUT');
  assert.equal(preview(proof,[{ignore:false,itemIds:[1],predicateCoverage:'CALLER_SUPPLIED_UNVERIFIED'}],[]).status,'BLOCKED');
});
test('Unsupported IDs, filters and group flags fail closed, no phantom 0 ID',async()=>{
  const proof=await verify();
  assert.equal(preview(proof,[t([0])],[]).status,'BLOCKED');
  assert.equal(preview(proof,[],[i([-1])]).status,'BLOCKED');
  assert.equal(previewNativeGroupCompositionV125({verifiedSource:proof,identity,typedSelectorResults:[],explicitItemFilters:[],includeIgnored:'no'}).status,'BLOCKED');
});
test('Forged or modified source evidence cannot create trusted group capability',async()=>{
  assert.equal(preview({status:'VERIFIED_NATIVE_GROUP_CONTROL_FLOW_ONLY'},[],[]).code,'VERIFIED_SOURCE_CAPABILITY_REQUIRED');
  const bad=Buffer.from(bytes);bad[145]^=1;
  assert.equal((await verifyNativeGroupCompositionEvidenceV125(bad,identity)).code,'SOURCE_SHA256_MISMATCH');
});
test('Switch schema626 and Steam never inherit 624 grouping',async()=>{
  for(const delta of [{profileSchema:626},{gameVersion:'1.25.3'},{platform:'steam-windows'},{buildId:'9A239D3DB569756D'}]) {
    assert.equal((await verifyNativeGroupCompositionEvidenceV125(bytes,{...identity,...delta})).code,'EXACT_SWITCH_1250_IDENTITY_REQUIRED');
  }
});
test('Machine artifact is source-only and preserves separate IsValidItemForCollection uncertainty',()=>{
  const m=JSON.parse(bytes.toString());assert.equal(m.sourceCounts.collectionDefinitions,293);
  assert.equal(m.evidence.groupHashSetUnionExceptOrder,'CONFIRMED_STATIC_NATIVE_CONTROL_FLOW');
  assert.equal(m.evidence.IsValidItemForCollectionGlobalEligibilityFullSemantics,'UNKNOWN');
  assert.equal(m.safety.personalSaveIncluded,false);assert.equal(m.safety.percentageAuthorized,false);
  assert.equal(m.safety.entitlementWriteAuthorized,false);
});
