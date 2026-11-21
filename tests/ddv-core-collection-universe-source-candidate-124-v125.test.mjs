import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const doc=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-universe-source-candidate-124-v125.json','utf8'));
const census=JSON.parse(readFileSync('static/ddv/core/collection/v1.25/native-unresolved-selector-census-v125.json','utf8'));
test('Universe source-only index pins original Switch1250 sources, never historical d548',()=>{
 assert.deepEqual(doc.scope,{platform:'Nintendo Switch',version:'1.25.0',bid:'52BD625D9B4E0053',saveSchema:624});
 assert.equal(doc.originalSource.supportGzipSha256,'537cfcf14beca1e76496d4f9c5b60bd7e31d385a16fd69e63083df6978fdf4b9');
 assert.equal(doc.originalSource.losslessGzipSha256,'df78c309a8023667c92426e3b929ed3e51aadf10d943835a3673cefa585f8048');
 assert.equal(doc.originalSource.nativeExeFsSha256,'3258d5e05aded708c06017b8763fa37bfb696385a2ab29dd8a182d3938cbc0e0');
 assert.equal(doc.originalSource.metadataV31Sha256,'07e919f07f7be2df883b7292bd3c699f670b4c1e8ff496ef7747447f5baa9f7c');
 assert.equal(doc.originalSource.historicalD548Metadata,'NEED_SOURCE');
});
test('Index covers the precise prior frozen 61 Clothing and 63 Furniture selector occurrences, without deduplicating shared DefinitionIDs',()=>{
 const ref=census.entries.filter(x=>x.family==='Clothing'||x.family==='Furniture');
 assert.equal(ref.length,124);assert.equal(doc.entries.length,124);
 const key=x=>[x.definitionId,x.family,Number(x.selectorValue??x.selectorUniverseTag)].join('/');
 assert.deepEqual(doc.entries.map(key).sort(),ref.map(key).sort());
 assert.equal(doc.entries.filter(x=>x.family==='Clothing').length,61);
 assert.equal(doc.entries.filter(x=>x.family==='Furniture').length,63);
 for(const x of doc.entries){assert.equal(x.oneof,'Universe');assert.ok(x.selectorUniverseTag>2000500000);
 assert.equal(x.nativeUniverseCase2,'NEED_ORIGINAL_NATIVE_CALL_CHAIN');assert.equal(x.classification,'SOURCE_SET_UNIVERSE_TAG_JOIN_ONLY__NOT_NATIVE_OR_RUNTIME');}
});
test('All preserved original typed inputs and Set references are accounted for, but these are SOURCE counts only',()=>{
 const x=doc.originalRows;
 assert.equal(x.setsIndividuallyShaVerified,711);assert.equal(x.setsOneUniverseTag,709);assert.equal(x.setsNoUniverseTag,2);
 assert.equal(x.clothingTypedRowsIndividuallyShaVerified,1900);assert.equal(x.clothingAllSetRefsResolved,1900);
 assert.equal(x.furnitureTypedRowsIndividuallyShaVerified,4949);assert.equal(x.furnitureSetRefsResolved,4004);
 assert.equal(x.furnitureWithoutSetItemID,945);
 assert.equal(x.furnitureSetRefsResolved+x.furnitureWithoutSetItemID,x.furnitureTypedRowsIndividuallyShaVerified);
 const subtotal=fam=>doc.entries.filter(z=>z.family===fam).reduce((sum,z)=>sum+z.originalSourceCandidateCount,0);
 assert.equal(subtotal('Clothing'),1900);assert.equal(subtotal('Furniture'),4004);
 assert.equal(doc.summary.byFamily.Clothing.sourceJoinCandidates,1900);assert.equal(doc.summary.byFamily.Furniture.sourceJoinCandidates,4004);
});
test('Source-empty Universe selector identities are explicit UNKNOWN, never Native-empty or zero denominator',()=>{
 const zero=doc.entries.filter(z=>z.originalSourceCandidateCount===0);
 assert.equal(zero.length,5);
 assert.deepEqual(zero.map(x=>[x.definitionId,x.family,x.selectorUniverseTag]),[
 [2120000162,'Clothing',2000500047],[2120000367,'Clothing',2000500069],
 [2120000248,'Furniture',2000500062],[2120000254,'Furniture',2000500066],[2120000368,'Furniture',2000500069]]);
 assert.equal(doc.summary.byFamily.Clothing.zeroCandidateSelectors,2);assert.equal(doc.summary.byFamily.Furniture.zeroCandidateSelectors,3);
});
test('Source joins do not promote Universe selection/owned/percentage or writer/Steam/626',()=>{
 const s=doc.safety;
 assert.equal(s.newNativeSelectorClosures,0);assert.equal(s.ownerStaticCoverage,132);assert.equal(s.lastIndependentQrAcceptancePinned,103);
 assert.equal(s.unclosedClothing,61);assert.equal(s.unclosedFurniture,63);
 assert.equal(s.fullNativeCase2RelationUnknown,true);assert.equal(s.finalCollectionMembershipKnown,false);assert.equal(s.denominator,null);
 for(const n of ['nativeWriter','presetApply','communityPublishing','entitlementEditing','steamOrSchema626Transferred'])assert.equal(s[n],false,n);
 for(const n of ['owned','collected','missing'])assert.equal(s[n],'UNKNOWN');
 assert.equal(s.allPrDraft,true);
});
