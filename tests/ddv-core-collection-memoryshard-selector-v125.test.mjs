import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyNativeMemoryShardSelectorCandidatesV125,inspectNativeMemoryShardPredicateV125,NATIVE_MEMORYSHARD_SELECTOR_V125_SHA256} from '../src/lib/ddv/core/collection/native-memoryshard-membership-v125.js';
const bytes=readFileSync('static/ddv/core/collection/v1.25/native-memoryshard-predicate-v125.json');
const id={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
const verification=()=>verifyNativeMemoryShardSelectorCandidatesV125(bytes,id);
const probe=(v,d,itemId)=>inspectNativeMemoryShardPredicateV125({verifiedSource:v,identity:id,collectionDefinitionId:d,itemId});
test('SHA-pinned native MemoryShard 41 selectors remain predicate-only',async()=>{
 const v=await verification();assert.equal(v.status,'VERIFIED_PREDICATE_CANDIDATES_ONLY');assert.equal(v.selectorCount,41);
 assert.equal(v.remainingNativeUnprovenSelectorsAfterCharacter,182);
 assert.equal(v.sourceSha256,NATIVE_MEMORYSHARD_SELECTOR_V125_SHA256);assert.equal(v.finalCandidateMembershipProven,false);
});
test('Native Universe matching for actual MemoryShard definition',async()=>{
 const manifest=JSON.parse(bytes);const d=manifest.definitions.find(x=>x.collectionDefinitionId===2120000044);
 assert.equal(d.filterCase,'Universe');assert.ok(d.predicateCandidateItemIds.length>0);
 const p=probe(await verification(),d.collectionDefinitionId,d.predicateCandidateItemIds[0]);
 assert.equal(p.anyPredicateMatch,true);assert.equal(p.predicatesMatched[0].filterCase,'Universe');assert.equal(p.denominator,null);
});
test('Native MemoryShardSubType matching is exact and separate from Universe',async()=>{
 const manifest=JSON.parse(bytes);const d=manifest.definitions.find(x=>x.collectionDefinitionId===2120000080);
 assert.equal(d.filterCase,'MemoryShardSubType');assert.ok(d.predicateCandidateItemIds.length>0);
 const p=probe(await verification(),d.collectionDefinitionId,d.predicateCandidateItemIds[0]);
 assert.equal(p.anyPredicateMatch,true);assert.equal(p.predicatesMatched[0].filterCase,'MemoryShardSubType');
});
test('Ignore=true retains predicate match but never predicts group subtraction order',async()=>{
 const manifest=JSON.parse(bytes);const d=manifest.definitions.find(x=>x.collectionDefinitionId===2120000349&&x.ignore);
 assert.ok(d);assert.equal(d.filterCase,'MemoryShardSubType');assert.equal(d.predicateCandidateItemIds.length,4);
 const p=probe(await verification(),d.collectionDefinitionId,d.predicateCandidateItemIds[0]);
 assert.ok(p.predicatesMatched.some(x=>x.ignore));assert.equal(p.ignoredFinalMembership,'UNKNOWN');
});
test('No-match does not imply user Missing, and other families remain UNKNOWN',async()=>{
 const v=await verification();const p=probe(v,2120000044,99999999);
 assert.equal(p.anyPredicateMatch,false);assert.equal(p.collected,'UNKNOWN');assert.equal(p.finalMembershipKnown,false);
 assert.equal(probe(v,2120000024,40000047).status,'UNKNOWN');
});
test('Tampered source and fabricated capability fail closed',async()=>{
 const mutated=Buffer.from(bytes);mutated[120]^=1;
 assert.equal((await verifyNativeMemoryShardSelectorCandidatesV125(mutated,id)).code,'SOURCE_SHA256_MISMATCH');
 assert.equal(probe({status:'VERIFIED_PREDICATE_CANDIDATES_ONLY'},2120000044,130000001).status,'BLOCKED');
});
test('Switch 1.25.3 schema626 and Steam never inherit membership',async()=>{
 for(const override of [{buildId:'9A239D3DB569756D',profileSchema:626},{gameVersion:'1.25.3'},{platform:'steam-windows'},{profileSchema:626}]){
  assert.equal((await verifyNativeMemoryShardSelectorCandidatesV125(bytes,{...id,...override})).code,'EXACT_SWITCH_1250_IDENTITY_REQUIRED');
 }
});
test('No percentage, ownership, entitlement, upload or native write claims',async()=>{
 const v=await verification();const m=JSON.parse(bytes);assert.equal(m.privacy.containsPersonalSave,false);
 assert.equal(v.personalCollectionMetricsAuthorized,false);assert.equal(v.nativeWriterAuthorized,false);
 assert.equal(m.statistics.predicateClosedMemoryShardSelectorOccurrences,41);
});
