import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyNativeCharacterSelectorCandidatesV125,inspectNativeCharacterUniversePredicateV125,NATIVE_CHARACTER_SELECTOR_V125_SHA256} from '../src/lib/ddv/core/collection/native-selector-membership-v125.js';
const bytes=readFileSync('static/ddv/core/collection/v1.25/native-character-universe-predicate-v125.json');
const identity={platform:'switch',gameVersion:'1.25.0',buildId:'52BD625D9B4E0053',profileSchema:624};
const verified=()=>verifyNativeCharacterSelectorCandidatesV125(bytes,identity);
const query=(handle,definitionId,itemId)=>inspectNativeCharacterUniversePredicateV125({verifiedSource:handle,identity,collectionDefinitionId:definitionId,itemId});
test('Byte-pinned 33 native CharacterUniverse selectors verified without metric promotion',async()=>{
 const v=await verified();assert.equal(v.status,'VERIFIED_PREDICATE_CANDIDATES_ONLY');
 assert.equal(v.definitionCount,33);assert.equal(v.remainingUnknownSelectorCount,223);
 assert.equal(v.sourceSha256,NATIVE_CHARACTER_SELECTOR_V125_SHA256);
 assert.equal(v.finalCandidateMembershipProven,false);assert.equal(v.personalCollectionMetricsAuthorized,false);
});
test('Real static Mickey universe characters match predicate',async()=>{
 const v=await verified();assert.equal(query(v,2120000085,10000003).state,'MATCHES_CHARACTER_UNIVERSE_PREDICATE');
 assert.equal(query(v,2120000085,10000003).denominator,null);
});
test('Debug character excluded even when its universe matches',async()=>{
 const v=await verified();const x=query(v,2120000169,10000100);
 assert.equal(x.state,'REJECTED_NATIVE_ISDEBUG');assert.equal(x.finalMembershipKnown,false);
 assert.equal(query(v,2120000169,10000098).state,'MATCHES_CHARACTER_UNIVERSE_PREDICATE');
});
test('Wrong universe and an unknown positive ID cannot become Collected',async()=>{
 const v=await verified();
 assert.equal(query(v,2120000085,10000002).state,'DOES_NOT_MATCH_CHARACTER_UNIVERSE_PREDICATE');
 assert.equal(query(v,2120000085,99999999).state,'DOES_NOT_MATCH_CHARACTER_UNIVERSE_PREDICATE');
 assert.equal(query(v,2120000085,99999999).collected,'UNKNOWN');
});
test('Non-proven furniture, crafting and other definition cannot be promoted',async()=>{
 const v=await verified();const x=query(v,2120000024,40000047);
 assert.equal(x.status,'UNKNOWN');assert.equal(x.code,'SELECTOR_FAMILY_NOT_NATIVE_PROVEN');
});
test('Forged capability and tampered data fail closed',async()=>{
 const fake={status:'VERIFIED_PREDICATE_CANDIDATES_ONLY'};
 assert.equal(query(fake,2120000169,10000098).code,'VERIFIED_SOURCE_HANDLE_REQUIRED');
 const modified=Buffer.from(bytes);modified[200]^=1;
 assert.equal((await verifyNativeCharacterSelectorCandidatesV125(modified,identity)).code,'SOURCE_SHA256_MISMATCH');
});
test('Schema626, Steam, wrong BID, wrong schema and bad identifiers refuse',async()=>{
 for(const delta of [{buildId:'9A239D3DB569756D',profileSchema:626},{platform:'steam-windows'},{profileSchema:626},{gameVersion:'1.25.3'}]){
  const r=await verifyNativeCharacterSelectorCandidatesV125(bytes,{...identity,...delta});
  assert.equal(r.status,'BLOCKED');
 }
 const v=await verified();assert.equal(query(v,2120000085,0).status,'BLOCKED');
});
test('Source records hold zero personal save and no final category denominator',()=>{
 const data=JSON.parse(bytes.toString());assert.equal(data.privacy.containsPersonalSave,false);
 assert.equal(data.privacy.nativeWriterAllowed,false);
 assert.equal(data.evidenceClasses.nativeFinalCandidateSet,'UNKNOWN');
 assert.equal(data.statistics.selectorMatchedOccurrences,74);assert.equal(data.statistics.selectorDebugExcludedOccurrences,48);
 assert.equal(data.statistics.ignoredSelectorCount,20);
});
